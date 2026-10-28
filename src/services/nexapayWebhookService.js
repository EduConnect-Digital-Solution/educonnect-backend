const crypto = require('crypto');
const { prisma } = require('../config/database');
const config = require('../config');
const logger = require('../utils/logger');
const nexapayService = require('./nexapayService');
const nexapayConfigService = require('./nexapayConfigService');
const { settleDeposit } = require('./nexapaySettlement');

/**
 * NexaPay webhook handling.
 *
 * Order of operations is the security contract:
 *   1. the business id only SELECTS which tenant secret to verify with -
 *      nothing from the payload is trusted before the HMAC passes;
 *   2. verify the HMAC over the exact raw body;
 *   3. only then parse and act on the payload.
 *
 * An unknown business id and a bad signature produce the same bare 401, so the
 * endpoint cannot be used to probe which business ids exist.
 */

const PROVIDER = 'nexapay';
const SETTLED_STATUSES = new Set(['successful', 'success', 'completed']);

// Headers that may appear in the debug log verbatim. The signature is only
// ever described, never printed.
const DEBUG_SAFE_HEADERS = [
  'content-type',
  'content-length',
  'user-agent',
  'x-nexapay-business-id',
  'x-nexapay-event',
  'x-nexapay-event-id',
  'x-nexapay-timestamp'
];

class WebhookAuthError extends Error {
  constructor(reason) {
    super('Unauthorized');
    this.name = 'WebhookAuthError';
    this.reason = reason;
  }
}

class WebhookPayloadError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'WebhookPayloadError';
    this.reason = reason;
  }
}

const headerValue = (headers, name) => {
  const value = headers[name];
  if (Array.isArray(value)) return value[0];
  return value;
};

const isRecord = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isValidAmount = (amount) =>
  typeof amount === 'number' && Number.isFinite(amount) && amount > 0;

/**
 * NexaPay amounts are naira; the ledger stores kobo.
 */
const toKobo = (amount) => {
  if (!isValidAmount(amount)) {
    throw new WebhookPayloadError('Invalid amount');
  }
  return nexapayService.Kobo(amount);
};

const parseEnvelope = (rawBody) => {
  let parsed;
  try {
    parsed = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new WebhookPayloadError('Invalid JSON');
  }
  if (!isRecord(parsed) || !isRecord(parsed.data)) {
    throw new WebhookPayloadError('Malformed event');
  }
  return parsed;
};

const DEBUG_BODY_LIMIT = 8 * 1024;

/**
 * Temporary aid for confirming the signature layout (NEXAPAY_DEBUG_WEBHOOKS,
 * honoured only in development and test). Logs the delivery as received,
 * with the signature reduced to its shape. The body is not logged here: an
 * unauthenticated caller could otherwise write anything into the logs.
 */
const logDebugDelivery = (rawBody, headers) => {
  if (!config.nexapay.debugWebhooks) return;
  const safeHeaders = {};
  for (const name of DEBUG_SAFE_HEADERS) {
    const value = headerValue(headers, name);
    if (value !== undefined) safeHeaders[name] = value;
  }
  logger.warn('NexaPay webhook debug delivery', {
    headerNames: Object.keys(headers),
    headers: safeHeaders,
    signature: nexapayService.describeSignature(headerValue(headers, 'x-nexapay-signature')),
    bodyBytes: rawBody.length
  });
};

/**
 * The body, for a delivery that names a configured school. Needed to work
 * out the signature layout when none of the candidates match.
 */
const logDebugBody = (rawBody, businessId, result) => {
  if (!config.nexapay.debugWebhooks) return;
  logger.warn('NexaPay webhook debug signature check', {
    businessId,
    layout: result.layout,
    reason: result.reason,
    body: rawBody.toString('utf8', 0, Math.min(rawBody.length, DEBUG_BODY_LIMIT)),
    truncated: rawBody.length > DEBUG_BODY_LIMIT
  });
};

/**
 * The business id that selects the verification secret. The docs list the
 * x-nexapay-business-id header as one of the headers NexaPay sends "similar
 * to", and every event body carries businessId, so the body is the fallback.
 * Either way it is only a lookup key: the HMAC under that tenant's secret is
 * what authenticates the delivery.
 */
const selectBusinessId = (rawBody, headers) => {
  const fromHeader = headerValue(headers, 'x-nexapay-business-id');
  if (typeof fromHeader === 'string' && fromHeader.trim()) return fromHeader.trim();
  try {
    const peeked = JSON.parse(rawBody.toString('utf8'));
    return isRecord(peeked) && typeof peeked.businessId === 'string' ? peeked.businessId : null;
  } catch {
    return null;
  }
};

/**
 * A stable id for the event. The signed body's eventId comes first; the
 * unsigned header is a fallback; a hash of the raw body is the last resort so
 * the delivery is still idempotent.
 */
const resolveEventId = (envelope, rawBody, headers) => {
  if (typeof envelope.eventId === 'string' && envelope.eventId.trim()) return envelope.eventId.trim();
  const fromHeader = headerValue(headers, 'x-nexapay-event-id');
  if (typeof fromHeader === 'string' && fromHeader.trim()) return fromHeader.trim();
  return `sha256:${crypto.createHash('sha256').update(rawBody).digest('hex')}`;
};

/**
 * Verify the delivery.
 * Throws WebhookAuthError for every failure mode so the caller can answer
 * with one indistinguishable 401.
 */
const authenticate = async ({ rawBody, headers }) => {
  const businessId = selectBusinessId(rawBody, headers);
  const signature = headerValue(headers, 'x-nexapay-signature');
  const timestamp = headerValue(headers, 'x-nexapay-timestamp');

  if (!businessId || !signature || !timestamp) {
    throw new WebhookAuthError('MISSING_HEADERS');
  }

  const creds = await nexapayConfigService.getByBusinessId(businessId);

  if (!creds) {
    // Unknown business: still burn a signature verification so the response
    // time does not reveal whether the business exists.
    nexapayService.verifyWebhookSignature(rawBody, { signature, timestamp }, 'unknown-business');
    throw new WebhookAuthError('UNKNOWN_BUSINESS');
  }

  const result = nexapayService.verifyWebhookSignature(
    rawBody,
    { signature, timestamp },
    creds.webhookSecret
  );

  logDebugBody(rawBody, businessId, result);

  if (!result.valid) {
    throw new WebhookAuthError(result.reason || 'SIGNATURE_MISMATCH');
  }

  return creds;
};

/**
 * Handle one webhook delivery.
 *
 * @returns {{received: boolean, duplicate?: boolean, ignored?: boolean, eventId?: string}}
 */
const handleWebhook = async ({ rawBody, headers }) => {
  logDebugDelivery(rawBody || Buffer.alloc(0), headers);

  if (!rawBody || !rawBody.length) {
    throw new WebhookPayloadError('Empty body');
  }

  const creds = await authenticate({ rawBody, headers });

  const envelope = parseEnvelope(rawBody);

  // The body must belong to the business whose secret verified it.
  if (typeof envelope.businessId === 'string' && envelope.businessId !== creds.businessId) {
    throw new WebhookAuthError('BUSINESS_MISMATCH');
  }

  // Sandbox events must never settle a live invoice (and the other way round).
  // Every documented event carries `environment`; one without it is not trusted
  // to belong to either side.
  if (envelope.environment !== creds.environment) {
    logger.warn('Ignoring NexaPay event for a different environment', {
      businessId: creds.businessId,
      eventEnvironment: envelope.environment || null,
      configuredEnvironment: creds.environment,
      event: envelope.event
    });
    return { received: true, ignored: true };
  }

  const eventId = resolveEventId(envelope, rawBody, headers);
  const eventType = typeof envelope.event === 'string' ? envelope.event : 'unknown';

  try {
    // The event row and the business effect commit together. A failure rolls
    // both back, we answer 500, and NexaPay's retry gets a clean attempt.
    await prisma.$transaction(
      async (tx) => {
        await tx.gatewayEvent.create({
          data: {
            provider: PROVIDER,
            eventId,
            eventType,
            schoolId: creds.schoolId,
            payload: envelope
          }
        });

        await dispatch(tx, creds, envelope, eventType);
      },
      { timeout: 15000 }
    );
  } catch (error) {
    // A concurrent delivery of the same event lost the race on the unique key.
    if (error && error.code === 'P2002') {
      const seen = await prisma.gatewayEvent.findUnique({
        where: { provider_eventId: { provider: PROVIDER, eventId } },
        select: { id: true }
      });
      if (seen) {
        logger.info('Duplicate NexaPay event ignored', { businessId: creds.businessId, eventId });
        return { received: true, duplicate: true, eventId };
      }
    }
    throw error;
  }

  logger.info('NexaPay webhook processed', {
    businessId: creds.businessId,
    eventId,
    eventType
  });

  return { received: true, eventId };
};

/**
 * Route the event to its handler. Only deposit.received moves money; every
 * other type is recorded in GatewayEvent as the audit trail.
 */
const dispatch = async (tx, creds, envelope, eventType) => {
  switch (eventType) {
    case 'deposit.received':
      return applyDeposit(tx, creds, envelope);
    case 'withdrawal.completed':
    case 'withdrawal.failed':
      // Payout ledger updates are not wired up yet.
      logger.info('NexaPay withdrawal event recorded', {
        businessId: creds.businessId,
        status: envelope.data.status
      });
      return undefined;
    default:
      logger.warn('Unhandled NexaPay event type', { eventType });
      return undefined;
  }
};

/**
 * Settle a deposit.received event.
 */
const applyDeposit = async (tx, creds, envelope) => {
  const data = envelope.data;

  if (!SETTLED_STATUSES.has(String(data.status || '').toLowerCase())) {
    logger.warn('NexaPay deposit is not in a settled state', {
      businessId: creds.businessId,
      transactionId: data.transactionId,
      status: data.status
    });
    return undefined;
  }

  return settleDeposit(tx, {
    schoolId: creds.schoolId,
    providerTxnId: typeof data.transactionId === 'string' && data.transactionId ? data.transactionId : null,
    reference: typeof data.reference === 'string' && data.reference ? data.reference : null,
    merchantReference: typeof data.merchantReference === 'string' && data.merchantReference
      ? data.merchantReference
      : null,
    // An unreadable amount is held for review by settleDeposit rather than
    // rejected: the delivery is verified, so the money must not be dropped.
    amountKobo: isValidAmount(data.amount) ? toKobo(data.amount) : null,
    payerDetails: {
      name: data.senderName || null,
      accountNumber: data.senderAccount || null,
      bankName: data.senderBank || null,
      targetAccountNumber: data.accountNumber || null
    },
    providerRaw: data
  });
};

module.exports = {
  PROVIDER,
  WebhookAuthError,
  WebhookPayloadError,
  toKobo,
  selectBusinessId,
  resolveEventId,
  authenticate,
  handleWebhook
};
