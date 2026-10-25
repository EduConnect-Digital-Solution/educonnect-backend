/**
 * Payment initialisation validation tests.
 */

const { validationResult } = require('express-validator');
const { validateInitializePayment } = require('../feeValidation');

const INVOICE_ID = '8f14e45f-ceea-4b6b-9b6a-2f1c3d4e5f60';

const validate = async (body) => {
  const req = { params: { invoiceId: INVOICE_ID }, body, query: {}, headers: {} };
  await Promise.all(validateInitializePayment.map((rule) => rule.run(req)));
  return { errors: validationResult(req).array(), body: req.body };
};

describe('validateInitializePayment', () => {
  it('should accept a NexaPay collection without amount or email', async () => {
    const { errors } = await validate({ gateway: 'nexapay' });
    expect(errors).toHaveLength(0);
  });

  it('should accept a numeric string and convert it to a number', async () => {
    const { errors, body } = await validate({ gateway: 'nexapay', amount: '150000' });
    expect(errors).toHaveLength(0);
    expect(body.amount).toBe(150000);
  });

  it.each([true, [5], '1e3', '0x10', 0, -5, 1.5, '12.5'])('should reject the amount %p', async (amount) => {
    const { errors } = await validate({ gateway: 'nexapay', amount });
    expect(errors.map((e) => e.path)).toContain('amount');
  });

  it('should still require amount and email for Paystack', async () => {
    const { errors } = await validate({ gateway: 'paystack' });
    expect(errors.map((e) => e.path)).toEqual(expect.arrayContaining(['amount', 'email']));
  });
});
