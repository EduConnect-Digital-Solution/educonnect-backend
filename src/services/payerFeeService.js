const { prisma } = require('../config/database');
const nexapayStrategy = require('./nexapayStrategy');

/**
 * Fee access for the people who pay: parents (for their linked children) and
 * students (for themselves).
 *
 * The admin fee endpoints are school-wide. Everything here is narrowed to the
 * caller's own students first, using the same links the parent and student
 * dashboards use: ParentStudent.parentId for parents, Student.userId for
 * students. An invoice outside that set is reported as "not found", so the
 * endpoints cannot be used to probe other students' invoices.
 */

const PAYABLE_STATUSES = ['pending', 'partial', 'overdue'];

const getPayableStudentIds = async ({ userId, role, schoolId }) => {
  if (role === 'parent') {
    const children = await prisma.student.findMany({
      where: { schoolId, isActive: true, parentOf: { some: { parentId: userId } } },
      select: { id: true }
    });
    return children.map((child) => child.id);
  }
  if (role === 'student') {
    const self = await prisma.student.findFirst({
      where: { userId, schoolId, isActive: true },
      select: { id: true }
    });
    return self ? [self.id] : [];
  }
  return [];
};

const findOwnedInvoice = async (user, invoiceId) => {
  const studentIds = await getPayableStudentIds(user);
  if (studentIds.length === 0) return null;
  return prisma.feeInvoice.findFirst({
    where: { id: invoiceId, schoolId: user.schoolId, isActive: true, studentId: { in: studentIds } }
  });
};

/** Open invoices for the caller's own students. */
const getMyInvoices = async (user) => {
  const studentIds = await getPayableStudentIds(user);
  if (studentIds.length === 0) return { invoices: [] };

  const invoices = await prisma.feeInvoice.findMany({
    where: { schoolId: user.schoolId, isActive: true, studentId: { in: studentIds } },
    orderBy: { dueDate: 'asc' },
    select: {
      id: true,
      invoiceNumber: true,
      studentId: true,
      studentName: true,
      className: true,
      feeStructureName: true,
      amount: true,
      amountPaid: true,
      amountDue: true,
      dueDate: true,
      status: true
    }
  });

  return {
    invoices: invoices.map((invoice) => ({ ...invoice, payable: PAYABLE_STATUSES.includes(invoice.status) }))
  };
};

/** Open (or reuse) a NexaPay virtual account for one of the caller's invoices. */
const startNexapayPayment = async (user, invoiceId, { amount } = {}) => {
  const invoice = await findOwnedInvoice(user, invoiceId);
  if (!invoice) throw new Error('Invoice not found');

  return nexapayStrategy.createCollection({
    schoolId: user.schoolId,
    invoiceId: invoice.id,
    amount,
    userId: user.userId,
    payer: { email: user.email }
  });
};

/**
 * Verify one of the caller's NexaPay payments. The payment belongs to the
 * caller when its invoice is theirs, or when they opened it (a payment held
 * for review is unlinked from its invoice but keeps who opened it).
 */
const verifyMyNexapayPayment = async (user, { reference, transactionId }) => {
  const payment = await prisma.feePayment.findFirst({
    where: { schoolId: user.schoolId, gateway: 'nexapay', gatewayReference: reference },
    orderBy: { createdAt: 'desc' },
    select: { invoiceId: true, receivedBy: true }
  });
  if (!payment) throw new Error('Payment not found for this reference');

  const ownsInvoice = payment.invoiceId ? Boolean(await findOwnedInvoice(user, payment.invoiceId)) : false;
  if (!ownsInvoice && payment.receivedBy !== user.userId) {
    throw new Error('Payment not found for this reference');
  }

  return nexapayStrategy.verifyCollection({ schoolId: user.schoolId, reference, transactionId });
};

module.exports = {
  getPayableStudentIds,
  getMyInvoices,
  startNexapayPayment,
  verifyMyNexapayPayment
};
