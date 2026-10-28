/**
 * School lifecycle tests: archive, restore, soft delete and the read models.
 */

jest.mock('../../config/database', () => {
  const prisma = {
    school: { findFirst: jest.fn(), update: jest.fn() },
    user: { count: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    student: { count: jest.fn(), findMany: jest.fn() },
    class: { count: jest.fn() },
    invitation: { count: jest.fn() }
  };
  return { prisma, connectDB: jest.fn() };
});

jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../cacheService', () => ({ invalidatePlatformCachesForSchool: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../platformAuditService', () => ({
  recordInTransaction: jest.fn().mockResolvedValue({}),
  record: jest.fn()
}));

const { prisma } = require('../../config/database');
const AccessGuard = require('../accessGuard');
const audit = require('../platformAuditService');
const lifecycle = require('../schoolLifecycleService');


const school = (overrides = {}) => ({
  id: 'school-uuid',
  schoolId: 'ABC1234',
  schoolName: 'Greenfield Academy',
  email: 'head@greenfield.test',
  isActive: true,
  isVerified: true,
  archivedAt: null,
  adminUserId: 'admin-1',
  systemConfig: { subscriptionTier: 'basic', subscriptionStatus: 'trial' },
  systemMetadata: { systemNotes: [] },
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  ...overrides
});

const useTransaction = (tx) => {
  prisma.$transaction = jest.fn(async (callback) => callback(tx));
};

describe('schoolLifecycleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.school.findFirst.mockReset();
    prisma.school.update.mockReset().mockResolvedValue({});
    audit.recordInTransaction.mockReset().mockResolvedValue({});
    jest.spyOn(AccessGuard, 'invalidateAll');
  });

  describe('archiveSchool', () => {
    const tx = { school: { update: jest.fn().mockResolvedValue({}) } };
    beforeEach(() => { tx.school.update.mockClear(); useTransaction(tx); });

    it('should lock the school and keep its data, recording who and why', async () => {
      prisma.school.findFirst.mockResolvedValue(school());

      const result = await lifecycle.archiveSchool(
        'ABC1234',
        { reason: 'Contract ended in July', confirmSchoolName: 'Greenfield Academy' },
        'root@educonnect.test',
        { ip: '10.0.0.1' }
      );

      const { data } = tx.school.update.mock.calls[0][0];
      expect(data).toEqual(expect.objectContaining({
        isActive: false,
        archivedBy: 'root@educonnect.test',
        archiveReason: 'Contract ended in July'
      }));
      expect(data.archivedAt).toBeInstanceOf(Date);
      expect(data.systemMetadata.systemNotes[0].note).toBe('School archived: Contract ended in July');

      expect(audit.recordInTransaction).toHaveBeenCalledWith(tx, expect.objectContaining({
        action: 'school.archive', entityId: 'ABC1234', schoolId: 'school-uuid', actor: 'root@educonnect.test'
      }));
      expect(result.school.status).toBe('archived');
      expect(AccessGuard.invalidateAll).toHaveBeenCalled();
    });

    it('should accept the name in any case and with stray spaces', async () => {
      prisma.school.findFirst.mockResolvedValue(school());

      await expect(
        lifecycle.archiveSchool('ABC1234', { reason: 'Contract ended in July', confirmSchoolName: '  greenfield ACADEMY ' }, 'root')
      ).resolves.toBeDefined();
    });

    it('should refuse when the typed name does not match, changing nothing', async () => {
      prisma.school.findFirst.mockResolvedValue(school());

      await expect(
        lifecycle.archiveSchool('ABC1234', { reason: 'Contract ended in July', confirmSchoolName: 'Greenfield' }, 'root')
      ).rejects.toMatchObject({ statusCode: 400, code: 'CONFIRMATION_MISMATCH' });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should refuse a school that is already archived', async () => {
      prisma.school.findFirst.mockResolvedValue(school({ archivedAt: new Date(), isActive: false }));

      await expect(
        lifecycle.archiveSchool('ABC1234', { reason: 'Contract ended in July', confirmSchoolName: 'Greenfield Academy' }, 'root')
      ).rejects.toMatchObject({ statusCode: 409, code: 'SCHOOL_ALREADY_ARCHIVED' });
    });

    it('should answer 404 for an unknown school', async () => {
      prisma.school.findFirst.mockResolvedValue(null);

      await expect(
        lifecycle.archiveSchool('ZZZ9999', { reason: 'Contract ended in July', confirmSchoolName: 'x' }, 'root')
      ).rejects.toMatchObject({ statusCode: 404, code: 'SCHOOL_NOT_FOUND' });
    });

    it('should not archive when the audit row cannot be written', async () => {
      prisma.school.findFirst.mockResolvedValue(school());
      audit.recordInTransaction.mockRejectedValue(new Error('audit unavailable'));

      await expect(
        lifecycle.archiveSchool('ABC1234', { reason: 'Contract ended in July', confirmSchoolName: 'Greenfield Academy' }, 'root')
      ).rejects.toThrow('audit unavailable');
      expect(AccessGuard.invalidateAll).not.toHaveBeenCalled();
    });
  });

  describe('restoreSchool', () => {
    const tx = { school: { update: jest.fn().mockResolvedValue({}) } };
    beforeEach(() => { tx.school.update.mockClear(); useTransaction(tx); });

    it('should bring an archived school back and clear the archive fields', async () => {
      prisma.school.findFirst.mockResolvedValue(school({ archivedAt: new Date(), isActive: false, archivedBy: 'root', archiveReason: 'x' }));

      const result = await lifecycle.restoreSchool('ABC1234', { reason: 'Paid the outstanding invoice' }, 'root');

      expect(tx.school.update.mock.calls[0][0].data).toEqual(expect.objectContaining({
        isActive: true, archivedAt: null, archivedBy: null, archiveReason: null
      }));
      expect(audit.recordInTransaction).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'school.restore' }));
      expect(result.school.status).toBe('active');
      expect(AccessGuard.invalidateAll).toHaveBeenCalled();
    });

    it('should refuse a school that is not archived', async () => {
      prisma.school.findFirst.mockResolvedValue(school());

      await expect(lifecycle.restoreSchool('ABC1234', { reason: 'Paid the outstanding invoice' }, 'root'))
        .rejects.toMatchObject({ statusCode: 409, code: 'SCHOOL_NOT_ARCHIVED' });
    });
  });

  describe('deleteSchool', () => {
    const tx = { school: { update: jest.fn().mockResolvedValue({}) } };
    const request = { confirmSchoolName: 'Greenfield Academy', reason: 'Closed down for good' };
    beforeEach(() => { tx.school.update.mockClear(); useTransaction(tx); });

    it('should flag the school as deleted and lock it, erasing nothing', async () => {
      prisma.school.findFirst.mockResolvedValue(school());

      const result = await lifecycle.deleteSchool('ABC1234', request, 'root', { ip: '10.0.0.1' });

      const { data } = tx.school.update.mock.calls[0][0];
      expect(data).toEqual(expect.objectContaining({
        isDeleted: true, isActive: false, deletedBy: 'root', deleteReason: 'Closed down for good'
      }));
      expect(data.deletedAt).toBeInstanceOf(Date);
      expect(audit.recordInTransaction).toHaveBeenCalledWith(tx, expect.objectContaining({
        action: 'school.delete', entityId: 'ABC1234', actor: 'root'
      }));
      expect(result.school.status).toBe('deleted');
      expect(AccessGuard.invalidateAll).toHaveBeenCalled();
    });

    it('should refuse when the typed name is wrong', async () => {
      prisma.school.findFirst.mockResolvedValue(school());

      await expect(lifecycle.deleteSchool('ABC1234', { ...request, confirmSchoolName: 'Other' }, 'root'))
        .rejects.toMatchObject({ statusCode: 400, code: 'CONFIRMATION_MISMATCH' });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should refuse a school that is already deleted', async () => {
      prisma.school.findFirst.mockResolvedValue(school({ isDeleted: true, isActive: false }));

      await expect(lifecycle.deleteSchool('ABC1234', request, 'root'))
        .rejects.toMatchObject({ statusCode: 409, code: 'SCHOOL_ALREADY_DELETED' });
    });

    it('should be undone by restore, which clears the deleted flag', async () => {
      prisma.school.findFirst.mockResolvedValue(school({ isDeleted: true, isActive: false, deletedAt: new Date() }));

      const result = await lifecycle.restoreSchool('ABC1234', { reason: 'Deleted by mistake' }, 'root');

      expect(tx.school.update.mock.calls[0][0].data).toEqual(expect.objectContaining({
        isDeleted: false, deletedAt: null, deletedBy: null, deleteReason: null, isActive: true
      }));
      expect(result.school.status).toBe('active');
    });
  });
  describe('staffStatusOf', () => {
    const person = (overrides) => ({
      isActive: true, deactivatedAt: null, isVerified: true, invitedBy: 'admin-1', isTemporaryPassword: false, ...overrides
    });

    it('should tell imported, invited, active and inactive staff apart', () => {
      expect(lifecycle.staffStatusOf(person({ isVerified: false, invitedBy: null, isTemporaryPassword: true }))).toBe('not_invited');
      expect(lifecycle.staffStatusOf(person({ isTemporaryPassword: true }))).toBe('invited');
      expect(lifecycle.staffStatusOf(person())).toBe('active');
      expect(lifecycle.staffStatusOf(person({ isActive: false }))).toBe('inactive');
      expect(lifecycle.staffStatusOf(person({ deactivatedAt: new Date() }))).toBe('inactive');
    });
  });

  describe('getSchoolDetail', () => {
    it('should describe the school without exposing credentials', async () => {
      prisma.school.findFirst.mockResolvedValue({ ...school(), password: 'secret-hash', passwordResetToken: 'token' });
      prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', firstName: 'Ada', lastName: 'Obi', email: 'head@greenfield.test', isActive: true });
      prisma.user.count.mockResolvedValue(4);
      prisma.student.count.mockResolvedValue(120);
      prisma.class.count.mockResolvedValue(9);
      prisma.invitation.count.mockResolvedValue(2);

      const detail = await lifecycle.getSchoolDetail('ABC1234');

      expect(JSON.stringify(detail)).not.toMatch(/secret-hash|passwordResetToken|"password"/);
      expect(detail.school).toEqual(expect.objectContaining({ schoolId: 'ABC1234', status: 'active' }));
      expect(detail.school.subscription.tier).toBe('basic');
      expect(detail.admin.email).toBe('head@greenfield.test');
      expect(detail.statistics).toEqual(expect.objectContaining({ students: 120, activeClasses: 9, pendingInvitations: 2 }));
      expect(detail.archive).toBeNull();
    });

    it('should describe the archive for an archived school', async () => {
      prisma.school.findFirst.mockResolvedValue(school({ isActive: false, archivedAt: new Date('2026-09-01'), archivedBy: 'root', archiveReason: 'x' }));
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.count.mockResolvedValue(0);
      prisma.student.count.mockResolvedValue(0);
      prisma.class.count.mockResolvedValue(0);
      prisma.invitation.count.mockResolvedValue(0);

      const detail = await lifecycle.getSchoolDetail('ABC1234');

      expect(detail.school.status).toBe('archived');
      expect(detail.archive).toEqual(expect.objectContaining({ archivedBy: 'root' }));
    });
  });

  describe('listStaff', () => {
    beforeEach(() => {
      prisma.school.findFirst.mockResolvedValue(school());
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', firstName: 'Tunde', lastName: 'Bello', email: 't@x.test', role: 'teacher', isActive: true, isVerified: false, invitedBy: null, isTemporaryPassword: true, deactivatedAt: null, subjects: [] }
      ]);
      prisma.user.count.mockResolvedValue(1);
    });

    it('should show an imported teacher as not invited and never return secrets', async () => {
      const result = await lifecycle.listStaff('ABC1234', {});

      expect(result.staff[0]).toEqual(expect.objectContaining({ id: 'u1', status: 'not_invited' }));
      expect(result.staff[0]).not.toHaveProperty('password');
      expect(result.staff[0]).not.toHaveProperty('invitedBy');
    });

    it('should scope to this school, hide removed accounts and apply the status filter', async () => {
      await lifecycle.listStaff('ABC1234', { status: 'not_invited', search: 'tun' });

      const { where } = prisma.user.findMany.mock.calls[0][0];
      expect(where.AND[0]).toEqual(expect.objectContaining({
        schoolId: 'school-uuid',
        NOT: { email: { endsWith: '@removed.invalid' } }
      }));
      expect(where.AND[2]).toEqual({ isVerified: false, invitedBy: null, isActive: true, deactivatedAt: null });
    });
  });

  describe('listStudents', () => {
    it('should flag students that have a login and clamp the page size', async () => {
      prisma.school.findFirst.mockResolvedValue(school());
      prisma.student.findMany.mockResolvedValue([
        { id: 's1', firstName: 'A', lastName: 'B', userId: 'u1', classRef: { id: 'c1', name: 'JSS1' }, arm: null }
      ]);
      prisma.student.count.mockResolvedValue(1);

      const result = await lifecycle.listStudents('ABC1234', { limit: '5000', status: 'active' });

      expect(prisma.student.findMany.mock.calls[0][0].take).toBe(100);
      expect(prisma.student.findMany.mock.calls[0][0].where).toEqual(expect.objectContaining({ schoolId: 'school-uuid', isActive: true }));
      expect(result.students[0]).toEqual(expect.objectContaining({ hasLogin: true, className: 'JSS1', armName: null }));
      expect(result.students[0]).not.toHaveProperty('userId');
    });
  });
});
