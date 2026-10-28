/**
 * NexaPay webhook route tests: the HTTP contract NexaPay sees.
 */

const request = require('supertest');
const express = require('express');

jest.mock('../../services/nexapayWebhookService', () => {
  class WebhookAuthError extends Error {
    constructor(reason) { super('Unauthorized'); this.reason = reason; }
  }
  class WebhookPayloadError extends Error {
    constructor(reason) { super(reason); this.reason = reason; }
  }
  return { handleWebhook: jest.fn(), WebhookAuthError, WebhookPayloadError };
});

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const webhookService = require('../../services/nexapayWebhookService');
const nexapayWebhookRoutes = require('../nexapayWebhook');

const buildApp = () => {
  const app = express();
  app.use('/api/fees/nexapay/webhook', nexapayWebhookRoutes);
  // Mirrors app.js: the JSON parser comes after the webhook mount.
  app.use(express.json());
  return app;
};

describe('POST /api/fees/nexapay/webhook', () => {
  it('should hand the exact raw bytes to the service', async () => {
    webhookService.handleWebhook.mockResolvedValue({ received: true, eventId: 'evt_1' });
    const body = '{"event":"deposit.received",  "data":{}}';

    const response = await request(buildApp())
      .post('/api/fees/nexapay/webhook')
      .set('Content-Type', 'application/json')
      .send(body);

    expect(response.status).toBe(200);
    const { rawBody } = webhookService.handleWebhook.mock.calls[0][0];
    expect(Buffer.isBuffer(rawBody)).toBe(true);
    expect(rawBody.toString('utf8')).toBe(body);
  });

  it('should keep the raw bytes for an unexpected content type', async () => {
    webhookService.handleWebhook.mockResolvedValue({ received: true });

    await request(buildApp())
      .post('/api/fees/nexapay/webhook')
      .set('Content-Type', 'text/plain')
      .send('{"event":"deposit.received"}');

    const { rawBody } = webhookService.handleWebhook.mock.calls[0][0];
    expect(rawBody.toString('utf8')).toBe('{"event":"deposit.received"}');
  });

  it('should answer a bare 401 for every authentication failure', async () => {
    const app = buildApp();

    webhookService.handleWebhook.mockRejectedValueOnce(new webhookService.WebhookAuthError('UNKNOWN_BUSINESS'));
    const unknown = await request(app).post('/api/fees/nexapay/webhook').set('Content-Type', 'application/json').send('{}');

    webhookService.handleWebhook.mockRejectedValueOnce(new webhookService.WebhookAuthError('SIGNATURE_MISMATCH'));
    const badSignature = await request(app).post('/api/fees/nexapay/webhook').set('Content-Type', 'application/json').send('{}');

    expect(unknown.status).toBe(401);
    expect(badSignature.status).toBe(401);
    expect(unknown.text).toBe('');
    expect(badSignature.text).toBe(unknown.text);
  });

  it('should answer 400 for a malformed delivery', async () => {
    webhookService.handleWebhook.mockRejectedValue(new webhookService.WebhookPayloadError('Invalid JSON'));

    const response = await request(buildApp())
      .post('/api/fees/nexapay/webhook')
      .set('Content-Type', 'application/json')
      .send('not json');

    expect(response.status).toBe(400);
  });

  it('should answer 500 so NexaPay retries when processing fails', async () => {
    webhookService.handleWebhook.mockRejectedValue(new Error('database is down'));

    const response = await request(buildApp())
      .post('/api/fees/nexapay/webhook')
      .set('Content-Type', 'application/json')
      .send('{}');

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Webhook processing failed');
  });

  it('should answer 200 for a duplicate delivery', async () => {
    webhookService.handleWebhook.mockResolvedValue({ received: true, duplicate: true, eventId: 'evt_1' });

    const response = await request(buildApp())
      .post('/api/fees/nexapay/webhook')
      .set('Content-Type', 'application/json')
      .send('{}');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({ duplicate: true }));
  });
});
