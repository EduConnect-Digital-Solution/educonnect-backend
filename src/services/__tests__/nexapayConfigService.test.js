/**
 * NexaPay configuration tests.
 *
 * Secrets are encrypted before they reach the database and never come back
 * out through the public view. The API key must match the environment it is
 * saved under, because NexaPay chooses the mode from the key prefix.
 */

jest.mock('../../config/database', () => ({
  prisma: {
    nexaPayConfig: { upsert: jest.fn(), findUnique: jest.fn() }
  },
  connectDB: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('../nexapayService', () => ({
  listTransactions: jest.fn()
}));

const { prisma } = require('../../config/database');
const logger = require('../../utils/logger');
const nexapayService = require('../nexapayService');
const nexapayConfigService = require('../nexapayConfigService');

const VALID = {
  businessId: 'biz_123',
  environment: 'test',
  apiKey: 'nexa-test-abc123',
  webhookSecret: 'whsec_abc123'
};

describe('nexapayConfigService.upsert', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.nexaPayConfig.upsert.mockResolvedValue({});
    nexapayService.listTransactions.mockResolvedValue({ success: true, transactions: [] });
  });

  it('should check the key against NexaPay before saving', async () => {
    await nexapayConfigService.upsert('school-1', VALID);

    expect(nexapayService.listTransactions).toHaveBeenCalledWith(
      { businessId: 'biz_123', environment: 'test', apiKey: 'nexa-test-abc123' },
      { limit: 1 }
    );
  });

  it('should refuse credentials NexaPay rejects, so a business id cannot be squatted', async () => {
    nexapayService.listTransactions.mockRejectedValue(
      Object.assign(new Error('Invalid API key'), { statusCode: 502, providerStatus: 401 })
    );

    await expect(nexapayConfigService.upsert('school-1', VALID)).rejects.toThrow(/Invalid NexaPay credentials/);
    expect(prisma.nexaPayConfig.upsert).not.toHaveBeenCalled();
  });

  it('should not save when NexaPay cannot be reached', async () => {
    nexapayService.listTransactions.mockRejectedValue(
      Object.assign(new Error('Payment provider is unreachable'), { statusCode: 502 })
    );

    const error = await nexapayConfigService.upsert('school-1', VALID).catch((e) => e);

    expect(error.statusCode).toBe(502);
    expect(prisma.nexaPayConfig.upsert).not.toHaveBeenCalled();
  });

  it('should store the secrets encrypted', async () => {
    await nexapayConfigService.upsert('school-1', VALID);

    const { create } = prisma.nexaPayConfig.upsert.mock.calls[0][0];
    expect(create.apiKeyEnc).toBeDefined();
    expect(create.apiKeyEnc).not.toContain(VALID.apiKey);
    expect(create.webhookSecretEnc).not.toContain(VALID.webhookSecret);
  });

  it('should never return or log a secret', async () => {
    const result = await nexapayConfigService.upsert('school-1', VALID);

    const exposed = JSON.stringify([result, logger.info.mock.calls]);
    expect(exposed).not.toContain(VALID.apiKey);
    expect(exposed).not.toContain(VALID.webhookSecret);
  });

  it('should refuse a live key saved under the test environment', async () => {
    await expect(
      nexapayConfigService.upsert('school-1', { ...VALID, apiKey: 'nexa-prod-abc123' })
    ).rejects.toThrow(/test key must start with nexa-test-/);
    expect(prisma.nexaPayConfig.upsert).not.toHaveBeenCalled();
  });

  it('should refuse a test key saved under the prod environment', async () => {
    await expect(
      nexapayConfigService.upsert('school-1', { ...VALID, environment: 'prod' })
    ).rejects.toThrow(/prod key must start with nexa-prod-/);
  });

  it('should report a business id that is already linked to another school', async () => {
    prisma.nexaPayConfig.upsert.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));

    await expect(nexapayConfigService.upsert('school-2', VALID)).rejects.toThrow(/already linked to another school/);
  });

  it('should round-trip the credentials for internal use', async () => {
    await nexapayConfigService.upsert('school-1', VALID);
    const { create } = prisma.nexaPayConfig.upsert.mock.calls[0][0];
    prisma.nexaPayConfig.findUnique.mockResolvedValue(create);

    const creds = await nexapayConfigService.getByBusinessId('biz_123');

    expect(creds).toEqual(expect.objectContaining({ apiKey: VALID.apiKey, webhookSecret: VALID.webhookSecret }));
  });
});
