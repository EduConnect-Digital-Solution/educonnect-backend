/**
 * Receipts and reports for gateway payments.
 *
 * A payment settled by a webhook has no receiving user, and a deposit held for
 * review is not yet a collection against any invoice.
 */

jest.mock('../../config/database', () => ({
  prisma: {
    feePayment: { findFirst: jest.fn(), findMany: jest.fn() },
    feeInvoice: { findUnique: jest.fn(), findMany: jest.fn() },
    feeReceipt: { findUnique: jest.fn(), create: jest.fn() },
    school: { findUnique: jest.fn() },
    student: { findUnique: jest.fn(), findMany: jest.fn() },
    feeStructure: { findUnique: jest.fn() }
  },
  connectDB: jest.fn()
}));

jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../paystackService', () => ({}));
jest.mock('../nexapayStrategy', () => ({}));

const { prisma } = require('../../config/database');
const feeService = require('../feeService');

describe('feeService.getReceipt', () => {
  beforeEach(() => {
    prisma.feeInvoice.findUnique.mockResolvedValue({ id: 'invoice-1', studentId: 'student-1', feeStructureId: 'fs-1', amountDue: 0 });
    prisma.feeReceipt.findUnique.mockResolvedValue(null);
    prisma.school.findUnique.mockResolvedValue({ schoolName: 'Test School', address: 'Lagos' });
    prisma.student.findUnique.mockResolvedValue({ firstName: 'Ada', lastName: 'Lovelace', grade: 'JSS1' });
    prisma.feeStructure.findUnique.mockResolvedValue({ items: [{ name: 'Tuition', amount: 500000 }] });
    prisma.feeReceipt.create.mockImplementation(async ({ data }) => data);
  });

  it('should issue a receipt for a payment settled by a gateway webhook', async () => {
    prisma.feePayment.findFirst.mockResolvedValue({
      id: 'payment-1',
      invoiceId: 'invoice-1',
      amount: 500000,
      gateway: 'nexapay',
      paymentMethod: 'bank_transfer',
      receiptNumber: 'RCP-1',
      paidAt: new Date(),
      receivedBy: null
    });

    const { receipt } = await feeService.getReceipt('payment-1', 'school-1');

    expect(receipt.issuedBy).toBe('gateway:nexapay');
  });

  it('should keep the receiving user for a manual payment', async () => {
    prisma.feePayment.findFirst.mockResolvedValue({
      id: 'payment-2',
      invoiceId: 'invoice-1',
      amount: 500000,
      gateway: null,
      paymentMethod: 'cash',
      receiptNumber: 'RCP-2',
      paidAt: new Date(),
      receivedBy: 'admin-1'
    });

    const { receipt } = await feeService.getReceipt('payment-2', 'school-1');

    expect(receipt.issuedBy).toBe('admin-1');
  });
});

describe('feeService reports', () => {
  beforeEach(() => {
    prisma.feeInvoice.findMany.mockResolvedValue([]);
    prisma.feePayment.findMany.mockResolvedValue([]);
  });

  it('should leave held deposits out of the analytics', async () => {
    await feeService.getFeeAnalytics('school-1', {});

    expect(prisma.feePayment.findMany).toHaveBeenCalledWith({
      where: { schoolId: 'school-1', status: 'confirmed', invoiceId: { not: null } }
    });
  });

  it('should leave held deposits out of the collection report', async () => {
    await feeService.getCollectionReport('school-1', {});

    expect(prisma.feePayment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'confirmed', invoiceId: { not: null } })
    }));
  });
});
