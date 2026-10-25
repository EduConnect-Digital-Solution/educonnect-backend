/**
 * Parent / student self-service payment tests.
 *
 * A parent may only see and pay their own linked children's invoices; a
 * student only their own. Anything else must look like it does not exist.
 */

jest.mock('../../config/database', () => ({
  prisma: {
    student: { findMany: jest.fn(), findFirst: jest.fn() },
    feeInvoice: { findFirst: jest.fn(), findMany: jest.fn() },
    feePayment: { findFirst: jest.fn() }
  },
  connectDB: jest.fn()
}));

jest.mock('../nexapayStrategy', () => ({
  createCollection: jest.fn(),
  verifyCollection: jest.fn()
}));

const { prisma } = require('../../config/database');
const nexapayStrategy = require('../nexapayStrategy');
const payerFeeService = require('../payerFeeService');

const SCHOOL_ID = 'school-1';
const PARENT = { userId: 'parent-user-1', role: 'parent', schoolId: SCHOOL_ID, email: 'parent@example.com' };
const STUDENT = { userId: 'student-user-1', role: 'student', schoolId: SCHOOL_ID, email: 'ada@example.com' };

describe('payerFeeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.student.findMany.mockResolvedValue([{ id: 'child-1' }, { id: 'child-2' }]);
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    nexapayStrategy.createCollection.mockResolvedValue({ gateway: 'nexapay', reference: 'nxa_1', accountNumber: '0123456789' });
    nexapayStrategy.verifyCollection.mockResolvedValue({ status: 'confirmed', payment: { reference: 'nxa_1' } });
  });

  describe('getPayableStudentIds', () => {
    it('should resolve a parent to their linked children in their school', async () => {
      const ids = await payerFeeService.getPayableStudentIds(PARENT);

      expect(ids).toEqual(['child-1', 'child-2']);
      expect(prisma.student.findMany).toHaveBeenCalledWith({
        where: { schoolId: SCHOOL_ID, isActive: true, parentOf: { some: { parentId: 'parent-user-1' } } },
        select: { id: true }
      });
    });

    it('should resolve a student to their own profile', async () => {
      const ids = await payerFeeService.getPayableStudentIds(STUDENT);

      expect(ids).toEqual(['student-1']);
      expect(prisma.student.findFirst).toHaveBeenCalledWith({
        where: { userId: 'student-user-1', schoolId: SCHOOL_ID, isActive: true },
        select: { id: true }
      });
    });

    it('should resolve nobody for any other role', async () => {
      expect(await payerFeeService.getPayableStudentIds({ ...PARENT, role: 'teacher' })).toEqual([]);
    });
  });

  describe('getMyInvoices', () => {
    it('should list only the caller\'s students\' invoices', async () => {
      prisma.feeInvoice.findMany.mockResolvedValue([{ id: 'invoice-1', status: 'partial' }, { id: 'invoice-2', status: 'paid' }]);

      const { invoices } = await payerFeeService.getMyInvoices(PARENT);

      expect(prisma.feeInvoice.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { schoolId: SCHOOL_ID, isActive: true, studentId: { in: ['child-1', 'child-2'] } }
      }));
      expect(invoices).toEqual([
        { id: 'invoice-1', status: 'partial', payable: true },
        { id: 'invoice-2', status: 'paid', payable: false }
      ]);
    });

    it('should return nothing for a parent with no linked children', async () => {
      prisma.student.findMany.mockResolvedValue([]);

      const { invoices } = await payerFeeService.getMyInvoices(PARENT);

      expect(invoices).toEqual([]);
      expect(prisma.feeInvoice.findMany).not.toHaveBeenCalled();
    });
  });

  describe('startNexapayPayment', () => {
    it('should open a collection for the parent\'s own child\'s invoice', async () => {
      prisma.feeInvoice.findFirst.mockResolvedValue({ id: 'invoice-1' });

      const result = await payerFeeService.startNexapayPayment(PARENT, 'invoice-1', { amount: 150000 });

      expect(result.accountNumber).toBe('0123456789');
      expect(prisma.feeInvoice.findFirst).toHaveBeenCalledWith({
        where: { id: 'invoice-1', schoolId: SCHOOL_ID, isActive: true, studentId: { in: ['child-1', 'child-2'] } }
      });
      expect(nexapayStrategy.createCollection).toHaveBeenCalledWith({
        schoolId: SCHOOL_ID,
        invoiceId: 'invoice-1',
        amount: 150000,
        userId: 'parent-user-1',
        payer: { email: 'parent@example.com' }
      });
    });

    it('should refuse another student\'s invoice as if it did not exist', async () => {
      prisma.feeInvoice.findFirst.mockResolvedValue(null);

      await expect(payerFeeService.startNexapayPayment(PARENT, 'invoice-of-someone-else')).rejects.toThrow('Invoice not found');
      expect(nexapayStrategy.createCollection).not.toHaveBeenCalled();
    });

    it('should refuse when the caller has no linked students', async () => {
      prisma.student.findFirst.mockResolvedValue(null);

      await expect(payerFeeService.startNexapayPayment(STUDENT, 'invoice-1')).rejects.toThrow('Invoice not found');
      expect(prisma.feeInvoice.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('verifyMyNexapayPayment', () => {
    it('should verify a payment on the caller\'s own invoice', async () => {
      prisma.feePayment.findFirst.mockResolvedValue({ invoiceId: 'invoice-1', receivedBy: 'admin-1' });
      prisma.feeInvoice.findFirst.mockResolvedValue({ id: 'invoice-1' });

      const result = await payerFeeService.verifyMyNexapayPayment(PARENT, { reference: 'nxa_1', transactionId: 'txn_1' });

      expect(result.status).toBe('confirmed');
      expect(nexapayStrategy.verifyCollection).toHaveBeenCalledWith({ schoolId: SCHOOL_ID, reference: 'nxa_1', transactionId: 'txn_1' });
    });

    it('should verify a held payment the caller opened', async () => {
      prisma.feePayment.findFirst.mockResolvedValue({ invoiceId: null, receivedBy: 'parent-user-1' });

      await payerFeeService.verifyMyNexapayPayment(PARENT, { reference: 'nxa_1' });

      expect(nexapayStrategy.verifyCollection).toHaveBeenCalled();
    });

    it('should refuse someone else\'s payment as if it did not exist', async () => {
      prisma.feePayment.findFirst.mockResolvedValue({ invoiceId: 'invoice-9', receivedBy: 'admin-1' });
      prisma.feeInvoice.findFirst.mockResolvedValue(null);

      await expect(
        payerFeeService.verifyMyNexapayPayment(PARENT, { reference: 'nxa_9' })
      ).rejects.toThrow('Payment not found for this reference');
      expect(nexapayStrategy.verifyCollection).not.toHaveBeenCalled();
    });

    it('should scope the reference lookup to the caller\'s school', async () => {
      prisma.feePayment.findFirst.mockResolvedValue(null);

      await expect(payerFeeService.verifyMyNexapayPayment(PARENT, { reference: 'nxa_1' })).rejects.toThrow(/not found/);
      expect(prisma.feePayment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { schoolId: SCHOOL_ID, gateway: 'nexapay', gatewayReference: 'nxa_1' }
      }));
    });
  });
});
