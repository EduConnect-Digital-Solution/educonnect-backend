const crypto = require('crypto');
const logger = require('../utils/logger');
const { applyPaymentToInvoice, generateReceiptNumber } = require('./invoiceSettlement');

/**
 * Settle one NexaPay deposit against an invoice.
 *
 * Shared by the webhook and by manual verification so that both paths
 * de-duplicate on the same key: the provider transaction id. Must run inside a
 * Prisma transaction; the caller owns it.
 *
 * Idempotency, in order:
 *   1. a payment already carrying this providerTxnId means the deposit was applied;
 *   2. the pending session is claimed with a conditional update, so two
 *      concurrent settlements of the same session cannot both apply it;
 *   3. the unique (gateway, providerTxnId) index rejects a concurrent duplicate
 *      insert, which rolls the losing transaction back.
 */

const PROVIDER = 'nexapay';

const reviewReasonFor = ({ invoice, session, merchantReference }) => {
  if (session && merchantReference && session.invoiceId && merchantReference !== session.invoiceId) {
    return 'REFERENCE_MISMATCH';
  }
  if (!invoice) return 'NO_MATCHING_INVOICE';
  if (!invoice.isActive || invoice.status === 'void') return 'INVOICE_VOID';
  return null;
};

/**
 * @param {object} tx Prisma transaction client
 * @param {object} deposit
 * @param {string} deposit.schoolId tenant, from the verified merchant credentials
 * @param {string|null} deposit.providerTxnId NexaPay transaction id
 * @param {string|null} deposit.reference virtual account session reference
 * @param {string|null} deposit.merchantReference invoice id echoed by NexaPay
 * @param {number} deposit.amountKobo
 * @param {object} [deposit.payerDetails]
 * @param {object} [deposit.providerRaw]
 * @returns {Promise<{status: 'applied'|'review'|'duplicate', payment: object}>}
 *   applied: the invoice was credited; review: held, invoice untouched;
 *   duplicate: this transaction was settled before.
 */
const settleDeposit = async (tx, {
  schoolId,
  providerTxnId,
  reference,
  merchantReference,
  amountKobo,
  payerDetails = null,
  providerRaw = null
}) => {
  if (providerTxnId) {
    const already = await tx.feePayment.findFirst({ where: { gateway: PROVIDER, providerTxnId } });
    if (already && already.schoolId !== schoolId) {
      // Transaction ids are unique across NexaPay, so this should never
      // happen. If it does, another school's payment must not be returned
      // here or mistaken for this school's deposit.
      logger.error('NexaPay transaction id already recorded for another school', {
        schoolId,
        transactionId: providerTxnId
      });
      throw new Error('NexaPay transaction is already recorded for another school');
    }
    if (already) {
      logger.info('NexaPay deposit already applied', { schoolId, transactionId: providerTxnId });
      return { status: 'duplicate', payment: already };
    }
  }

  // Tenant-scoped: a reference from another school is never matched.
  const session = reference
    ? await tx.feePayment.findFirst({
        where: { schoolId, gateway: PROVIDER, gatewayReference: reference },
        orderBy: { createdAt: 'desc' }
      })
    : null;

  // Our own session is the authoritative link to the invoice. The echoed
  // merchantReference is only used when no session exists.
  const invoiceId = (session && session.invoiceId) || merchantReference || null;
  const invoice = invoiceId
    ? await tx.feeInvoice.findFirst({
        where: { id: invoiceId, schoolId },
        select: { id: true, studentId: true, status: true, isActive: true }
      })
    : null;

  const paidAt = new Date();
  const confirmed = {
    amount: amountKobo,
    status: 'confirmed',
    providerTxnId,
    paidAt,
    payerDetails,
    providerRaw
  };
  const standalone = {
    schoolId,
    gateway: PROVIDER,
    gatewayReference: reference || null,
    referenceNumber: reference || null,
    paymentMethod: 'bank_transfer',
    receivedBy: null,
    ...confirmed
  };

  // A pending session can only be claimed once; a later deposit to the same
  // virtual account (a second instalment) becomes its own payment row.
  const claimSession = async (data) => {
    if (!session || session.status !== 'pending') return null;
    const claimed = await tx.feePayment.updateMany({
      where: { id: session.id, status: 'pending' },
      data
    });
    return claimed.count === 1 ? tx.feePayment.findUnique({ where: { id: session.id } }) : null;
  };

  // A verified deposit whose amount we cannot read is still recorded, so the
  // money is never silently lost. It stays pending: nothing is credited.
  if (!Number.isInteger(amountKobo) || amountKobo <= 0) {
    const payment = await tx.feePayment.create({
      data: {
        ...standalone,
        amount: 0,
        status: 'pending',
        paidAt: null,
        // Left unset so a corrected re-delivery of the same transfer can
        // still be applied; the id stays in providerRaw for reconciliation.
        providerTxnId: null,
        invoiceId: null,
        needsReview: true,
        reviewReason: 'INVALID_AMOUNT'
      }
    });
    logger.warn('NexaPay deposit held for review', { schoolId, transactionId: providerTxnId, reason: 'INVALID_AMOUNT' });
    return { status: 'review', payment };
  }

  const reviewReason = !providerTxnId
    ? 'MISSING_TRANSACTION_ID'
    : reviewReasonFor({ invoice, session, merchantReference });

  if (reviewReason) {
    // Held money is not linked to any invoice, so it never counts towards an
    // invoice's payment history until someone reconciles it.
    const review = { ...confirmed, invoiceId: null, needsReview: true, reviewReason };
    const payment = (await claimSession(review)) || await tx.feePayment.create({
      data: { ...standalone, ...review }
    });
    logger.warn('NexaPay deposit held for review', {
      schoolId,
      transactionId: providerTxnId,
      reason: reviewReason
    });
    return { status: 'review', payment };
  }

  const payment = (await claimSession(confirmed)) || await tx.feePayment.create({
    data: { ...standalone, invoiceId: invoice.id }
  });

  const settled = await applyPaymentToInvoice(tx, { invoiceId: invoice.id, schoolId, amount: amountKobo });
  if (!settled) {
    // The invoice was voided between the lookup above and the update.
    const held = await tx.feePayment.update({
      where: { id: payment.id },
      data: { invoiceId: null, needsReview: true, reviewReason: 'INVOICE_VOID' }
    });
    logger.warn('NexaPay deposit held for review', { schoolId, transactionId: providerTxnId, reason: 'INVOICE_VOID' });
    return { status: 'review', payment: held };
  }

  const paymentCount = await tx.feePayment.count({ where: { invoiceId: invoice.id } });
  const receiptNumber = generateReceiptNumber(paymentCount, crypto.randomBytes(3).toString('hex').toUpperCase());
  const overpaid = settled.overpaidBy > 0;

  const finalPayment = await tx.feePayment.update({
    where: { id: payment.id },
    data: {
      receiptNumber,
      needsReview: overpaid,
      reviewReason: overpaid ? 'OVERPAID' : null
    }
  });

  await tx.feeLedgerEntry.create({
    data: {
      schoolId,
      studentId: invoice.studentId,
      type: 'credit',
      amount: amountKobo,
      balance: settled.amountDue,
      description: `NexaPay bank transfer ${reference || providerTxnId}`,
      reference: payment.id,
      account: 'receivable',
      entryDate: paidAt
    }
  });

  if (overpaid) {
    logger.warn('NexaPay deposit overpaid the invoice', {
      schoolId,
      invoiceId: invoice.id,
      transactionId: providerTxnId,
      overpaidBy: settled.overpaidBy
    });
  }

  // An overpayment is still applied; payment.needsReview flags it for a refund
  // or carry-forward decision.
  return { status: 'applied', payment: finalPayment };
};

module.exports = {
  PROVIDER,
  settleDeposit
};
