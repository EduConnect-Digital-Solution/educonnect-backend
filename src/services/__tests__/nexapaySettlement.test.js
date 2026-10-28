/**
 * NexaPay deposit settlement tests.
 *
 * settleDeposit is the single place where a NexaPay deposit credits an
 * invoice, for both the webhook and manual verification. These tests run it
 * against an in-memory Prisma fake so the invoice, payment and ledger rows can
 * be checked after each step.
 */

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const { createFakePrisma } = require('./fakePrisma.fixture');
const { settleDeposit } = require('../nexapaySettlement');

const SCHOOL_A = 'school-a';
const SCHOOL_B = 'school-b';

const invoiceRow = (overrides = {}) => ({
  id: 'invoice-1',
  schoolId: SCHOOL_A,
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
  schoolId: SCHOOL_A,
  invoiceId: 'invoice-1',
  gateway: 'nexapay',
  gatewayReference: 'nxa_ref_1',
  amount: 500000,
  status: 'pending',
  ...overrides
});

const deposit = (overrides = {}) => ({
  schoolId: SCHOOL_A,
  providerTxnId: 'txn_1',
  reference: 'nxa_ref_1',
  merchantReference: 'invoice-1',
  amountKobo: 500000,
  payerDetails: { name: 'Ada Lovelace' },
  providerRaw: { transactionId: 'txn_1' },
  ...overrides
});

const settle = (fake, params) => fake.prisma.$transaction((tx) => settleDeposit(tx, params));

const invoiceById = (fake, id) => fake.getState().invoices.find((i) => i.id === id);

describe('NexaPay settlement - settleDeposit', () => {
  it('should claim the pending session and settle the invoice', async () => {
    const fake = createFakePrisma({ invoices: [invoiceRow()], payments: [sessionRow()] });

    const result = await settle(fake, deposit());

    expect(result.status).toBe('applied');
    expect(result.payment.id).toBe('session-1');
    expect(result.payment).toEqual(expect.objectContaining({
      status: 'confirmed',
      providerTxnId: 'txn_1',
      needsReview: false
    }));
    expect(result.payment.receiptNumber).toMatch(/^RCP-/);

    expect(invoiceById(fake, 'invoice-1')).toEqual(expect.objectContaining({
      amountPaid: 500000,
      amountDue: 0,
      status: 'paid'
    }));
    expect(fake.getState().ledger).toHaveLength(1);
    expect(fake.getState().ledger[0]).toEqual(expect.objectContaining({
      type: 'credit',
      amount: 500000,
      balance: 0,
      reference: 'session-1'
    }));
  });

  it('should move a partial payment to paid on the next deposit', async () => {
    const fake = createFakePrisma({ invoices: [invoiceRow()], payments: [sessionRow({ amount: 200000 })] });

    const first = await settle(fake, deposit({ providerTxnId: 'txn_1', amountKobo: 200000 }));
    expect(first.status).toBe('applied');
    expect(invoiceById(fake, 'invoice-1')).toEqual(expect.objectContaining({
      amountPaid: 200000,
      amountDue: 300000,
      status: 'partial'
    }));

    // The second transfer reaches the same virtual account. The session is
    // already claimed, so this one is recorded as its own payment.
    const second = await settle(fake, deposit({ providerTxnId: 'txn_2', amountKobo: 300000 }));
    expect(second.status).toBe('applied');
    expect(second.payment.id).not.toBe('session-1');
    expect(invoiceById(fake, 'invoice-1')).toEqual(expect.objectContaining({
      amountPaid: 500000,
      amountDue: 0,
      status: 'paid'
    }));
    expect(fake.getState().ledger.map((e) => e.balance)).toEqual([300000, 0]);
  });

  it('should settle the same transaction only once', async () => {
    const fake = createFakePrisma({ invoices: [invoiceRow()], payments: [sessionRow()] });

    await settle(fake, deposit());
    const replay = await settle(fake, deposit());

    expect(replay.status).toBe('duplicate');
    expect(invoiceById(fake, 'invoice-1').amountPaid).toBe(500000);
    expect(fake.getState().payments).toHaveLength(1);
    expect(fake.getState().ledger).toHaveLength(1);
  });

  it('should credit the invoice once when a manual verification is followed by the webhook', async () => {
    // Regression: the manual path used to confirm the session without
    // recording the provider transaction id, so the webhook applied it again.
    const fake = createFakePrisma({ invoices: [invoiceRow()], payments: [sessionRow()] });

    const fromVerify = await settle(fake, deposit({ merchantReference: null, payerDetails: null }));
    const fromWebhook = await settle(fake, deposit());

    expect(fromVerify.status).toBe('applied');
    expect(fromWebhook.status).toBe('duplicate');
    expect(invoiceById(fake, 'invoice-1')).toEqual(expect.objectContaining({ amountPaid: 500000, status: 'paid' }));
  });

  it('should roll back a concurrent duplicate that slips past the lookup', async () => {
    const fake = createFakePrisma({ invoices: [invoiceRow()], payments: [sessionRow()] });
    await settle(fake, deposit());

    // Simulate the race: the duplicate check runs before the other
    // transaction commits, so it sees nothing. The unique index still holds.
    fake.tx.feePayment.findFirst.mockImplementationOnce(async () => null);

    await expect(settle(fake, deposit())).rejects.toMatchObject({ code: 'P2002' });

    expect(invoiceById(fake, 'invoice-1').amountPaid).toBe(500000);
    expect(fake.getState().payments).toHaveLength(1);
    expect(fake.getState().ledger).toHaveLength(1);
  });

  it('should keep a discount that was applied before the deposit', async () => {
    // 100,000 kobo was waived, so only 400,000 is still due.
    const fake = createFakePrisma({
      invoices: [invoiceRow({ amountDue: 400000 })],
      payments: [sessionRow({ amount: 400000 })]
    });

    await settle(fake, deposit({ amountKobo: 400000 }));

    expect(invoiceById(fake, 'invoice-1')).toEqual(expect.objectContaining({
      amountPaid: 400000,
      amountDue: 0,
      status: 'paid'
    }));
  });

  it('should apply an overpayment and flag it for review', async () => {
    const fake = createFakePrisma({ invoices: [invoiceRow()], payments: [sessionRow()] });

    const result = await settle(fake, deposit({ amountKobo: 600000 }));

    expect(result.status).toBe('applied');
    expect(result.payment).toEqual(expect.objectContaining({ needsReview: true, reviewReason: 'OVERPAID' }));
    expect(invoiceById(fake, 'invoice-1')).toEqual(expect.objectContaining({
      amountPaid: 600000,
      amountDue: 0,
      status: 'paid'
    }));
  });

  it('should hold a deposit that matches no invoice', async () => {
    const fake = createFakePrisma({ invoices: [invoiceRow()] });

    const result = await settle(fake, deposit({ reference: 'nxa_unknown', merchantReference: 'invoice-unknown' }));

    expect(result.status).toBe('review');
    expect(result.payment).toEqual(expect.objectContaining({
      invoiceId: null,
      status: 'confirmed',
      needsReview: true,
      reviewReason: 'NO_MATCHING_INVOICE',
      providerTxnId: 'txn_1'
    }));
    expect(invoiceById(fake, 'invoice-1').amountPaid).toBe(0);
    expect(fake.getState().ledger).toHaveLength(0);
  });

  it('should not let a deposit for school A touch an invoice of school B', async () => {
    const fake = createFakePrisma({
      invoices: [invoiceRow({ id: 'invoice-b', schoolId: SCHOOL_B })],
      payments: [sessionRow({ id: 'session-b', schoolId: SCHOOL_B, invoiceId: 'invoice-b' })]
    });

    // A forged merchantReference and a reference copied from school B.
    const result = await settle(fake, deposit({ schoolId: SCHOOL_A, merchantReference: 'invoice-b' }));

    expect(result.status).toBe('review');
    expect(result.payment.reviewReason).toBe('NO_MATCHING_INVOICE');
    expect(invoiceById(fake, 'invoice-b').amountPaid).toBe(0);
    const sessionB = fake.getState().payments.find((p) => p.id === 'session-b');
    expect(sessionB.status).toBe('pending');
  });

  it('should hold a deposit for a voided invoice and unlink the session', async () => {
    const fake = createFakePrisma({
      invoices: [invoiceRow({ status: 'void', isActive: false })],
      payments: [sessionRow()]
    });

    const result = await settle(fake, deposit());

    expect(result.status).toBe('review');
    expect(result.payment).toEqual(expect.objectContaining({
      id: 'session-1',
      invoiceId: null,
      reviewReason: 'INVOICE_VOID'
    }));
    expect(invoiceById(fake, 'invoice-1').amountPaid).toBe(0);
  });

  it('should hold a deposit whose merchantReference disagrees with our session', async () => {
    const fake = createFakePrisma({
      invoices: [invoiceRow(), invoiceRow({ id: 'invoice-2' })],
      payments: [sessionRow()]
    });

    const result = await settle(fake, deposit({ merchantReference: 'invoice-2' }));

    expect(result.status).toBe('review');
    expect(result.payment.reviewReason).toBe('REFERENCE_MISMATCH');
    expect(invoiceById(fake, 'invoice-1').amountPaid).toBe(0);
    expect(invoiceById(fake, 'invoice-2').amountPaid).toBe(0);
  });

  it('should hold a deposit without a provider transaction id', async () => {
    const fake = createFakePrisma({ invoices: [invoiceRow()], payments: [sessionRow()] });

    const result = await settle(fake, deposit({ providerTxnId: null }));

    expect(result.status).toBe('review');
    expect(result.payment.reviewReason).toBe('MISSING_TRANSACTION_ID');
    expect(invoiceById(fake, 'invoice-1').amountPaid).toBe(0);
  });

  it('should hold the deposit when the invoice is voided between lookup and update', async () => {
    const fake = createFakePrisma({
      invoices: [invoiceRow({ status: 'void', isActive: false })],
      payments: [sessionRow()]
    });
    // The lookup still saw the invoice as live; the void committed after it.
    fake.tx.feeInvoice.findFirst.mockImplementationOnce(async () => invoiceRow());

    const result = await settle(fake, deposit());

    expect(result.status).toBe('review');
    expect(result.payment).toEqual(expect.objectContaining({ invoiceId: null, reviewReason: 'INVOICE_VOID' }));
    expect(invoiceById(fake, 'invoice-1')).toEqual(expect.objectContaining({ status: 'void', amountPaid: 0 }));
    expect(fake.getState().ledger).toHaveLength(0);
  });

  it('should record a deposit with an unreadable amount without crediting anything', async () => {
    const fake = createFakePrisma({ invoices: [invoiceRow()], payments: [sessionRow()] });

    const result = await settle(fake, deposit({ amountKobo: null }));

    expect(result.status).toBe('review');
    expect(result.payment).toEqual(expect.objectContaining({
      amount: 0,
      status: 'pending',
      providerTxnId: null,
      reviewReason: 'INVALID_AMOUNT'
    }));
    expect(fake.getState().payments.find((p) => p.id === 'session-1').status).toBe('pending');
    expect(invoiceById(fake, 'invoice-1').amountPaid).toBe(0);
  });

  it('should refuse a transaction id already recorded for another school', async () => {
    const fake = createFakePrisma({
      invoices: [invoiceRow()],
      payments: [sessionRow({ id: 'payment-b', schoolId: SCHOOL_B, status: 'confirmed', providerTxnId: 'txn_1' })]
    });

    await expect(settle(fake, deposit())).rejects.toThrow(/already recorded for another school/);
    expect(invoiceById(fake, 'invoice-1').amountPaid).toBe(0);
  });

  it('should have a fake that refuses top-level writes inside a transaction', async () => {
    // Guards the fixture itself: a write that bypassed the transaction client
    // would commit on its own in Postgres, so the tests must not hide it.
    const fake = createFakePrisma({ invoices: [invoiceRow()] });

    await expect(
      fake.prisma.$transaction(async () => fake.prisma.feePayment.create({ data: { schoolId: SCHOOL_A } }))
    ).rejects.toThrow(/transaction is open/);
  });

  it('should roll everything back when a step fails', async () => {
    const fake = createFakePrisma({ invoices: [invoiceRow()], payments: [sessionRow()] });
    fake.tx.feeLedgerEntry.create.mockRejectedValueOnce(new Error('database is down'));

    await expect(settle(fake, deposit())).rejects.toThrow('database is down');

    expect(invoiceById(fake, 'invoice-1')).toEqual(expect.objectContaining({ amountPaid: 0, status: 'pending' }));
    expect(fake.getState().payments[0]).toEqual(expect.objectContaining({ status: 'pending' }));
    expect(fake.getState().payments[0].providerTxnId).toBeUndefined();
  });
});
