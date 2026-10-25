const crypto = require('crypto');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const nexapayService = require('./nexapayService');
const nexapayConfigService = require('./nexapayConfigService');
const { settleDeposit } = require('./nexapaySettlement');

/**
 * NexaPay collection strategy.
 *
 * NexaPay collects by bank transfer into a customer-facing virtual account, so
 * "initializing a payment" here means "open a virtual account for this invoice
 * and tell the payer where to send the money".
 *
 * This is the NexaPay counterpart of the Paystack branch in
 * feeService.initializePayment - same checkout flow, same money convention
 * (kobo internally, naira only at the provider boundary), same tenant scoping.
 */

const GATEWAY = 'nexapay';
const DEFAULT_VALIDITY_MINUTES = 4320; // provider default (3 days)

const generateReference = () => `nxa_${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`;

// The school admin can fix this by saving the gateway configuration, so it is
// a client error rather than a server fault.
const notConfiguredError = () =>
  Object.assign(new Error('NexaPay is not configured for this school'), { statusCode: 400 });

/**
 * Read a string out of a provider response.
 *
 * The NexaPay create-virtual-account response has no published schema (the
 * OpenAPI document declares the 200 response without a body schema), so the
 * field names are still unconfirmed. This reads the documented-looking names
 * first and falls back to the snake_case variants. See OPEN ITEM in README.
 */
const pickString = (res, ...keys) => {
  const sources = [res, res && res.data, res && res.virtualAccount, res && res.account]
    .filter((source) => source && typeof source === 'object');
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
  }
  return null;
};

/**
 * Turn an invoice into a NexaPay virtual account.
 *
 * @param {object} params
 * @param {string} params.schoolId tenant, always resolved from the auth context
 * @param {string} params.invoiceId
 * @param {number} [params.amount] kobo; defaults to the outstanding balance
 * @param {string} [params.userId] user who opened the collection
 * @param {{email?: string, name?: string, phone?: string}} [params.payer]
 */
const createCollection = async ({ schoolId, invoiceId, amount, userId, payer = {} }) => {
  const creds = await nexapayConfigService.getBySchoolId(schoolId);
  if (!creds) throw notConfiguredError();

  // Tenant-scoped lookup: an invoice id from another school is simply not found.
  const invoice = await prisma.feeInvoice.findFirst({
    where: { id: invoiceId, schoolId, isActive: true }
  });
  if (!invoice) throw new Error('Invoice not found');
  if (invoice.status === 'void') throw new Error('Cannot pay a voided invoice');
  if (invoice.status === 'paid') throw new Error('Invoice is already fully paid');

  const outstanding = Math.max(0, Math.min(invoice.amountDue, invoice.amount - invoice.amountPaid));
  if (outstanding <= 0) throw new Error('Invoice is already fully paid');

  const amountKobo = amount === undefined || amount === null ? outstanding : amount;
  if (!Number.isInteger(amountKobo) || amountKobo <= 0) {
    throw new Error('Payment amount must be positive');
  }
  if (amountKobo > outstanding) {
    throw new Error('Payment amount exceeds the amount due');
  }

  const validityMinutes = DEFAULT_VALIDITY_MINUTES;

  // Reuse an open session for this invoice instead of piling up virtual accounts.
  const existing = await prisma.feePayment.findFirst({
    where: {
      schoolId,
      invoiceId: invoice.id,
      gateway: GATEWAY,
      status: 'pending'
    },
    orderBy: { createdAt: 'desc' }
  });

  if (existing && existing.accountNumber && existing.expiresAt && existing.expiresAt.getTime() > Date.now()) {
    if (existing.amount === amountKobo) {
      return toCollection(existing);
    }
    // The expected amount moved - tell the provider, then mirror it locally.
    await nexapayService.updateVirtualAccountAmount(creds, existing.gatewayReference, amountKobo);
    // Only while still pending: a deposit may have settled the session during
    // the provider call, and its confirmed amount must not be overwritten.
    const updated = await prisma.feePayment.updateMany({
      where: { id: existing.id, status: 'pending' },
      data: { amount: amountKobo }
    });
    if (updated.count === 0) {
      throw new Error('This payment session was already settled. Refresh the invoice and try again.');
    }
    return toCollection({ ...existing, amount: amountKobo });
  }

  const student = await prisma.student.findFirst({
    where: { id: invoice.studentId, schoolId },
    select: { firstName: true, lastName: true, phone: true, email: true }
  });

  const reference = generateReference();
  const customerName = payer.name || (student ? `${student.firstName} ${student.lastName}` : undefined);
  const customerPhone = payer.phone || student?.phone || undefined;
  const customerEmail = payer.email || student?.email || undefined;

  const response = await nexapayService.createVirtualAccount(creds, {
    amountKobo,
    reference,
    merchantCustomerId: invoice.studentId,
    // Echoed back on deposit.received - this is the reconciliation key.
    merchantReference: invoice.id,
    validityTime: validityMinutes,
    customerName,
    customerEmail,
    customerPhone,
    metadata: {
      schoolId,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber
    }
  });

  const accountNumber = pickString(response, 'accountNumber', 'account_number');
  const bankName = pickString(response, 'bankName', 'bank_name', 'bank');

  if (!accountNumber) {
    logger.warn('NexaPay virtual account response did not contain an account number', {
      responseKeys: response && typeof response === 'object' ? Object.keys(response) : []
    });
    const error = new Error('NexaPay did not return a virtual account number');
    error.statusCode = 502;
    throw error;
  }

  const expiresAt = new Date(Date.now() + validityMinutes * 60 * 1000);

  const payment = await prisma.feePayment.create({
    data: {
      schoolId,
      invoiceId: invoice.id,
      amount: amountKobo,
      paymentMethod: 'bank_transfer',
      gateway: GATEWAY,
      gatewayReference: reference,
      referenceNumber: reference,
      accountNumber,
      bankName,
      expiresAt,
      providerRaw: response,
      note: 'NexaPay virtual account collection',
      status: 'pending',
      receivedBy: userId || null
    }
  });

  logger.info('NexaPay collection created', {
    schoolId,
    invoiceId: invoice.id,
    reference,
    amountKobo
  });

  return toCollection(payment);
};

const toCollection = (payment) => ({
  gateway: GATEWAY,
  reference: payment.gatewayReference,
  accountNumber: payment.accountNumber,
  bankName: payment.bankName,
  amount: payment.amount,
  expiresAt: payment.expiresAt,
  paymentId: payment.id,
  status: payment.status
});

const SETTLED_STATUSES = new Set(['successful', 'success', 'completed']);
const FAILED_STATUSES = new Set(['failed', 'reversed', 'declined']);

const toVerifyResult = (status, payment, reference) => ({
  status,
  payment: {
    reference,
    gateway: GATEWAY,
    amount: payment.amount,
    receiptNumber: payment.receiptNumber || null,
    paidAt: payment.paidAt || null
  }
});

/**
 * Find the NexaPay wallet transaction behind one of our collection sessions.
 *
 * GET /transactions/{id} is keyed by NexaPay's transaction id, which we only
 * learn from the deposit webhook. Without it, the recent transaction list is
 * searched for our session reference instead.
 */
const TRANSACTION_SEARCH_LIMIT = 200; // the documented maximum for GET /transactions

const findProviderTransaction = async (creds, { reference, transactionId }) => {
  if (transactionId) {
    const result = await nexapayService.getTransaction(creds, transactionId);
    return (result && result.transaction) || null;
  }
  const result = await nexapayService.listTransactions(creds, { limit: TRANSACTION_SEARCH_LIMIT });
  const transactions = (result && Array.isArray(result.transactions)) ? result.transactions : [];
  const match = transactions.find((t) => t && t.reference === reference) || null;
  if (!match && transactions.length >= TRANSACTION_SEARCH_LIMIT) {
    // The list has no filter or paging, so an older deposit may simply be out
    // of reach. Saying "pending" here would wrongly tell the payer to wait.
    const error = new Error('Invalid request: the transfer is not among the recent NexaPay transactions. Provide the NexaPay transactionId to verify it.');
    error.statusCode = 400;
    throw error;
  }
  return match;
};

/**
 * Manually verify a NexaPay collection and settle it if the money arrived.
 *
 * Settles through the same settleDeposit as the webhook, keyed by the NexaPay
 * transaction id, so a manual verification followed by the webhook (or the
 * other way round) credits the invoice exactly once.
 *
 * @returns {{status: 'confirmed'|'pending'|'failed'|'review', payment: object}}
 */
const verifyCollection = async ({ schoolId, reference, transactionId }) => {
  const payment = await prisma.feePayment.findFirst({
    where: { schoolId, gateway: GATEWAY, gatewayReference: reference },
    orderBy: { createdAt: 'desc' }
  });
  if (!payment) throw new Error('Payment not found for this reference');

  // Already settled, typically by the webhook. Nothing to ask the provider.
  if (payment.status === 'confirmed' && !transactionId) {
    return toVerifyResult(payment.needsReview && !payment.invoiceId ? 'review' : 'confirmed', payment, reference);
  }

  const creds = await nexapayConfigService.getBySchoolId(schoolId);
  if (!creds) throw notConfiguredError();

  const transaction = await findProviderTransaction(creds, { reference, transactionId });
  if (!transaction) {
    // No money yet. The virtual account stays open, so this is not a failure.
    return toVerifyResult('pending', payment, reference);
  }

  if (transaction.reference !== reference) {
    throw new Error('Invalid transaction: it does not belong to this payment reference');
  }
  if (transaction.environment && transaction.environment !== creds.environment) {
    throw new Error('Invalid transaction: it belongs to a different NexaPay environment');
  }

  const status = String(transaction.status || '').toLowerCase();
  if (FAILED_STATUSES.has(status)) return toVerifyResult('failed', payment, reference);
  if (!SETTLED_STATUSES.has(status)) return toVerifyResult('pending', payment, reference);

  if (typeof transaction.amount !== 'number' || !Number.isFinite(transaction.amount) || transaction.amount <= 0) {
    const error = new Error('NexaPay returned a transaction without a valid amount');
    error.statusCode = 502;
    throw error;
  }

  let result;
  try {
    result = await prisma.$transaction(
      (tx) => settleDeposit(tx, {
        schoolId,
        providerTxnId: transaction.id || null,
        reference,
        merchantReference: null,
        amountKobo: nexapayService.Kobo(transaction.amount),
        payerDetails: transaction.payer || null,
        providerRaw: transaction
      }),
      { timeout: 15000 }
    );
  } catch (error) {
    // The webhook settled this transaction while we were checking. Report the
    // settled payment instead of an error.
    if (error && error.code === 'P2002' && transaction.id) {
      const settled = await prisma.feePayment.findFirst({
        where: { schoolId, gateway: GATEWAY, providerTxnId: transaction.id }
      });
      if (settled) return toVerifyResult(settled.invoiceId ? 'confirmed' : 'review', settled, reference);
    }
    throw error;
  }

  logger.info('NexaPay collection verified', {
    schoolId,
    reference,
    transactionId: transaction.id,
    outcome: result.status
  });

  return toVerifyResult(result.status === 'review' ? 'review' : 'confirmed', result.payment, reference);
};

module.exports = {
  GATEWAY,
  DEFAULT_VALIDITY_MINUTES,
  createCollection,
  verifyCollection,
  findProviderTransaction,
  pickString
};
