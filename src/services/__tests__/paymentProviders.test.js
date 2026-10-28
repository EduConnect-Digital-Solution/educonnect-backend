/**
 * Payment provider client tests: how provider failures surface, the NexaPay
 * request shape, and the Paystack webhook signature check.
 */

const crypto = require('crypto');
const config = require('../../config');
const nexapayService = require('../nexapayService');
const paystackService = require('../paystackService');

const CREDS = { businessId: 'biz_123', environment: 'test', apiKey: 'nexa-test-key' };

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body),
  json: async () => body
});

const realFetch = global.fetch;

afterEach(() => {
  global.fetch = realFetch;
});

describe('NexaPay client', () => {
  it('should send the merchant headers and convert kobo to naira', async () => {
    global.fetch = jest.fn(async () => jsonResponse(200, { success: true }));

    await nexapayService.createVirtualAccount(CREDS, {
      amountKobo: 500000,
      reference: 'nxa_1',
      merchantCustomerId: 'student-1',
      merchantReference: 'invoice-1'
    });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe(`${config.nexapay.baseUrl}/virtual-account/create`);
    expect(options.headers).toEqual(expect.objectContaining({
      'x-api-key': 'nexa-test-key',
      'x-business-id': 'biz_123',
      'x-business-env': 'test'
    }));
    expect(JSON.parse(options.body)).toEqual(expect.objectContaining({ businessId: 'biz_123', amount: 5000 }));
  });

  it('should surface a provider 401 as a 502, not as our own 401', async () => {
    global.fetch = jest.fn(async () => jsonResponse(401, { success: false, msg: 'Invalid API key' }));

    const error = await nexapayService.getTransaction(CREDS, 'txn_1').catch((e) => e);

    expect(error.message).toBe('Invalid API key');
    expect(error.statusCode).toBe(502);
    expect(error.providerStatus).toBe(401);
  });

  it('should surface a network failure as a 502', async () => {
    global.fetch = jest.fn(async () => { throw new Error('ECONNRESET'); });

    const error = await nexapayService.listTransactions(CREDS).catch((e) => e);

    expect(error.statusCode).toBe(502);
    expect(error.message).toBe('Payment provider is unreachable');
  });

  it('should key transaction details by the NexaPay transaction id', async () => {
    global.fetch = jest.fn(async () => jsonResponse(200, { success: true, transaction: {} }));

    await nexapayService.getTransaction(CREDS, 'txn/1');

    expect(global.fetch.mock.calls[0][0]).toBe(`${config.nexapay.baseUrl}/transactions/txn%2F1`);
  });

  it('should describe a signature without revealing it', () => {
    const signature = 'ab'.repeat(32);
    const described = nexapayService.describeSignature(signature);

    expect(described).toEqual({ present: true, length: 64, prefixed: false, encoding: 'hex' });
    expect(JSON.stringify(described)).not.toContain(signature);
    expect(nexapayService.describeSignature(undefined)).toEqual({ present: false });
  });
});

describe('Paystack client', () => {
  const originalKey = config.paystack.secretKey;

  beforeAll(() => {
    config.paystack.secretKey = 'sk_test_secret';
  });

  afterAll(() => {
    config.paystack.secretKey = originalKey;
  });

  it('should accept a valid webhook signature', () => {
    const body = Buffer.from('{"event":"charge.success"}');
    const signature = crypto.createHmac('sha512', 'sk_test_secret').update(body).digest('hex');

    expect(paystackService.verifyWebhookSignature(body, signature)).toBe(true);
  });

  it('should reject a wrong or malformed webhook signature', () => {
    const body = Buffer.from('{"event":"charge.success"}');

    expect(paystackService.verifyWebhookSignature(body, 'a'.repeat(128))).toBe(false);
    expect(paystackService.verifyWebhookSignature(body, 'short')).toBe(false);
    expect(paystackService.verifyWebhookSignature(body, undefined)).toBe(false);
  });

  it('should surface a network failure as a 502', async () => {
    global.fetch = jest.fn(async () => { throw new Error('ETIMEDOUT'); });

    const error = await paystackService.verifyTransaction('psk_1').catch((e) => e);

    expect(error.statusCode).toBe(502);
    expect(error.message).toBe('Payment provider is unreachable');
  });

  it('should surface a provider 401 as a 502', async () => {
    global.fetch = jest.fn(async () => jsonResponse(401, { status: false, message: 'Invalid key' }));

    const error = await paystackService.verifyTransaction('psk_1').catch((e) => e);

    expect(error.statusCode).toBe(502);
    expect(error.providerStatus).toBe(401);
  });
});
