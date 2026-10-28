const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * NexaPay merchant API adapter.
 *
 * Mirrors the shape of src/services/paystackService.js: a flat module of
 * functions that talk to one provider. NexaPay differs from Paystack in two
 * ways:
 *   - credentials are per school (businessId + apiKey), not global env vars;
 *   - there is no "initialize transaction" redirect - collections use
 *     customer-facing virtual bank accounts.
 *
 * NexaPay amounts are in naira (the withdrawal schema documents its minimum
 * as "minimum ₦1,000" with `minimum: 1000`). This codebase stores money in
 * kobo, so the conversion happens at the provider boundary and nowhere else.
 */

const NEXAPAY_ENVIRONMENTS = ['test', 'prod'];

// Signature tolerance. Replay is neutralised by eventId de-duplication, and
// NexaPay retries may reuse the original timestamp, so the window is wide.
const DEFAULT_TOLERANCE_MS = 24 * 60 * 60 * 1000;

const Naira = (kobo) => kobo / 100;
const Kobo = (naira) => Math.round(naira * 100);

/**
 * Candidate signature layouts. The NexaPay docs (webhooks, "Signature Scheme")
 * only state "the signature is computed over the raw body plus timestamp using
 * HMAC SHA-256" - the join and the digest encoding are not published. Every
 * candidate is an HMAC under the same secret, so accepting several does not
 * weaken verification; it only narrows which one the provider actually uses.
 * Set NEXAPAY_DEBUG_WEBHOOKS=true outside production, take one test-mode
 * delivery, read `layout` from the log, then delete the candidates that do not
 * match.
 */
const SIGNATURE_LAYOUTS = [
  { name: 'timestamp.body', build: (ts, body) => Buffer.concat([Buffer.from(`${ts}.`, 'utf8'), body]) },
  { name: 'timestampbody', build: (ts, body) => Buffer.concat([Buffer.from(ts, 'utf8'), body]) },
  { name: 'body.timestamp', build: (ts, body) => Buffer.concat([body, Buffer.from(`.${ts}`, 'utf8')]) },
  { name: 'bodytimestamp', build: (ts, body) => Buffer.concat([body, Buffer.from(ts, 'utf8')]) }
];

const parseTimestampMs = (ts) => {
  if (typeof ts !== 'string' || ts.length === 0) return null;
  if (/^\d+$/.test(ts)) {
    const n = Number(ts);
    return n < 1e12 ? n * 1000 : n; // seconds or milliseconds
  }
  const parsed = Date.parse(ts); // ISO string
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * Decode the provided signature. NexaPay does not publish the digest encoding,
 * so hex and base64 are both accepted.
 */
const decodeSignature = (raw) => {
  if (typeof raw !== 'string') return null;
  const value = raw.replace(/^sha256=/i, '').trim();
  if (/^[0-9a-f]{64}$/i.test(value)) return Buffer.from(value, 'hex');
  if (/^[A-Za-z0-9+/]{43}=$/.test(value)) return Buffer.from(value, 'base64');
  if (/^[A-Za-z0-9_-]{43}$/.test(value)) return Buffer.from(value, 'base64url');
  return null;
};

/**
 * Describe a signature header without revealing it, for the debug log.
 */
const describeSignature = (raw) => {
  if (typeof raw !== 'string' || raw.length === 0) return { present: false };
  const value = raw.replace(/^sha256=/i, '').trim();
  let encoding = 'unknown';
  if (/^[0-9a-f]+$/i.test(value)) encoding = 'hex';
  else if (/^[A-Za-z0-9+/]+=*$/.test(value)) encoding = 'base64';
  else if (/^[A-Za-z0-9_-]+$/.test(value)) encoding = 'base64url';
  return {
    present: true,
    length: value.length,
    prefixed: value.length !== raw.trim().length,
    encoding
  };
};

/**
 * Verify the HMAC of a webhook delivery.
 *
 * @param {Buffer} rawBody exact bytes received (the signature covers them)
 * @param {{signature: string, timestamp: string}} headers
 * @param {string} secret the school's webhook secret
 * @returns {{valid: boolean, layout: string|null, reason: string|null}}
 */
const verifyWebhookSignature = (rawBody, { signature, timestamp }, secret) => {
  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
    return { valid: false, layout: null, reason: 'EMPTY_BODY' };
  }
  if (!secret) {
    return { valid: false, layout: null, reason: 'NO_SECRET' };
  }
  if (typeof timestamp !== 'string' || timestamp.length === 0) {
    return { valid: false, layout: null, reason: 'MISSING_TIMESTAMP' };
  }
  if (typeof signature !== 'string' || signature.length === 0) {
    return { valid: false, layout: null, reason: 'MISSING_SIGNATURE' };
  }

  const tsMs = parseTimestampMs(timestamp);
  if (tsMs === null) {
    return { valid: false, layout: null, reason: 'MALFORMED_TIMESTAMP' };
  }
  if (Math.abs(Date.now() - tsMs) > DEFAULT_TOLERANCE_MS) {
    return { valid: false, layout: null, reason: 'STALE_TIMESTAMP' };
  }

  const provided = decodeSignature(signature);
  if (!provided) {
    return { valid: false, layout: null, reason: 'MALFORMED_SIGNATURE' };
  }

  for (const layout of SIGNATURE_LAYOUTS) {
    const expected = crypto.createHmac('sha256', secret).update(layout.build(timestamp, rawBody)).digest();
    if (expected.length !== provided.length) continue;
    // Constant-time comparison - a mismatch must not leak how much matched.
    if (crypto.timingSafeEqual(expected, provided)) {
      return { valid: true, layout: layout.name, reason: null };
    }
  }

  return { valid: false, layout: null, reason: 'SIGNATURE_MISMATCH' };
};

const authHeaders = (creds) => ({
  'Content-Type': 'application/json',
  'x-api-key': creds.apiKey,
  'x-business-id': creds.businessId,
  'x-business-env': creds.environment
});

/**
 * Single request helper. No automatic retries: the idempotency behaviour of
 * `reference` is undocumented, so a retried write could double-act.
 */
const nexapayFetch = async (creds, method, path, body) => {
  if (!creds || !creds.apiKey || !creds.businessId) {
    throw new Error('NexaPay is not configured for this school');
  }
  if (!NEXAPAY_ENVIRONMENTS.includes(creds.environment)) {
    throw new Error('Invalid NexaPay environment');
  }

  const url = `${config.nexapay.baseUrl.replace(/\/$/, '')}${path}`;

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: authHeaders(creds),
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000)
    });
  } catch (error) {
    logger.error('NexaPay request failed', { method, path, message: error.message });
    const networkError = new Error('Payment provider is unreachable');
    networkError.statusCode = 502;
    throw networkError;
  }

  // Any provider failure is a bad gateway from our caller's point of view. In
  // particular a NexaPay 401 must not reach our frontend as a 401, which it
  // would read as "your session expired".

  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    // Non-JSON error body - fall through to the status handling below.
  }

  if (!res.ok || json.success === false) {
    const message = json.msg || `NexaPay request failed with status ${res.status}`;
    logger.warn('NexaPay API error', { method, path, status: res.status, message });
    const error = new Error(message);
    error.statusCode = 502;
    error.providerStatus = res.status;
    throw error;
  }

  return json;
};

/**
 * Create a customer-facing virtual account for a bank transfer collection.
 * `amountKobo` is converted to naira here - the only place the two currencies meet.
 */
const createVirtualAccount = async (creds, {
  amountKobo,
  reference,
  merchantCustomerId,
  merchantReference,
  validityTime,
  customerName,
  customerEmail,
  customerPhone,
  metadata
}) => {
  const body = {
    businessId: creds.businessId,
    amount: Naira(amountKobo),
    reference,
    merchantCustomerId,
    merchantReference
  };
  if (validityTime) body.validityTime = validityTime;
  if (customerName) body.customerName = customerName;
  if (customerEmail) body.customerEmail = customerEmail;
  if (customerPhone) body.customerPhone = customerPhone;
  if (metadata) body.metadata = metadata;
  // amountValidation is intentionally not sent: the accepted values and their
  // casing are not documented, and an invalid value would fail the request.

  return nexapayFetch(creds, 'POST', '/virtual-account/create', body);
};

/** Change the expected collection amount on an active virtual account session. */
const updateVirtualAccountAmount = async (creds, reference, amountKobo) => {
  return nexapayFetch(creds, 'POST', '/virtual-account/amountupdate', {
    reference,
    amount: Naira(amountKobo)
  });
};

/**
 * Details of a single wallet transaction, keyed by the NexaPay transaction id
 * (the `transactionId` of a deposit.received event), not by our reference.
 * Response: { success, transaction: { id, amount, status, reference, environment, ... } }
 */
const getTransaction = async (creds, transactionId) => {
  return nexapayFetch(creds, 'GET', `/transactions/${encodeURIComponent(transactionId)}`);
};

/**
 * Most recent wallet transactions (collections, withdrawals, refunds).
 * Response: { success, transactions: [{ id, amount, status, reference, environment, ... }] }
 */
const listTransactions = async (creds, { limit = 200 } = {}) => {
  return nexapayFetch(creds, 'GET', `/transactions?limit=${encodeURIComponent(limit)}`);
};

/** Verify and link the merchant settlement bank account. */
const verifySettlementBank = async (creds, accountNumber, bankCode) => {
  return nexapayFetch(creds, 'POST', '/bank/verify', { accountNumber, bankCode });
};

/**
 * Withdraw from the merchant NGN wallet to the verified settlement account.
 * Minimum N1,000 per the provider docs. No automatic retries - a retried
 * payout could move real money twice.
 */
const requestPayout = async (creds, amountKobo) => {
  return nexapayFetch(creds, 'POST', '/withdrawal/request', {
    businessId: creds.businessId,
    amount: Naira(amountKobo)
  });
};

module.exports = {
  NEXAPAY_ENVIRONMENTS,
  SIGNATURE_LAYOUTS,
  DEFAULT_TOLERANCE_MS,
  Naira,
  Kobo,
  parseTimestampMs,
  decodeSignature,
  describeSignature,
  verifyWebhookSignature,
  createVirtualAccount,
  updateVirtualAccountAmount,
  getTransaction,
  listTransactions,
  verifySettlementBank,
  requestPayout
};
