/**
 * Invoice settlement helpers shared by every payment path (manual, Paystack,
 * NexaPay). Kept free of gateway imports so any service can use them without
 * creating a require cycle.
 */

const generateReceiptNumber = (index, suffix) => {
  const ts = Date.now().toString(36).toUpperCase();
  const tail = suffix ? `-${suffix}` : '';
  return `RCP-${ts}${tail}-${String(index).padStart(4, '0')}`;
};

/**
 * Apply a payment to an invoice inside a transaction.
 *
 * The first UPDATE moves amountPaid and amountDue in one statement, so
 * Postgres holds the row lock until commit and concurrent payments queue
 * instead of overwriting each other. amountDue is decremented rather than
 * recomputed from `amount`, which keeps any discount or waiver already applied
 * to it. The UPDATE only matches a live invoice: Postgres re-checks the WHERE
 * after waiting for a concurrent void, so money never lands on a voided one.
 *
 * The UPDATE is also scoped to the paying school, so a payment can never
 * credit another tenant's invoice even if a caller's own check was wrong.
 *
 * @param {object} tx Prisma transaction client
 * @param {{invoiceId: string, schoolId: string, amount: number}} payment
 * @returns {Promise<{amountPaid: number, amountDue: number, status: string, overpaidBy: number}|null>}
 *   null when the invoice is voided, inactive, gone or in another school -
 *   the caller decides whether to fail or hold the payment for review.
 */
const applyPaymentToInvoice = async (tx, { invoiceId, schoolId, amount }) => {
  if (!schoolId) throw new Error('A school is required to apply a payment');
  const moved = await tx.feeInvoice.updateMany({
    where: { id: invoiceId, schoolId, isActive: true, status: { not: 'void' } },
    data: { amountPaid: { increment: amount }, amountDue: { decrement: amount } }
  });
  if (moved.count === 0) return null;

  const current = await tx.feeInvoice.findUnique({
    where: { id: invoiceId },
    select: { amountPaid: true, amountDue: true }
  });

  const overpaidBy = current.amountDue < 0 ? -current.amountDue : 0;
  const amountDue = Math.max(0, current.amountDue);
  const status = amountDue === 0 ? 'paid' : 'partial';

  await tx.feeInvoice.update({
    where: { id: invoiceId },
    data: { amountDue, status }
  });

  return { amountPaid: current.amountPaid, amountDue, status, overpaidBy };
};

module.exports = {
  generateReceiptNumber,
  applyPaymentToInvoice
};
