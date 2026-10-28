/**
 * Removing a person: the account is closed and personal details are erased,
 * while the records they were attached to are kept.
 */

jest.mock('@prisma/client', () => ({ Prisma: { DbNull: 'DB_NULL' } }));

jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('unusable-hash') }));

jest.mock('../../config/database', () => {
  const prisma = {
    school: { findFirst: jest.fn() },
    user: { findFirst: jest.fn(), update: jest.fn() },
    student: { findFirst: jest.fn(), update: jest.fn() },
    invitation: { deleteMany: jest.fn() },
    oTP: { deleteMany: jest.fn() },
    feeInvoice: { findMany: jest.fn(), updateMany: jest.fn() },
    feePayment: { findMany: jest.fn() },
    feeReceipt: { updateMany: jest.fn() }
  };
  prisma.$transaction = jest.fn(async (callback) => callback(prisma));
  return { prisma, connectDB: jest.fn() };
});

jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../cacheService', () => ({ invalidatePlatformCachesForSchool: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../sessionService', () => ({ revokeAllSessions: jest.fn().mockResolvedValue(1) }));
jest.mock('../platformAuditService', () => ({
  recordInTransaction: jest.fn().mockResolvedValue({}),
  record: jest.fn()
}));

const { prisma } = require('../../config/database');
const SessionService = require('../sessionService');
const AccessGuard = require('../accessGuard');
const audit = require('../platformAuditService');
const removal = require('../accountRemovalService');

const school = (overrides = {}) => ({ id: 'school-uuid', schoolId: 'ABC1234', schoolName: 'Greenfield', adminUserId: 'admin-1', ...overrides });
const user = (overrides = {}) => ({
  id: 'user-1', schoolId: 'school-uuid', email: 'ngozi@school.test', role: 'parent', firstName: 'Ngozi', lastName: 'Eze', ...overrides
});
const student = (overrides = {}) => ({
  id: 'student-1', schoolId: 'school-uuid', userId: null, firstName: 'Ada', lastName: 'Okafor', email: 'ada@school.test', isActive: true, ...overrides
});

describe('accountRemovalService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(prisma).forEach((delegate) => {
      if (delegate && typeof delegate === 'object') Object.values(delegate).forEach((fn) => fn.mockReset && fn.mockReset());
    });
    prisma.school.findFirst.mockResolvedValue(school());
    prisma.user.update.mockResolvedValue({});
    prisma.student.update.mockResolvedValue({});
    prisma.student.findFirst.mockResolvedValue(null);
    prisma.feeInvoice.findMany.mockResolvedValue([]);
    audit.recordInTransaction.mockResolvedValue({});
    jest.spyOn(AccessGuard, 'invalidateUser');
  });

  describe('removeUser', () => {
    it('should close the account and erase every personal detail', async () => {
      prisma.user.findFirst.mockResolvedValue(user());

      const result = await removal.removeUser('ABC1234', 'user-1', { reason: 'Parent asked for erasure' }, 'root');

      const { data } = prisma.user.update.mock.calls[0][0];
      expect(data).toEqual(expect.objectContaining({
        firstName: 'Removed',
        lastName: 'User',
        email: 'removed-user-1@removed.invalid',
        password: 'unusable-hash',
        phone: null,
        address: null,
        profileImage: null,
        occupation: null,
        emergencyContact: null,
        emergencyPhone: null,
        invitationToken: null,
        passwordResetToken: null,
        settings: 'DB_NULL',
        isActive: false,
        deactivatedBy: 'root',
        deactivationReason: 'Parent asked for erasure'
      }));
      expect(data.deactivatedAt).toBeInstanceOf(Date);
      expect(result.removed).toEqual({ type: 'user', id: 'user-1', role: 'parent' });
    });

    it('should delete the pending invitations and one-time codes that hold their email', async () => {
      prisma.user.findFirst.mockResolvedValue(user());

      await removal.removeUser('ABC1234', 'user-1', { reason: 'Parent asked for erasure' }, 'root');

      const where = { schoolId: { in: ['school-uuid', 'ABC1234'] }, email: 'ngozi@school.test' };
      expect(prisma.invitation.deleteMany).toHaveBeenCalledWith({ where });
      expect(prisma.oTP.deleteMany).toHaveBeenCalledWith({ where });
    });

    it('should log them out everywhere', async () => {
      prisma.user.findFirst.mockResolvedValue(user());

      await removal.removeUser('ABC1234', 'user-1', { reason: 'Parent asked for erasure' }, 'root');

      expect(SessionService.revokeAllSessions).toHaveBeenCalledWith('user-1');
      expect(AccessGuard.invalidateUser).toHaveBeenCalledWith('user-1');
    });

    it('should keep personal details out of the audit row', async () => {
      prisma.user.findFirst.mockResolvedValue(user());

      await removal.removeUser('ABC1234', 'user-1', { reason: 'Parent asked for erasure' }, 'root');

      const entry = audit.recordInTransaction.mock.calls[0][1];
      expect(entry).toEqual(expect.objectContaining({ action: 'user.remove', entityId: 'user-1', schoolId: 'school-uuid' }));
      expect(JSON.stringify(entry)).not.toMatch(/ngozi|Eze|school\.test/);
    });

    it('should erase a linked student profile together with the account', async () => {
      prisma.user.findFirst.mockResolvedValue(user({ role: 'student' }));
      prisma.student.findFirst.mockResolvedValue(student({ userId: 'user-1' }));
      prisma.feeInvoice.findMany.mockResolvedValue([{ id: 'inv-1' }]);
      prisma.feePayment.findMany.mockResolvedValue([{ id: 'pay-1' }]);

      const result = await removal.removeUser('ABC1234', 'user-1', { reason: 'Left the school' }, 'root');

      expect(prisma.student.update).toHaveBeenCalledTimes(1);
      expect(result.studentProfileRemoved).toBe('student-1');
    });

    it('should refuse to remove the primary admin of the school', async () => {
      prisma.user.findFirst.mockResolvedValue(user({ id: 'admin-1', role: 'admin' }));

      await expect(removal.removeUser('ABC1234', 'admin-1', { reason: 'Left the school' }, 'root'))
        .rejects.toMatchObject({ statusCode: 409, code: 'PRIMARY_ADMIN' });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should refuse someone already removed', async () => {
      prisma.user.findFirst.mockResolvedValue(user({ email: 'removed-user-1@removed.invalid' }));

      await expect(removal.removeUser('ABC1234', 'user-1', { reason: 'Left the school' }, 'root'))
        .rejects.toMatchObject({ statusCode: 409, code: 'ALREADY_REMOVED' });
    });

    it('should look only inside the named school', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(removal.removeUser('ABC1234', 'user-of-another-school', { reason: 'Left the school' }, 'root'))
        .rejects.toMatchObject({ statusCode: 404, code: 'USER_NOT_FOUND' });
      expect(prisma.user.findFirst).toHaveBeenCalledWith({ where: { id: 'user-of-another-school', schoolId: 'school-uuid' } });
    });
  });

  describe('removeStudent', () => {
    it('should erase the student\'s details and keep the record', async () => {
      prisma.student.findFirst.mockResolvedValue(student());

      const result = await removal.removeStudent('ABC1234', 'student-1', { reason: 'Guardian asked for erasure' }, 'root');

      const { data } = prisma.student.update.mock.calls[0][0];
      expect(data).toEqual(expect.objectContaining({
        firstName: 'Removed',
        lastName: 'Student',
        email: null,
        phone: null,
        address: null,
        dateOfBirth: null,
        profileImage: null,
        notes: null,
        guardian: 'DB_NULL',
        isActive: false,
        isEnrolled: false,
        deactivatedBy: 'root'
      }));
      expect(prisma.student).not.toHaveProperty('delete');
      expect(result.removed).toEqual({ type: 'student', id: 'student-1' });
      expect(result.loginRemoved).toBeNull();
    });

    it('should scrub the student\'s name from fee invoices and receipts', async () => {
      prisma.student.findFirst.mockResolvedValue(student());
      prisma.feeInvoice.findMany.mockResolvedValue([{ id: 'inv-1' }, { id: 'inv-2' }]);
      prisma.feePayment.findMany.mockResolvedValue([{ id: 'pay-1' }]);

      await removal.removeStudent('ABC1234', 'student-1', { reason: 'Guardian asked for erasure' }, 'root');

      expect(prisma.feeInvoice.findMany).toHaveBeenCalledWith({ where: { schoolId: 'school-uuid', studentId: 'student-1' }, select: { id: true } });
      expect(prisma.feeInvoice.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['inv-1', 'inv-2'] } },
        data: { studentName: 'Removed Student' }
      });
      expect(prisma.feeReceipt.updateMany).toHaveBeenCalledWith({
        where: { paymentId: { in: ['pay-1'] } },
        data: { studentInfo: { name: 'Removed Student', className: null } }
      });
    });

    it('should leave fee documents alone when the student has none', async () => {
      prisma.student.findFirst.mockResolvedValue(student());

      await removal.removeStudent('ABC1234', 'student-1', { reason: 'Guardian asked for erasure' }, 'root');

      expect(prisma.feeInvoice.updateMany).not.toHaveBeenCalled();
      expect(prisma.feeReceipt.updateMany).not.toHaveBeenCalled();
    });

    it('should also close the student\'s login', async () => {
      prisma.student.findFirst.mockResolvedValue(student({ userId: 'user-9' }));
      prisma.user.findFirst.mockResolvedValue(user({ id: 'user-9', role: 'student' }));

      const result = await removal.removeStudent('ABC1234', 'student-1', { reason: 'Guardian asked for erasure' }, 'root');

      expect(prisma.user.update.mock.calls[0][0].where).toEqual({ id: 'user-9' });
      expect(result.loginRemoved).toBe('user-9');
      expect(SessionService.revokeAllSessions).toHaveBeenCalledWith('user-9');
    });

    it('should refuse a student already removed', async () => {
      prisma.student.findFirst.mockResolvedValue(student({ firstName: 'Removed', lastName: 'Student', email: null, isActive: false }));

      await expect(removal.removeStudent('ABC1234', 'student-1', { reason: 'Guardian asked for erasure' }, 'root'))
        .rejects.toMatchObject({ statusCode: 409, code: 'ALREADY_REMOVED' });
    });

    it('should answer 404 for a student of another school', async () => {
      prisma.student.findFirst.mockResolvedValue(null);

      await expect(removal.removeStudent('ABC1234', 'student-of-another-school', { reason: 'Guardian asked for erasure' }, 'root'))
        .rejects.toMatchObject({ statusCode: 404, code: 'STUDENT_NOT_FOUND' });
    });

    it('should not remove anything when the audit row cannot be written', async () => {
      prisma.student.findFirst.mockResolvedValue(student());
      audit.recordInTransaction.mockRejectedValue(new Error('audit unavailable'));

      await expect(removal.removeStudent('ABC1234', 'student-1', { reason: 'Guardian asked for erasure' }, 'root')).rejects.toThrow('audit unavailable');
      expect(SessionService.revokeAllSessions).not.toHaveBeenCalled();
    });
  });
});
