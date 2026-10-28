/**
 * Fee payment settlement tests.
 *
 * Every path that credits an invoice (manual payment, gateway confirmation,
 * adjustment) must move the totals atomically, keep discounts, and never
 * credit the same payment twice. These run against an in-memory Prisma fake.
 */

jest.mock('../../config/database', () => {
  const holder = { fake: null };
  const prisma = new Proxy({}, { get: (_, key) => holder.fake.prisma[key] });
  return { prisma, holder, connectDB: jest.fn() };
});

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('../paystackService', () => ({
  initializeTransaction: jest.fn(),
  verifyTransaction: jest.fn()
}));

jest.mock('../nexapayStrategy', () => ({
  createCollection: jest.fn(),
  verifyCollection: jest.fn()
}));

const { holder } = require('../../config/database');
const paystackService = require('../paystackService');
const nexapayStrategy = require('../nexapayStrategy');
const feeService = require('../feeService');
const { createFakePrisma } = require('./fakePrisma.fixture');

const SCHOOL_ID = 'school-1';

const invoiceRow = (overrides = {}) => ({
  id: 'invoice-1',
  schoolId: SCHOOL_ID,
  studentId: 'student-1',
  invoiceNumber: 'INV-1',
  amount: 500000,
  amountPaid: 0,
  amountDue: 500000,
  status: 'pending',
  isActive: true,
  ...overrides
});

const gatewayPayment = (overrides = {}) => ({
  id: 'payment-psk',
  schoolId: SCHOOL_ID,
  invoiceId: 'invoice-1',
  amount: 500000,
  gateway: 'paystack',
  gatewayReference: 'psk_ref_1',
  status: 'pending',
  ...overrides
});

const useFake = (seed) => {
  holder.fake = createFakePrisma(seed);
  return holder.fake;
};

const invoice = () => holder.fake.getState().invoices[0];

describe('feeService.recordPayment', () => {
  it('should record a partial payment', async () => {
    useFake({ invoices: [invoiceRow()] });

    const result = await feeService.recordPayment('invoice-1', SCHOOL_ID, { amount: 200000, paymentMethod: 'cash' }, 'admin-1');

    expect(result.invoice).toEqual({ id: 'invoice-1', status: 'partial', amountPaid: 200000, amountDue: 300000 });
    expect(invoice()).toEqual(expect.objectContaining({ amountPaid: 200000, amountDue: 300000, status: 'partial' }));
    expect(holder.fake.getState().ledger[0]).toEqual(expect.objectContaining({ balance: 300000 }));
  });

  it('should keep a discount that was already applied', async () => {
    // 100,000 kobo waived: 400,000 settles the invoice.
    useFake({ invoices: [invoiceRow({ amountDue: 400000 })] });

    const result = await feeService.recordPayment('invoice-1', SCHOOL_ID, { amount: 400000, paymentMethod: 'cash' }, 'admin-1');

    expect(result.invoice.status).toBe('paid');
    expect(invoice()).toEqual(expect.objectContaining({ amountPaid: 400000, amountDue: 0, status: 'paid' }));
  });

  it('should roll back when a concurrent payment already took the balance', async () => {
    useFake({ invoices: [invoiceRow({ amountPaid: 400000, amountDue: 100000, status: 'partial' })] });
    // The pre-check reads the invoice before the other payment committed.
    holder.fake.tx.feeInvoice.findFirst.mockImplementationOnce(async () => invoiceRow());

    await expect(
      feeService.recordPayment('invoice-1', SCHOOL_ID, { amount: 500000, paymentMethod: 'cash' }, 'admin-1')
    ).rejects.toThrow('Payment amount exceeds the amount due');

    expect(invoice()).toEqual(expect.objectContaining({ amountPaid: 400000, amountDue: 100000 }));
    expect(holder.fake.getState().payments).toHaveLength(0);
    expect(holder.fake.getState().ledger).toHaveLength(0);
  });

  it('should refuse a payment when the invoice was voided after the check', async () => {
    useFake({ invoices: [invoiceRow({ status: 'void', isActive: false })] });
    holder.fake.tx.feeInvoice.findFirst.mockImplementationOnce(async () => invoiceRow());

    await expect(
      feeService.recordPayment('invoice-1', SCHOOL_ID, { amount: 100000, paymentMethod: 'cash' }, 'admin-1')
    ).rejects.toThrow('Cannot record payment against a voided invoice');
    expect(holder.fake.getState().payments).toHaveLength(0);
  });

  it('should not credit an invoice that belongs to another school', async () => {
    useFake({ invoices: [invoiceRow({ schoolId: 'school-2' })] });

    await expect(
      feeService.recordPayment('invoice-1', SCHOOL_ID, { amount: 100000, paymentMethod: 'cash' }, 'admin-1')
    ).rejects.toThrow('Invoice not found');

    expect(invoice()).toEqual(expect.objectContaining({ amountPaid: 0, amountDue: 500000 }));
    expect(holder.fake.getState().payments).toHaveLength(0);
    expect(holder.fake.getState().ledger).toHaveLength(0);
  });

  it('should not credit another school\'s invoice even if the pre-check were bypassed', async () => {
    useFake({ invoices: [invoiceRow({ schoolId: 'school-2' })] });
    // Defence in depth: the in-transaction update is scoped to the school too.
    holder.fake.tx.feeInvoice.findFirst.mockImplementationOnce(async () => invoiceRow());

    await expect(
      feeService.recordPayment('invoice-1', SCHOOL_ID, { amount: 100000, paymentMethod: 'cash' }, 'admin-1')
    ).rejects.toThrow();
    expect(invoice()).toEqual(expect.objectContaining({ amountPaid: 0, amountDue: 500000 }));
  });

  it('should refuse an amount over the balance up front', async () => {
    useFake({ invoices: [invoiceRow({ amountDue: 100000 })] });

    await expect(
      feeService.recordPayment('invoice-1', SCHOOL_ID, { amount: 200000, paymentMethod: 'cash' }, 'admin-1')
    ).rejects.toThrow('Payment amount exceeds the amount due');
  });
});

describe('feeService.confirmGatewayPayment', () => {
  it('should credit the invoice and issue a receipt', async () => {
    useFake({ invoices: [invoiceRow()], payments: [gatewayPayment()] });

    const confirmed = await feeService.confirmGatewayPayment(gatewayPayment());

    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.receiptNumber).toMatch(/^RCP-/);
    expect(invoice()).toEqual(expect.objectContaining({ amountPaid: 500000, amountDue: 0, status: 'paid' }));
  });

  it('should credit the invoice once when called twice', async () => {
    useFake({ invoices: [invoiceRow()], payments: [gatewayPayment()] });

    await feeService.confirmGatewayPayment(gatewayPayment());
    await feeService.confirmGatewayPayment(gatewayPayment());

    expect(invoice().amountPaid).toBe(500000);
    expect(holder.fake.getState().ledger).toHaveLength(1);
  });

  it('should not credit when another caller claimed the payment first', async () => {
    useFake({
      invoices: [invoiceRow({ amountPaid: 500000, amountDue: 0, status: 'paid' })],
      payments: [gatewayPayment({ status: 'confirmed' })]
    });
    // Both callers read "pending" before either committed.
    holder.fake.tx.feePayment.findUnique.mockImplementationOnce(async () => gatewayPayment());

    await feeService.confirmGatewayPayment(gatewayPayment());

    expect(invoice().amountPaid).toBe(500000);
    expect(holder.fake.getState().ledger).toHaveLength(0);
  });

  it('should keep a discount when confirming', async () => {
    useFake({ invoices: [invoiceRow({ amountDue: 400000 })], payments: [gatewayPayment({ amount: 400000 })] });

    await feeService.confirmGatewayPayment(gatewayPayment({ amount: 400000 }));

    expect(invoice()).toEqual(expect.objectContaining({ amountPaid: 400000, amountDue: 0, status: 'paid' }));
  });

  it('should leave the payment pending and the invoice untouched when a step fails', async () => {
    useFake({ invoices: [invoiceRow()], payments: [gatewayPayment()] });
    holder.fake.tx.feeLedgerEntry.create.mockRejectedValueOnce(new Error('database is down'));

    await expect(feeService.confirmGatewayPayment(gatewayPayment())).rejects.toThrow('database is down');

    // The claim rolled back too, so a retry can still confirm the payment.
    expect(holder.fake.getState().payments[0].status).toBe('pending');
    expect(invoice()).toEqual(expect.objectContaining({ amountPaid: 0, amountDue: 500000, status: 'pending' }));

    await feeService.confirmGatewayPayment(gatewayPayment());
    expect(invoice()).toEqual(expect.objectContaining({ amountPaid: 500000, status: 'paid' }));
  });

  it('should hold a payment for an invoice voided after checkout started', async () => {
    useFake({
      invoices: [invoiceRow({ status: 'void', isActive: false })],
      payments: [gatewayPayment()]
    });

    const held = await feeService.confirmGatewayPayment(gatewayPayment());

    expect(held).toEqual(expect.objectContaining({
      status: 'confirmed',
      invoiceId: null,
      needsReview: true,
      reviewReason: 'INVOICE_VOID'
    }));
    expect(invoice()).toEqual(expect.objectContaining({ status: 'void', amountPaid: 0 }));
    expect(holder.fake.getState().ledger).toHaveLength(0);
  });

  it('should flag an overpayment for review', async () => {
    useFake({
      invoices: [invoiceRow({ amountDue: 100000, amountPaid: 400000, status: 'partial' })],
      payments: [gatewayPayment({ amount: 500000 })]
    });

    const confirmed = await feeService.confirmGatewayPayment(gatewayPayment({ amount: 500000 }));

    expect(confirmed).toEqual(expect.objectContaining({ needsReview: true, reviewReason: 'OVERPAID' }));
    expect(invoice()).toEqual(expect.objectContaining({ amountDue: 0, status: 'paid' }));
  });
});

describe('feeService.applyAdjustment', () => {
  it('should keep a deposit that landed after the adjustment was requested', async () => {
    // A 200,000 deposit already reduced amountDue to 300,000.
    useFake({ invoices: [invoiceRow({ amountPaid: 200000, amountDue: 300000, status: 'partial' })] });
    // The adjustment's own lookup saw the invoice before the deposit.
    holder.fake.tx.feeInvoice.findFirst.mockImplementationOnce(async () => invoiceRow());

    await feeService.applyAdjustment(SCHOOL_ID, {
      studentId: 'student-1',
      invoiceId: 'invoice-1',
      type: 'discount',
      amount: 100000,
      reason: 'Sibling discount'
    }, 'admin-1');

    expect(invoice()).toEqual(expect.objectContaining({ amountPaid: 200000, amountDue: 200000, status: 'partial' }));
  });

  it('should not revive an invoice voided after the check', async () => {
    useFake({ invoices: [invoiceRow({ status: 'void', isActive: false })] });
    holder.fake.tx.feeInvoice.findFirst.mockImplementationOnce(async () => invoiceRow());

    await expect(feeService.applyAdjustment(SCHOOL_ID, {
      studentId: 'student-1',
      invoiceId: 'invoice-1',
      type: 'waiver',
      amount: 500000,
      reason: 'Hardship'
    }, 'admin-1')).rejects.toThrow('Cannot apply an adjustment to a voided invoice');

    expect(invoice()).toEqual(expect.objectContaining({ status: 'void', amountDue: 500000 }));
    expect(holder.fake.getState().ledger).toHaveLength(0);
  });

  it('should not adjust an invoice that belongs to another school', async () => {
    useFake({ invoices: [invoiceRow({ schoolId: 'school-2' })] });

    await expect(feeService.applyAdjustment(SCHOOL_ID, {
      studentId: 'student-1',
      invoiceId: 'invoice-1',
      type: 'discount',
      amount: 100000,
      reason: 'Sibling discount'
    }, 'admin-1')).rejects.toThrow('Invoice not found');

    expect(invoice().amountDue).toBe(500000);
    expect(holder.fake.getState().ledger).toHaveLength(0);
  });

  it('should mark the invoice paid when the adjustment covers the balance', async () => {
    useFake({ invoices: [invoiceRow({ amountDue: 100000, amountPaid: 400000, status: 'partial' })] });

    await feeService.applyAdjustment(SCHOOL_ID, {
      studentId: 'student-1',
      invoiceId: 'invoice-1',
      type: 'waiver',
      amount: 150000,
      reason: 'Hardship'
    }, 'admin-1');

    expect(invoice()).toEqual(expect.objectContaining({ amountDue: 0, status: 'paid' }));
  });
});

describe('feeService.verifyPayment', () => {
  it('should hand NexaPay verification to the strategy and never confirm directly', async () => {
    useFake({
      invoices: [invoiceRow()],
      payments: [gatewayPayment({ id: 'session-1', gateway: 'nexapay', gatewayReference: 'nxa_ref_1' })]
    });
    nexapayStrategy.verifyCollection.mockResolvedValue({ status: 'confirmed', payment: { reference: 'nxa_ref_1' } });

    const result = await feeService.verifyPayment(
      { reference: 'nxa_ref_1', gateway: 'nexapay', transactionId: 'txn_1' },
      SCHOOL_ID
    );

    expect(result.status).toBe('confirmed');
    expect(nexapayStrategy.verifyCollection).toHaveBeenCalledWith({
      schoolId: SCHOOL_ID,
      reference: 'nxa_ref_1',
      transactionId: 'txn_1'
    });
    // The strategy owns settlement; feeService touched nothing.
    expect(invoice().amountPaid).toBe(0);
    expect(holder.fake.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('should not find a reference that belongs to another school', async () => {
    useFake({ payments: [gatewayPayment({ schoolId: 'school-2' })] });

    await expect(
      feeService.verifyPayment({ reference: 'psk_ref_1', gateway: 'paystack' }, SCHOOL_ID)
    ).rejects.toThrow('Payment not found for this reference');
  });

  it('should refuse to confirm when Paystack charged a different amount', async () => {
    useFake({ invoices: [invoiceRow()], payments: [gatewayPayment({ amount: 500000 })] });
    paystackService.verifyTransaction.mockResolvedValue({ status: 'success', amount: 100000 });

    await expect(
      feeService.verifyPayment({ reference: 'psk_ref_1', gateway: 'paystack' }, SCHOOL_ID)
    ).rejects.toThrow('Payment amount mismatch with Paystack record');

    expect(holder.fake.getState().payments[0].status).toBe('pending');
    expect(invoice().amountPaid).toBe(0);
    expect(holder.fake.getState().ledger).toHaveLength(0);
  });

  it('should not mark a payment failed once it has been confirmed', async () => {
    useFake({ invoices: [invoiceRow()], payments: [gatewayPayment({ status: 'confirmed' })] });
    paystackService.verifyTransaction.mockResolvedValue({ status: 'abandoned' });

    const result = await feeService.verifyPayment({ reference: 'psk_ref_1', gateway: 'paystack' }, SCHOOL_ID);

    expect(result.status).toBe('failed');
    expect(holder.fake.getState().payments[0].status).toBe('confirmed');
  });
});

describe('feeService.voidInvoice', () => {
  it('should void an unpaid invoice', async () => {
    useFake({ invoices: [invoiceRow()] });

    await feeService.voidInvoice('invoice-1', SCHOOL_ID, 'Duplicate', 'admin-1');

    expect(invoice()).toEqual(expect.objectContaining({ status: 'void', isActive: false }));
    expect(holder.fake.getState().ledger).toHaveLength(1);
  });

  it('should not void an invoice a payment landed on after the check', async () => {
    useFake({ invoices: [invoiceRow({ amountPaid: 200000, amountDue: 300000, status: 'partial' })] });
    // The check saw an unpaid invoice; the payment committed after it.
    holder.fake.tx.feeInvoice.findFirst.mockImplementationOnce(async () => invoiceRow());

    await expect(
      feeService.voidInvoice('invoice-1', SCHOOL_ID, 'Duplicate', 'admin-1')
    ).rejects.toThrow(/Cannot void an invoice with recorded payments/);
    expect(invoice()).toEqual(expect.objectContaining({ status: 'partial', isActive: true }));
    expect(holder.fake.getState().ledger).toHaveLength(0);
  });
});

describe('feeService exports', () => {
  it('should export importSettlements for the reconciliation import route', () => {
    expect(typeof feeService.importSettlements).toBe('function');
  });
});
