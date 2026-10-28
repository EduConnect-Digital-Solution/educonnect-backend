/**
 * NexaPay webhook tests.
 *
 * The webhook is the only path where money moves without a user in the loop,
 * so these tests focus on the contract: nothing is trusted before the HMAC
 * passes, an unknown business and a bad signature are indistinguishable, the
 * event row and the business effect commit together, and a replayed event
 * settles nothing twice.
 *
 * Deliveries run end to end through settleDeposit against an in-memory Prisma
 * fake, so the assertions are on the resulting invoice and payment rows.
 */

const crypto = require('crypto');

jest.mock('../../config/database', () => {
  const holder = { fake: null };
  // Services destructure `prisma` at require time; the proxy lets each test
  // swap in a fresh fake behind that reference.
  const prisma = new Proxy({}, { get: (_, key) => holder.fake.prisma[key] });
  return { prisma, holder, connectDB: jest.fn() };
});

jest.mock('../nexapayConfigService', () => ({
  getBySchoolId: jest.fn(),
  getByBusinessId: jest.fn(),
  getPublicConfig: jest.fn(),
  upsert: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const { holder } = require('../../config/database');
const config = require('../../config');
const logger = require('../../utils/logger');
const nexapayConfigService = require('../nexapayConfigService');
const webhookService = require('../nexapayWebhookService');
const { createFakePrisma } = require('./fakePrisma.fixture');

const SCHOOL_ID = 'school-1';
const OTHER_SCHOOL_ID = 'school-2';
const BUSINESS_ID = 'biz_123';
const WEBHOOK_SECRET = 'whsec_test_secret';

const CREDENTIALS = {
  schoolId: SCHOOL_ID,
  businessId: BUSINESS_ID,
  environment: 'test',
  apiKey: 'nexa-test-key',
  webhookSecret: WEBHOOK_SECRET
};

const sign = (body, timestamp, secret = WEBHOOK_SECRET) =>
  crypto
    .createHmac('sha256', secret)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), body]))
    .digest('hex');

// Mirrors the deposit.received example in the NexaPay webhook docs.
const buildDelivery = (overrides = {}) => {
  const envelope = {
    event: 'deposit.received',
    eventId: 'evt_1',
    businessId: BUSINESS_ID,
    businessName: 'Test School',
    environment: 'test',
    occurredAt: new Date().toISOString(),
    data: {
      transactionId: 'txn_1',
      reference: 'nxa_session_1',
      accountNumber: '0123456789',
      amount: 5000,
      senderName: 'Ada Lovelace',
      senderAccount: '9999999999',
      senderBank: 'Sender Bank',
      balanceAfter: 5000,
      status: 'successful',
      merchantCustomerId: 'student-1',
      merchantReference: 'invoice-1',
      ...overrides.data
    },
    ...overrides.envelope
  };

  const rawBody = Buffer.from(JSON.stringify(envelope));
  const timestamp = String(Math.floor(Date.now() / 1000));

  const headers = {
    'x-nexapay-business-id': BUSINESS_ID,
    'x-nexapay-signature': sign(rawBody, timestamp),
    'x-nexapay-timestamp': timestamp,
    'x-nexapay-event': envelope.event,
    'x-nexapay-event-id': envelope.eventId,
    ...overrides.headers
  };
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) delete headers[name];
  }

  return { rawBody, headers };
};

const invoiceRow = (overrides = {}) => ({
  id: 'invoice-1',
  schoolId: SCHOOL_ID,
  studentId: 'student-1',
  amount: 500000,
  amountPaid: 0,
  amountDue: 500000,
  status: 'pending',
  isActive: true,
  ...overrides
});

const sessionRow = (overrides = {}) => ({
  id: 'session-1',
  schoolId: SCHOOL_ID,
  invoiceId: 'invoice-1',
  gateway: 'nexapay',
  gatewayReference: 'nxa_session_1',
  amount: 500000,
  status: 'pending',
  ...overrides
});

const useFake = (seed) => {
  holder.fake = createFakePrisma(seed);
  return holder.fake;
};

const invoiceById = (fake, id) => fake.getState().invoices.find((i) => i.id === id);

describe('NexaPay webhook service', () => {
  beforeEach(() => {
    nexapayConfigService.getByBusinessId.mockResolvedValue(CREDENTIALS);
    useFake({ invoices: [invoiceRow()], payments: [sessionRow()] });
  });

  describe('authentication', () => {
    it('should reject an unknown business id', async () => {
      nexapayConfigService.getByBusinessId.mockResolvedValue(null);

      await expect(webhookService.handleWebhook(buildDelivery())).rejects.toThrow(
        webhookService.WebhookAuthError
      );
      expect(holder.fake.prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should reject a bad signature', async () => {
      const delivery = buildDelivery({ headers: { 'x-nexapay-signature': 'a'.repeat(64) } });

      await expect(webhookService.handleWebhook(delivery)).rejects.toThrow(
        webhookService.WebhookAuthError
      );
      expect(holder.fake.prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should reject a signature made with another school\'s secret', async () => {
      const delivery = buildDelivery();
      delivery.headers['x-nexapay-signature'] = sign(
        delivery.rawBody,
        delivery.headers['x-nexapay-timestamp'],
        'whsec_other_school'
      );

      await expect(webhookService.handleWebhook(delivery)).rejects.toThrow(
        webhookService.WebhookAuthError
      );
    });

    it('should reject a tampered body', async () => {
      const delivery = buildDelivery();
      delivery.rawBody = Buffer.from(delivery.rawBody.toString('utf8').replace('"amount":5000', '"amount":9000'));

      await expect(webhookService.handleWebhook(delivery)).rejects.toThrow(
        webhookService.WebhookAuthError
      );
      expect(invoiceById(holder.fake, 'invoice-1').amountPaid).toBe(0);
    });

    it('should fail an unknown business and a bad signature the same way', async () => {
      nexapayConfigService.getByBusinessId.mockResolvedValue(null);
      const unknownError = await webhookService.handleWebhook(buildDelivery()).catch((e) => e);

      nexapayConfigService.getByBusinessId.mockResolvedValue(CREDENTIALS);
      const badSignature = buildDelivery({ headers: { 'x-nexapay-signature': 'a'.repeat(64) } });
      const signatureError = await webhookService.handleWebhook(badSignature).catch((e) => e);

      expect(unknownError.constructor).toBe(signatureError.constructor);
      expect(unknownError.message).toBe(signatureError.message);
    });

    it('should reject a delivery with missing signature headers', async () => {
      await expect(
        webhookService.handleWebhook({ rawBody: Buffer.from('{}'), headers: {} })
      ).rejects.toThrow(webhookService.WebhookAuthError);
    });

    it('should reject a body that belongs to a different business', async () => {
      const delivery = buildDelivery({ envelope: { businessId: 'biz_other' } });

      await expect(webhookService.handleWebhook(delivery)).rejects.toThrow(
        webhookService.WebhookAuthError
      );
    });

    it('should fall back to the body businessId when the header is absent', async () => {
      const delivery = buildDelivery({ headers: { 'x-nexapay-business-id': undefined } });

      const result = await webhookService.handleWebhook(delivery);

      expect(nexapayConfigService.getByBusinessId).toHaveBeenCalledWith(BUSINESS_ID);
      expect(result).toEqual({ received: true, eventId: 'evt_1' });
    });

    it('should still require a valid signature when the business id came from the body', async () => {
      const delivery = buildDelivery({
        headers: { 'x-nexapay-business-id': undefined, 'x-nexapay-signature': 'b'.repeat(64) }
      });

      await expect(webhookService.handleWebhook(delivery)).rejects.toThrow(
        webhookService.WebhookAuthError
      );
    });
  });

  describe('processing', () => {
    it('should record the event and settle the invoice in one transaction', async () => {
      const result = await webhookService.handleWebhook(buildDelivery());

      expect(result).toEqual({ received: true, eventId: 'evt_1' });
      expect(holder.fake.prisma.$transaction).toHaveBeenCalledTimes(1);

      const state = holder.fake.getState();
      expect(state.events).toEqual([
        expect.objectContaining({ provider: 'nexapay', eventId: 'evt_1', eventType: 'deposit.received', schoolId: SCHOOL_ID })
      ]);
      // 5,000 naira from NexaPay is 500,000 kobo in the ledger.
      expect(invoiceById(holder.fake, 'invoice-1')).toEqual(expect.objectContaining({
        amountPaid: 500000,
        amountDue: 0,
        status: 'paid'
      }));
      expect(state.payments[0]).toEqual(expect.objectContaining({
        id: 'session-1',
        status: 'confirmed',
        providerTxnId: 'txn_1',
        amount: 500000
      }));
    });

    it('should make a duplicate delivery a no-op', async () => {
      await webhookService.handleWebhook(buildDelivery());
      const replay = await webhookService.handleWebhook(buildDelivery());

      expect(replay).toEqual({ received: true, duplicate: true, eventId: 'evt_1' });
      expect(invoiceById(holder.fake, 'invoice-1').amountPaid).toBe(500000);
      expect(holder.fake.getState().ledger).toHaveLength(1);
    });

    it('should mark the invoice paid once when several deliveries arrive together', async () => {
      const results = await Promise.all([
        webhookService.handleWebhook(buildDelivery()),
        webhookService.handleWebhook(buildDelivery()),
        webhookService.handleWebhook(buildDelivery())
      ]);

      expect(results.filter((r) => r.duplicate)).toHaveLength(2);
      expect(invoiceById(holder.fake, 'invoice-1')).toEqual(expect.objectContaining({ amountPaid: 500000, status: 'paid' }));
      expect(holder.fake.getState().ledger).toHaveLength(1);
    });

    it('should not settle twice when the same deposit arrives under a new event id', async () => {
      await webhookService.handleWebhook(buildDelivery());
      const again = await webhookService.handleWebhook(
        buildDelivery({ envelope: { eventId: 'evt_2' }, headers: { 'x-nexapay-event-id': 'evt_2' } })
      );

      expect(again).toEqual({ received: true, eventId: 'evt_2' });
      expect(invoiceById(holder.fake, 'invoice-1').amountPaid).toBe(500000);
      expect(holder.fake.getState().ledger).toHaveLength(1);
    });

    it('should prefer the signed body eventId over the unsigned header', async () => {
      await webhookService.handleWebhook(buildDelivery());
      // Same signed body, header id changed in transit: still the same event.
      const replay = await webhookService.handleWebhook(
        buildDelivery({ headers: { 'x-nexapay-event-id': 'evt_forged' } })
      );

      expect(replay).toEqual({ received: true, duplicate: true, eventId: 'evt_1' });
    });

    it('should move PARTIAL to PAID across two deposits', async () => {
      await webhookService.handleWebhook(buildDelivery({ data: { amount: 2000 } }));
      expect(invoiceById(holder.fake, 'invoice-1')).toEqual(expect.objectContaining({
        amountPaid: 200000,
        amountDue: 300000,
        status: 'partial'
      }));

      await webhookService.handleWebhook(buildDelivery({
        envelope: { eventId: 'evt_2' },
        headers: { 'x-nexapay-event-id': 'evt_2' },
        data: { transactionId: 'txn_2', amount: 3000 }
      }));
      expect(invoiceById(holder.fake, 'invoice-1')).toEqual(expect.objectContaining({
        amountPaid: 500000,
        amountDue: 0,
        status: 'paid'
      }));
    });

    it('should ignore an event for a different environment', async () => {
      const result = await webhookService.handleWebhook(buildDelivery({ envelope: { environment: 'prod' } }));

      expect(result).toEqual({ received: true, ignored: true });
      expect(holder.fake.prisma.$transaction).not.toHaveBeenCalled();
      expect(invoiceById(holder.fake, 'invoice-1').amountPaid).toBe(0);
    });

    it('should ignore an event that does not say which environment it is from', async () => {
      const result = await webhookService.handleWebhook(buildDelivery({ envelope: { environment: undefined } }));

      expect(result).toEqual({ received: true, ignored: true });
      expect(invoiceById(holder.fake, 'invoice-1').amountPaid).toBe(0);
    });

    it('should flag an unmatched deposit for review', async () => {
      useFake({ invoices: [invoiceRow()] });

      await webhookService.handleWebhook(buildDelivery({
        data: { reference: 'nxa_unknown', merchantReference: 'invoice-unknown' }
      }));

      expect(holder.fake.getState().payments).toEqual([
        expect.objectContaining({ invoiceId: null, needsReview: true, reviewReason: 'NO_MATCHING_INVOICE' })
      ]);
      expect(invoiceById(holder.fake, 'invoice-1').amountPaid).toBe(0);
    });

    it('should flag an overpaid deposit for review', async () => {
      await webhookService.handleWebhook(buildDelivery({ data: { amount: 6000 } }));

      expect(holder.fake.getState().payments[0]).toEqual(expect.objectContaining({
        needsReview: true,
        reviewReason: 'OVERPAID'
      }));
    });

    it('should not let an event for school A affect school B', async () => {
      useFake({
        invoices: [invoiceRow({ id: 'invoice-b', schoolId: OTHER_SCHOOL_ID })],
        payments: [sessionRow({ id: 'session-b', schoolId: OTHER_SCHOOL_ID, invoiceId: 'invoice-b' })]
      });

      await webhookService.handleWebhook(buildDelivery({ data: { merchantReference: 'invoice-b' } }));

      expect(invoiceById(holder.fake, 'invoice-b').amountPaid).toBe(0);
      const sessionB = holder.fake.getState().payments.find((p) => p.id === 'session-b');
      expect(sessionB.status).toBe('pending');
    });

    it('should record a deposit that is not settled without crediting anything', async () => {
      await webhookService.handleWebhook(buildDelivery({ data: { status: 'pending' } }));

      expect(holder.fake.getState().events).toHaveLength(1);
      expect(invoiceById(holder.fake, 'invoice-1').amountPaid).toBe(0);
    });

    it('should roll back the event row when processing fails so the retry is clean', async () => {
      holder.fake.tx.feeLedgerEntry.create.mockRejectedValueOnce(new Error('database is down'));

      await expect(webhookService.handleWebhook(buildDelivery())).rejects.toThrow('database is down');
      expect(holder.fake.getState().events).toHaveLength(0);
      expect(invoiceById(holder.fake, 'invoice-1').amountPaid).toBe(0);

      // NexaPay retries the same event and it now goes through.
      const retry = await webhookService.handleWebhook(buildDelivery());
      expect(retry).toEqual({ received: true, eventId: 'evt_1' });
      expect(invoiceById(holder.fake, 'invoice-1').amountPaid).toBe(500000);
    });

    it('should hold a verified deposit with an unreadable amount instead of dropping it', async () => {
      const result = await webhookService.handleWebhook(buildDelivery({ data: { amount: 'lots' } }));

      expect(result).toEqual({ received: true, eventId: 'evt_1' });
      const state = holder.fake.getState();
      expect(state.events).toHaveLength(1);
      expect(state.payments).toContainEqual(expect.objectContaining({
        amount: 0,
        status: 'pending',
        needsReview: true,
        reviewReason: 'INVALID_AMOUNT',
        invoiceId: null
      }));
      // The open session is left alone and nothing is credited.
      expect(state.payments.find((p) => p.id === 'session-1').status).toBe('pending');
      expect(invoiceById(holder.fake, 'invoice-1').amountPaid).toBe(0);
    });

    it('should only record withdrawal events', async () => {
      const result = await webhookService.handleWebhook(buildDelivery({
        envelope: { event: 'withdrawal.completed', eventId: 'evt_w1' },
        headers: { 'x-nexapay-event-id': 'evt_w1' }
      }));

      expect(result).toEqual({ received: true, eventId: 'evt_w1' });
      expect(holder.fake.getState().events).toHaveLength(1);
      expect(invoiceById(holder.fake, 'invoice-1').amountPaid).toBe(0);
    });
  });

  describe('debug logging', () => {
    afterEach(() => {
      config.nexapay.debugWebhooks = false;
    });

    it('should never log the signature or the secret', async () => {
      config.nexapay.debugWebhooks = true;
      const delivery = buildDelivery();

      await webhookService.handleWebhook(delivery);

      const logged = JSON.stringify(logger.warn.mock.calls);
      expect(logged).toContain('NexaPay webhook debug delivery');
      expect(logged).not.toContain(delivery.headers['x-nexapay-signature']);
      expect(logged).not.toContain(WEBHOOK_SECRET);
    });

    it('should log nothing about the delivery when the flag is off', async () => {
      await webhookService.handleWebhook(buildDelivery());

      const logged = JSON.stringify(logger.warn.mock.calls);
      expect(logged).not.toContain('NexaPay webhook debug delivery');
    });
  });

  describe('helpers', () => {
    it('should fall back to a body hash when the provider sends no event id', () => {
      const rawBody = Buffer.from(JSON.stringify({ event: 'deposit.received' }));
      const eventId = webhookService.resolveEventId({}, rawBody, {});
      expect(eventId).toMatch(/^sha256:[0-9a-f]{64}$/);
    });

    it('should convert naira to kobo', () => {
      expect(webhookService.toKobo(50000)).toBe(5000000);
      expect(webhookService.toKobo(0.5)).toBe(50);
    });

    it('should reject a missing or invalid amount', () => {
      expect(() => webhookService.toKobo(undefined)).toThrow(webhookService.WebhookPayloadError);
      expect(() => webhookService.toKobo(0)).toThrow(webhookService.WebhookPayloadError);
      expect(() => webhookService.toKobo(-100)).toThrow(webhookService.WebhookPayloadError);
    });
  });
});
