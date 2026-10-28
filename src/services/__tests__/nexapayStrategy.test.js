/**
 * NexaPay collection strategy tests.
 *
 * These cover the rules that keep a collection inside the right tenant and
 * inside the right amount: a paid invoice cannot be collected again, the
 * amount cannot exceed what is still due, and an invoice from another school
 * simply does not exist as far as the strategy is concerned.
 */

jest.mock('../../config/database', () => ({
  prisma: {
    feeInvoice: { findFirst: jest.fn(), update: jest.fn() },
    feePayment: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    student: { findFirst: jest.fn() },
    $transaction: jest.fn()
  },
  connectDB: jest.fn()
}));

jest.mock('../nexapayConfigService', () => ({
  getBySchoolId: jest.fn(),
  getByBusinessId: jest.fn(),
  getPublicConfig: jest.fn(),
  upsert: jest.fn()
}));

jest.mock('../nexapayService', () => ({
  createVirtualAccount: jest.fn(),
  updateVirtualAccountAmount: jest.fn(),
  getTransaction: jest.fn(),
  listTransactions: jest.fn(),
  Kobo: (naira) => Math.round(naira * 100)
}));

jest.mock('../nexapaySettlement', () => ({
  settleDeposit: jest.fn()
}));

const { prisma } = require('../../config/database');
const nexapayConfigService = require('../nexapayConfigService');
const nexapayService = require('../nexapayService');
const { settleDeposit } = require('../nexapaySettlement');
const nexapayStrategy = require('../nexapayStrategy');

const SCHOOL_ID = 'school-1';
const OTHER_SCHOOL_ID = 'school-2';
const INVOICE_ID = 'invoice-1';

const CREDENTIALS = {
  schoolId: SCHOOL_ID,
  businessId: 'biz_123',
  environment: 'test',
  apiKey: 'key',
  webhookSecret: 'secret'
};

const invoice = (overrides = {}) => ({
  id: INVOICE_ID,
  schoolId: SCHOOL_ID,
  studentId: 'student-1',
  amount: 500000,
  amountPaid: 100000,
  amountDue: 400000,
  status: 'partial',
  invoiceNumber: 'INV-1',
  isActive: true,
  ...overrides
});

describe('NexaPay strategy - createCollection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    nexapayConfigService.getBySchoolId.mockResolvedValue(CREDENTIALS);
    prisma.feePayment.findFirst.mockResolvedValue(null);
    prisma.student.findFirst.mockResolvedValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '08000000000',
      email: 'ada@example.com'
    });
    nexapayService.createVirtualAccount.mockResolvedValue({
      success: true,
      data: { accountNumber: '0123456789', bankName: 'Test Bank' }
    });
    prisma.feePayment.create.mockImplementation(async ({ data }) => ({ id: 'payment-1', ...data }));
    prisma.feePayment.update.mockImplementation(async ({ where, data }) => ({ id: where.id, ...data }));
  });

  test('creates a virtual account and a pending payment', async () => {
    prisma.feeInvoice.findFirst.mockResolvedValue(invoice());

    const result = await nexapayStrategy.createCollection({
      schoolId: SCHOOL_ID,
      invoiceId: INVOICE_ID,
      userId: 'admin-1'
    });

    expect(result.gateway).toBe('nexapay');
    expect(result.accountNumber).toBe('0123456789');
    expect(result.bankName).toBe('Test Bank');
    expect(result.amount).toBe(400000);

    // The provider is called with naira, the ledger with kobo.
    const [, request] = nexapayService.createVirtualAccount.mock.calls[0];
    expect(request.amountKobo).toBe(400000);
    expect(request.merchantReference).toBe(INVOICE_ID);
    expect(request.merchantCustomerId).toBe('student-1');

    expect(prisma.feePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          schoolId: SCHOOL_ID,
          invoiceId: INVOICE_ID,
          amount: 400000,
          gateway: 'nexapay',
          status: 'pending',
          accountNumber: '0123456789'
        })
      })
    );
  });

  test('rejects an invoice that belongs to another school', async () => {
    // The tenant-scoped lookup simply finds nothing for a foreign invoice.
    prisma.feeInvoice.findFirst.mockResolvedValue(null);

    await expect(
      nexapayStrategy.createCollection({
        schoolId: SCHOOL_ID,
        invoiceId: 'invoice-from-another-school'
      })
    ).rejects.toThrow(/Invoice not found/);

    expect(nexapayService.createVirtualAccount).not.toHaveBeenCalled();
    expect(prisma.feePayment.create).not.toHaveBeenCalled();
  });

  test('scopes the invoice lookup to the requesting school', async () => {
    prisma.feeInvoice.findFirst.mockResolvedValue(null);

    await nexapayStrategy
      .createCollection({ schoolId: OTHER_SCHOOL_ID, invoiceId: INVOICE_ID })
      .catch(() => {});

    expect(prisma.feeInvoice.findFirst).toHaveBeenCalledWith({
      where: { id: INVOICE_ID, schoolId: OTHER_SCHOOL_ID, isActive: true }
    });
  });

  test('rejects an invoice that is already paid', async () => {
    prisma.feeInvoice.findFirst.mockResolvedValue(invoice({ status: 'paid', amountDue: 0 }));

    await expect(
      nexapayStrategy.createCollection({ schoolId: SCHOOL_ID, invoiceId: INVOICE_ID })
    ).rejects.toThrow(/already fully paid/);

    expect(nexapayService.createVirtualAccount).not.toHaveBeenCalled();
  });

  test('rejects an amount larger than the outstanding balance', async () => {
    prisma.feeInvoice.findFirst.mockResolvedValue(invoice());

    await expect(
      nexapayStrategy.createCollection({
        schoolId: SCHOOL_ID,
        invoiceId: INVOICE_ID,
        amount: 500000
      })
    ).rejects.toThrow(/exceeds the amount due/);

    expect(nexapayService.createVirtualAccount).not.toHaveBeenCalled();
  });

  test('caps the collection at amountDue, which already reflects discounts', async () => {
    // 100,000 kobo waived: amount - amountPaid is still 400,000 but only
    // 300,000 is really due.
    prisma.feeInvoice.findFirst.mockResolvedValue(invoice({ amountDue: 300000 }));

    await expect(
      nexapayStrategy.createCollection({ schoolId: SCHOOL_ID, invoiceId: INVOICE_ID, amount: 400000 })
    ).rejects.toThrow(/exceeds the amount due/);

    await nexapayStrategy.createCollection({ schoolId: SCHOOL_ID, invoiceId: INVOICE_ID });
    const [, request] = nexapayService.createVirtualAccount.mock.calls[0];
    expect(request.amountKobo).toBe(300000);
  });

  test('rejects a non-positive amount', async () => {
    prisma.feeInvoice.findFirst.mockResolvedValue(invoice());

    await expect(
      nexapayStrategy.createCollection({
        schoolId: SCHOOL_ID,
        invoiceId: INVOICE_ID,
        amount: 0
      })
    ).rejects.toThrow(/must be positive/);
  });

  test('rejects a voided invoice', async () => {
    prisma.feeInvoice.findFirst.mockResolvedValue(invoice({ status: 'void' }));

    await expect(
      nexapayStrategy.createCollection({ schoolId: SCHOOL_ID, invoiceId: INVOICE_ID })
    ).rejects.toThrow(/voided/);
  });

  test('fails when the school has no NexaPay configuration', async () => {
    nexapayConfigService.getBySchoolId.mockResolvedValue(null);

    await expect(
      nexapayStrategy.createCollection({ schoolId: SCHOOL_ID, invoiceId: INVOICE_ID })
    ).rejects.toThrow(/not configured/);
  });

  test('reuses an open session instead of opening a second account', async () => {
    prisma.feeInvoice.findFirst.mockResolvedValue(invoice());
    prisma.feePayment.findFirst.mockResolvedValue({
      id: 'payment-existing',
      amount: 400000,
      gatewayReference: 'nxa_existing',
      accountNumber: '0123456789',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });

    const result = await nexapayStrategy.createCollection({
      schoolId: SCHOOL_ID,
      invoiceId: INVOICE_ID
    });

    expect(result.reference).toBe('nxa_existing');
    expect(nexapayService.createVirtualAccount).not.toHaveBeenCalled();
    expect(prisma.feePayment.create).not.toHaveBeenCalled();
  });

  test('updates the expected amount when the outstanding balance changed', async () => {
    prisma.feeInvoice.findFirst.mockResolvedValue(invoice());
    prisma.feePayment.findFirst.mockResolvedValue({
      id: 'payment-existing',
      amount: 400000,
      gatewayReference: 'nxa_existing',
      accountNumber: '0123456789',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });
    nexapayService.updateVirtualAccountAmount.mockResolvedValue({ success: true });
    prisma.feePayment.updateMany.mockResolvedValue({ count: 1 });

    const result = await nexapayStrategy.createCollection({
      schoolId: SCHOOL_ID,
      invoiceId: INVOICE_ID,
      amount: 150000
    });

    expect(result.amount).toBe(150000);
    expect(nexapayService.updateVirtualAccountAmount).toHaveBeenCalledWith(
      CREDENTIALS,
      'nxa_existing',
      150000
    );
    // Only a still-pending session is changed.
    expect(prisma.feePayment.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-existing', status: 'pending' },
      data: { amount: 150000 }
    });
  });

  test('does not overwrite a session that a deposit settled during the provider call', async () => {
    prisma.feeInvoice.findFirst.mockResolvedValue(invoice());
    prisma.feePayment.findFirst.mockResolvedValue({
      id: 'payment-existing',
      amount: 400000,
      gatewayReference: 'nxa_existing',
      accountNumber: '0123456789',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });
    nexapayService.updateVirtualAccountAmount.mockResolvedValue({ success: true });
    prisma.feePayment.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      nexapayStrategy.createCollection({ schoolId: SCHOOL_ID, invoiceId: INVOICE_ID, amount: 150000 })
    ).rejects.toThrow(/already settled/);
    expect(prisma.feePayment.update).not.toHaveBeenCalled();
  });

  test('fails loudly when the provider response has no account number', async () => {
    prisma.feeInvoice.findFirst.mockResolvedValue(invoice());
    nexapayService.createVirtualAccount.mockResolvedValue({ success: true, data: {} });

    const error = await nexapayStrategy
      .createCollection({ schoolId: SCHOOL_ID, invoiceId: INVOICE_ID })
      .catch((e) => e);

    expect(error.message).toMatch(/did not return a virtual account number/);
    expect(error.statusCode).toBe(502);
    expect(prisma.feePayment.create).not.toHaveBeenCalled();
  });
});

describe('NexaPay strategy - verifyCollection', () => {
  const REFERENCE = 'nxa_session_1';

  const pendingSession = (overrides = {}) => ({
    id: 'session-1',
    schoolId: SCHOOL_ID,
    invoiceId: INVOICE_ID,
    gateway: 'nexapay',
    gatewayReference: REFERENCE,
    amount: 400000,
    status: 'pending',
    receiptNumber: null,
    paidAt: null,
    needsReview: false,
    ...overrides
  });

  const providerTransaction = (overrides = {}) => ({
    id: 'txn_1',
    amount: 4000,
    status: 'successful',
    reference: REFERENCE,
    environment: 'test',
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();
    nexapayConfigService.getBySchoolId.mockResolvedValue(CREDENTIALS);
    prisma.feePayment.findFirst.mockResolvedValue(pendingSession());
    prisma.$transaction.mockImplementation(async (callback) => callback({ tx: true }));
    settleDeposit.mockResolvedValue({
      status: 'applied',
      payment: pendingSession({ status: 'confirmed', receiptNumber: 'RCP-1', paidAt: new Date() })
    });
  });

  test('scopes the payment lookup to the requesting school', async () => {
    prisma.feePayment.findFirst.mockResolvedValue(null);

    await expect(
      nexapayStrategy.verifyCollection({ schoolId: OTHER_SCHOOL_ID, reference: REFERENCE })
    ).rejects.toThrow(/Payment not found/);

    expect(prisma.feePayment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { schoolId: OTHER_SCHOOL_ID, gateway: 'nexapay', gatewayReference: REFERENCE }
    }));
  });

  test('returns an already settled payment without calling the provider', async () => {
    prisma.feePayment.findFirst.mockResolvedValue(pendingSession({ status: 'confirmed', receiptNumber: 'RCP-1' }));

    const result = await nexapayStrategy.verifyCollection({ schoolId: SCHOOL_ID, reference: REFERENCE });

    expect(result.status).toBe('confirmed');
    expect(result.payment.receiptNumber).toBe('RCP-1');
    expect(nexapayService.listTransactions).not.toHaveBeenCalled();
    expect(settleDeposit).not.toHaveBeenCalled();
  });

  test('finds the transaction by our reference and settles it through settleDeposit', async () => {
    nexapayService.listTransactions.mockResolvedValue({
      success: true,
      transactions: [providerTransaction({ id: 'txn_other', reference: 'nxa_other' }), providerTransaction()]
    });

    const result = await nexapayStrategy.verifyCollection({ schoolId: SCHOOL_ID, reference: REFERENCE });

    expect(result.status).toBe('confirmed');
    expect(nexapayService.getTransaction).not.toHaveBeenCalled();
    expect(settleDeposit).toHaveBeenCalledWith({ tx: true }, expect.objectContaining({
      schoolId: SCHOOL_ID,
      providerTxnId: 'txn_1',
      reference: REFERENCE,
      amountKobo: 400000
    }));
  });

  test('looks the transaction up by NexaPay transaction id when one is given', async () => {
    nexapayService.getTransaction.mockResolvedValue({ success: true, transaction: providerTransaction() });

    await nexapayStrategy.verifyCollection({ schoolId: SCHOOL_ID, reference: REFERENCE, transactionId: 'txn_1' });

    // Keyed by the provider's id, never by our reference.
    expect(nexapayService.getTransaction).toHaveBeenCalledWith(CREDENTIALS, 'txn_1');
    expect(settleDeposit).toHaveBeenCalled();
  });

  test('rejects a transaction id that belongs to a different payment', async () => {
    nexapayService.getTransaction.mockResolvedValue({
      success: true,
      transaction: providerTransaction({ reference: 'nxa_someone_else' })
    });

    await expect(
      nexapayStrategy.verifyCollection({ schoolId: SCHOOL_ID, reference: REFERENCE, transactionId: 'txn_1' })
    ).rejects.toThrow(/does not belong to this payment/);
    expect(settleDeposit).not.toHaveBeenCalled();
  });

  test('rejects a transaction from the other NexaPay environment', async () => {
    nexapayService.listTransactions.mockResolvedValue({
      success: true,
      transactions: [providerTransaction({ environment: 'prod' })]
    });

    await expect(
      nexapayStrategy.verifyCollection({ schoolId: SCHOOL_ID, reference: REFERENCE })
    ).rejects.toThrow(/different NexaPay environment/);
    expect(settleDeposit).not.toHaveBeenCalled();
  });

  test('reports pending while no money has arrived', async () => {
    nexapayService.listTransactions.mockResolvedValue({ success: true, transactions: [] });

    const result = await nexapayStrategy.verifyCollection({ schoolId: SCHOOL_ID, reference: REFERENCE });

    expect(result.status).toBe('pending');
    expect(settleDeposit).not.toHaveBeenCalled();
    expect(prisma.feePayment.update).not.toHaveBeenCalled();
  });

  test('reports a failed transaction without settling it', async () => {
    nexapayService.listTransactions.mockResolvedValue({
      success: true,
      transactions: [providerTransaction({ status: 'failed' })]
    });

    const result = await nexapayStrategy.verifyCollection({ schoolId: SCHOOL_ID, reference: REFERENCE });

    expect(result.status).toBe('failed');
    expect(settleDeposit).not.toHaveBeenCalled();
  });

  test('reports review when the deposit was held', async () => {
    nexapayService.listTransactions.mockResolvedValue({ success: true, transactions: [providerTransaction()] });
    settleDeposit.mockResolvedValue({ status: 'review', payment: pendingSession({ invoiceId: null, needsReview: true }) });

    const result = await nexapayStrategy.verifyCollection({ schoolId: SCHOOL_ID, reference: REFERENCE });

    expect(result.status).toBe('review');
  });

  test('asks for the transaction id when the reference is beyond the searchable window', async () => {
    const others = Array.from({ length: 200 }, (_, i) => providerTransaction({ id: `txn_${i}`, reference: `nxa_other_${i}` }));
    nexapayService.listTransactions.mockResolvedValue({ success: true, transactions: others });

    const error = await nexapayStrategy
      .verifyCollection({ schoolId: SCHOOL_ID, reference: REFERENCE })
      .catch((e) => e);

    expect(error.statusCode).toBe(400);
    expect(error.message).toMatch(/Provide the NexaPay transactionId/);
    expect(settleDeposit).not.toHaveBeenCalled();
  });

  test('reports the settled payment when the webhook wins the race', async () => {
    nexapayService.listTransactions.mockResolvedValue({ success: true, transactions: [providerTransaction()] });
    prisma.$transaction.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));
    prisma.feePayment.findFirst
      .mockResolvedValueOnce(pendingSession())
      .mockResolvedValueOnce(pendingSession({ status: 'confirmed', providerTxnId: 'txn_1', receiptNumber: 'RCP-9' }));

    const result = await nexapayStrategy.verifyCollection({ schoolId: SCHOOL_ID, reference: REFERENCE });

    expect(result.status).toBe('confirmed');
    expect(result.payment.receiptNumber).toBe('RCP-9');
    expect(prisma.feePayment.findFirst).toHaveBeenLastCalledWith({
      where: { schoolId: SCHOOL_ID, gateway: 'nexapay', providerTxnId: 'txn_1' }
    });
  });

  test('treats a provider transaction without an amount as a bad gateway', async () => {
    nexapayService.listTransactions.mockResolvedValue({
      success: true,
      transactions: [providerTransaction({ amount: null })]
    });

    const error = await nexapayStrategy
      .verifyCollection({ schoolId: SCHOOL_ID, reference: REFERENCE })
      .catch((e) => e);

    expect(error.statusCode).toBe(502);
    expect(settleDeposit).not.toHaveBeenCalled();
  });
});

describe('NexaPay strategy - pickString', () => {
  test('reads the account number from the documented and snake_case shapes', () => {
    expect(nexapayStrategy.pickString({ accountNumber: '111' }, 'accountNumber')).toBe('111');
    expect(nexapayStrategy.pickString({ account_number: '222' }, 'accountNumber', 'account_number')).toBe('222');
    expect(nexapayStrategy.pickString({ data: { accountNumber: '333' } }, 'accountNumber')).toBe('333');
    expect(nexapayStrategy.pickString({}, 'accountNumber')).toBeNull();
  });
});
