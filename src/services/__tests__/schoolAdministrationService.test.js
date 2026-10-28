/**
 * Switching schools and accounts on and off. (Creating a school is covered in
 * systemAdminService.test.js.)
 */

jest.mock('../../config/database', () => {
  const prisma = {
    school: { findFirst: jest.fn(), update: jest.fn() },
    user: { count: jest.fn(), findUnique: jest.fn(), update: jest.fn() }
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
const administration = require('../schoolAdministrationService');

const school = (overrides = {}) => ({
  id: 'school-uuid',
  schoolId: 'ABC1234',
  schoolName: 'Greenfield Academy',
  isActive: true,
  archivedAt: null,
  systemMetadata: { systemNotes: [], flags: [{ flagType: 'attention', description: 'Late payment', isActive: true }] },
  ...overrides
});

describe('schoolAdministrationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.school.findFirst.mockReset();
    prisma.school.update.mockReset().mockResolvedValue({});
    prisma.user.count.mockReset().mockResolvedValue(42);
    prisma.user.findUnique.mockReset();
    prisma.user.update.mockReset();
    audit.recordInTransaction.mockReset().mockResolvedValue({});
    jest.spyOn(AccessGuard, 'invalidateAll');
    jest.spyOn(AccessGuard, 'invalidateUser');
  });

  describe('deactivateSchool', () => {
    it('should switch the school off in a single update that also records why', async () => {
      prisma.school.findFirst.mockResolvedValue(school());

      const result = await administration.deactivateSchool('ABC1234', 'Subscription unpaid for 60 days', 'root', { ip: '1.1.1.1' });

      expect(prisma.school.update).toHaveBeenCalledTimes(1);
      const { data } = prisma.school.update.mock.calls[0][0];
      expect(data.isActive).toBe(false);
      expect(data.systemMetadata.systemNotes[0].note).toBe('School deactivated: Subscription unpaid for 60 days');
      expect(data.systemMetadata.flags).toEqual([
        { flagType: 'attention', description: 'Late payment', isActive: true },
        expect.objectContaining({ flagType: 'deactivated', description: 'School deactivated: Subscription unpaid for 60 days', isActive: true })
      ]);
      expect(audit.recordInTransaction).toHaveBeenCalledWith(prisma, expect.objectContaining({
        action: 'school.deactivate',
        details: expect.objectContaining({ affectedUsers: 42, reason: 'Subscription unpaid for 60 days' })
      }));
      expect(result.affectedUsers).toBe(42);
      expect(result.school.isActive).toBe(false);
    });

    it('should lock out people who are already logged in', async () => {
      prisma.school.findFirst.mockResolvedValue(school());

      await administration.deactivateSchool('ABC1234', 'Subscription unpaid for 60 days', 'root');

      expect(AccessGuard.invalidateAll).toHaveBeenCalled();
    });

    it('should not change the school when the audit row cannot be written', async () => {
      prisma.school.findFirst.mockResolvedValue(school());
      audit.recordInTransaction.mockRejectedValue(new Error('audit unavailable'));

      await expect(administration.deactivateSchool('ABC1234', 'Subscription unpaid for 60 days', 'root')).rejects.toThrow('audit unavailable');
      expect(AccessGuard.invalidateAll).not.toHaveBeenCalled();
    });

    it('should refuse a school that is already inactive', async () => {
      prisma.school.findFirst.mockResolvedValue(school({ isActive: false }));

      await expect(administration.deactivateSchool('ABC1234', 'Subscription unpaid for 60 days', 'root'))
        .rejects.toMatchObject({ statusCode: 409, code: 'SCHOOL_ALREADY_INACTIVE' });
    });

    it('should send an archived school to restore instead', async () => {
      prisma.school.findFirst.mockResolvedValue(school({ isActive: false, archivedAt: new Date() }));

      await expect(administration.deactivateSchool('ABC1234', 'Subscription unpaid for 60 days', 'root'))
        .rejects.toMatchObject({ statusCode: 409, code: 'SCHOOL_ARCHIVED' });
    });

    it('should answer 404 for an unknown school', async () => {
      prisma.school.findFirst.mockResolvedValue(null);

      await expect(administration.deactivateSchool('ZZZ9999', 'Subscription unpaid for 60 days', 'root'))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('reactivateSchool', () => {
    const deactivated = (extraFlags = []) => school({
      isActive: false,
      systemMetadata: {
        systemNotes: [],
        flags: [
          { flagType: 'attention', description: 'Late payment', isActive: true },
          { flagType: 'deactivated', description: 'School deactivated: unpaid', isActive: true },
          ...extraFlags
        ]
      }
    });

    it('should switch the school on and remove only the deactivation flag', async () => {
      prisma.school.findFirst.mockResolvedValue(deactivated());

      await administration.reactivateSchool('ABC1234', { reason: 'Paid in full', reactivatedBy: 'root' });

      const { data } = prisma.school.update.mock.calls[0][0];
      expect(data.isActive).toBe(true);
      expect(data.systemMetadata.flags).toEqual([{ flagType: 'attention', description: 'Late payment', isActive: true }]);
      expect(data.systemMetadata.systemNotes[0].note).toBe('School reactivated: Paid in full');
      expect(audit.recordInTransaction).toHaveBeenCalledWith(prisma, expect.objectContaining({ action: 'school.reactivate', actor: 'root' }));
      expect(AccessGuard.invalidateAll).toHaveBeenCalled();
    });

    it('should also clear flags written by the old code, which used the type "attention"', async () => {
      prisma.school.findFirst.mockResolvedValue(deactivated([
        { flagType: 'attention', description: 'School deactivated: legacy entry', isActive: true }
      ]));

      await administration.reactivateSchool('ABC1234', { reason: 'Paid in full', reactivatedBy: 'root' });

      const { flags } = prisma.school.update.mock.calls[0][0].data.systemMetadata;
      expect(flags.map((flag) => flag.description)).toEqual(['Late payment']);
    });

    it('should refuse a school that is already active', async () => {
      prisma.school.findFirst.mockResolvedValue(school());

      await expect(administration.reactivateSchool('ABC1234', { reason: 'x', reactivatedBy: 'root' }))
        .rejects.toMatchObject({ statusCode: 409, code: 'SCHOOL_ALREADY_ACTIVE' });
    });

    it('should refuse an archived school and point to restore', async () => {
      prisma.school.findFirst.mockResolvedValue(school({ isActive: false, archivedAt: new Date() }));

      await expect(administration.reactivateSchool('ABC1234', { reason: 'x', reactivatedBy: 'root' }))
        .rejects.toMatchObject({ statusCode: 409, code: 'SCHOOL_ARCHIVED' });
    });
  });

  describe('manageUserAccess', () => {
    const user = (overrides = {}) => ({
      id: 'user-1', email: 'ada@school.test', role: 'teacher', isActive: true, deactivatedAt: null,
      schoolId: 'school-uuid', subjects: ['Maths'], classes: [], ...overrides
    });

    beforeEach(() => {
      prisma.user.update.mockImplementation(async ({ data }) => ({ ...user(), ...data, updatedAt: new Date() }));
    });

    it('should end the user\'s sessions and refresh the guard when deactivating', async () => {
      prisma.user.findUnique.mockResolvedValue(user());

      await administration.manageUserAccess('user-1', { action: 'deactivate', reason: 'Left the school' }, 'root');

      expect(SessionService.revokeAllSessions).toHaveBeenCalledWith('user-1');
      expect(AccessGuard.invalidateUser).toHaveBeenCalledWith('user-1');
    });

    it('should stamp a deactivation even on a legacy inactive user that had no stamp', async () => {
      prisma.user.findUnique.mockResolvedValue(user({ isActive: false, deactivatedAt: null }));

      await administration.manageUserAccess('user-1', { action: 'deactivate', reason: 'Left the school' }, 'root');

      expect(prisma.user.update.mock.calls[0][0].data.deactivatedAt).toBeInstanceOf(Date);
    });

    it('should refuse to deactivate someone already deactivated', async () => {
      prisma.user.findUnique.mockResolvedValue(user({ isActive: false, deactivatedAt: new Date() }));

      await expect(administration.manageUserAccess('user-1', { action: 'deactivate', reason: 'Left the school' }, 'root'))
        .rejects.toMatchObject({ statusCode: 409, code: 'USER_ALREADY_INACTIVE' });
    });

    it('should refuse to activate someone who is already active', async () => {
      prisma.user.findUnique.mockResolvedValue(user());

      await expect(administration.manageUserAccess('user-1', { action: 'activate', reason: 'Back again' }, 'root'))
        .rejects.toMatchObject({ statusCode: 409, code: 'USER_ALREADY_ACTIVE' });
    });

    it('should never turn a parent into an admin', async () => {
      prisma.user.findUnique.mockResolvedValue(user({ role: 'parent', subjects: [] }));

      await expect(administration.manageUserAccess('user-1', { action: 'change_role', newRole: 'admin', reason: 'Promoted' }, 'root'))
        .rejects.toMatchObject({ statusCode: 400, code: 'ROLE_TRANSITION_NOT_ALLOWED' });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should clear subjects and classes when a teacher becomes an admin', async () => {
      prisma.user.findUnique.mockResolvedValue(user({ classes: ['c1'] }));

      await administration.manageUserAccess('user-1', { action: 'change_role', newRole: 'admin', reason: 'Promoted' }, 'root');

      expect(prisma.user.update.mock.calls[0][0].data).toEqual({ role: 'admin', subjects: [], classes: [] });
    });

    it('should accept the target school under either name the callers use', async () => {
      prisma.user.findUnique.mockResolvedValue(user());
      prisma.school.findFirst.mockResolvedValue({ id: 'other-uuid', schoolId: 'XYZ9999' });

      await administration.manageUserAccess('user-1', { action: 'transfer_school', schoolTransfer: { targetSchoolId: 'XYZ9999' }, reason: 'Moved' }, 'root');
      await administration.manageUserAccess('user-1', { action: 'transfer_school', schoolTransfer: { schoolId: 'XYZ9999' }, reason: 'Moved' }, 'root');

      expect(prisma.user.update.mock.calls.map((call) => call[0].data)).toEqual([{ schoolId: 'other-uuid' }, { schoolId: 'other-uuid' }]);
    });

    it('should answer 404 for a transfer to an unknown school', async () => {
      prisma.user.findUnique.mockResolvedValue(user());
      prisma.school.findFirst.mockResolvedValue(null);

      await expect(administration.manageUserAccess('user-1', { action: 'transfer_school', schoolTransfer: { targetSchoolId: 'XYZ9999' }, reason: 'Moved' }, 'root'))
        .rejects.toMatchObject({ statusCode: 404 });
    });

    it('should refuse an unknown action and an unknown user', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(user());
      await expect(administration.manageUserAccess('user-1', { action: 'explode', reason: 'x' }, 'root'))
        .rejects.toMatchObject({ statusCode: 400, code: 'INVALID_ACTION' });

      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(administration.manageUserAccess('nobody', { action: 'activate', reason: 'x' }, 'root'))
        .rejects.toMatchObject({ statusCode: 404, code: 'USER_NOT_FOUND' });
    });

    it('should write the audit row with the real columns', async () => {
      prisma.user.findUnique.mockResolvedValue(user());

      await administration.manageUserAccess('user-1', { action: 'deactivate', reason: 'Left the school' }, 'root', { ip: '1.1.1.1' });

      expect(audit.recordInTransaction).toHaveBeenCalledWith(prisma, expect.objectContaining({
        action: 'user.deactivate',
        entityType: 'user',
        entityId: 'user-1',
        schoolId: 'school-uuid',
        actor: 'root',
        context: { ip: '1.1.1.1' }
      }));
    });
  });
});
