/**
 * Fee controller error mapping tests.
 *
 * Service errors carry either an explicit statusCode (payment providers) or a
 * message that the controller maps to a status.
 */

jest.mock('../../services/feeService', () => ({
  initializePayment: jest.fn(),
  verifyPayment: jest.fn()
}));

jest.mock('../../services/nexapayConfigService', () => ({
  upsert: jest.fn(),
  getPublicConfig: jest.fn()
}));

jest.mock('express-validator', () => ({
  validationResult: () => ({ isEmpty: () => true, array: () => [] })
}));

const feeService = require('../../services/feeService');
const nexapayConfigService = require('../../services/nexapayConfigService');
const feeController = require('../feeController');

const mockResponse = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const request = (overrides = {}) => ({
  params: { invoiceId: 'invoice-1' },
  body: { gateway: 'nexapay' },
  query: {},
  user: { id: 'admin-1', role: 'admin', schoolId: 'school-1' },
  ...overrides
});

const errorWith = (message, statusCode) => Object.assign(new Error(message), statusCode ? { statusCode } : {});

describe('feeController error mapping', () => {
  it('should pass a provider failure through as 502', async () => {
    feeService.initializePayment.mockRejectedValue(errorWith('Payment provider is unreachable', 502));
    const res = mockResponse();

    await feeController.initializePayment(request(), res);

    expect(res.status).toHaveBeenCalledWith(502);
  });

  it('should answer 400 when the school has no NexaPay configuration', async () => {
    feeService.initializePayment.mockRejectedValue(errorWith('NexaPay is not configured for this school', 400));
    const res = mockResponse();

    await feeController.initializePayment(request(), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should answer 400 when the amount exceeds the balance', async () => {
    feeService.initializePayment.mockRejectedValue(errorWith('Payment amount exceeds the amount due'));
    const res = mockResponse();

    await feeController.initializePayment(request(), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should keep the message based mapping for errors without a status', async () => {
    feeService.verifyPayment.mockRejectedValue(errorWith('Payment not found for this reference'));
    const res = mockResponse();

    await feeController.verifyPayment(request(), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should answer 409 when a NexaPay business is already linked to another school', async () => {
    nexapayConfigService.upsert.mockRejectedValue(errorWith('This NexaPay business ID is already linked to another school'));
    const res = mockResponse();

    await feeController.upsertNexaPayConfig(request({ body: { businessId: 'biz', environment: 'test' } }), res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('should take the school from the session, not the body, for a school admin', async () => {
    nexapayConfigService.upsert.mockResolvedValue({ configured: true });
    const res = mockResponse();

    await feeController.upsertNexaPayConfig(request({
      body: { schoolId: 'school-2', businessId: 'biz', environment: 'test', apiKey: 'k', webhookSecret: 's' }
    }), res);

    expect(nexapayConfigService.upsert).toHaveBeenCalledWith('school-1', expect.any(Object));
  });
});
