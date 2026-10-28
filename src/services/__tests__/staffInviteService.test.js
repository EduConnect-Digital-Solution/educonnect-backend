/**
 * Bulk invitation of imported teachers by a system admin.
 */

jest.mock('../../config/database', () => ({
  prisma: {
    school: { findFirst: jest.fn() },
    user: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() }
  },
  connectDB: jest.fn()
}));

jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../cacheService', () => ({ invalidatePlatformCachesForSchool: jest.fn() }));
jest.mock('../platformAuditService', () => ({ record: jest.fn().mockResolvedValue(undefined), recordInTransaction: jest.fn() }));
jest.mock('../invitationService', () => ({ createTeacherInvitation: jest.fn() }));

const { prisma } = require('../../config/database');
const invitationService = require('../invitationService');
const audit = require('../platformAuditService');
const invite = require('../staffInviteService');

const school = (overrides = {}) => ({ id: 'school-uuid', schoolId: 'ABC1234', isActive: true, archivedAt: null, adminUserId: 'admin-1', ...overrides });
const teacher = (n) => ({ id: `t${n}`, firstName: `T${n}`, lastName: 'Teacher', email: `t${n}@example.com`, subjects: ['Maths'] });

describe('staffInviteService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.school.findFirst.mockReset().mockResolvedValue(school());
    prisma.user.findFirst.mockReset().mockResolvedValue({ id: 'admin-1' });
    prisma.user.findMany.mockReset().mockResolvedValue([teacher(1), teacher(2)]);
    prisma.user.count.mockReset().mockResolvedValue(0);
    invitationService.createTeacherInvitation.mockReset().mockResolvedValue({ emailSent: true, temporaryPassword: 'must-not-leak' });
  });

  it('should invite each imported teacher in the name of the school admin', async () => {
    const result = await invite.inviteImportedStaff('ABC1234', {}, 'root');

    expect(invitationService.createTeacherInvitation).toHaveBeenCalledTimes(2);
    expect(invitationService.createTeacherInvitation).toHaveBeenNthCalledWith(
      1,
      { email: 't1@example.com', firstName: 'T1', lastName: 'Teacher', subjects: ['Maths'] },
      'school-uuid',
      'admin-1'
    );
    expect(result).toEqual(expect.objectContaining({ attempted: 2, invited: 2, failed: 0, remainingNotInvited: 0 }));
  });

  it('should never return the temporary passwords', async () => {
    const result = await invite.inviteImportedStaff('ABC1234', {}, 'root');

    expect(JSON.stringify(result)).not.toContain('must-not-leak');
    expect(result.results[0]).toEqual({ userId: 't1', email: 't1@example.com', status: 'invited', emailSent: true });
  });

  it('should only pick imported records: unverified, uninvited, active teachers of this school', async () => {
    await invite.inviteImportedStaff('ABC1234', {}, 'root');

    expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({
      schoolId: 'school-uuid', role: 'teacher', isVerified: false, invitedBy: null, isActive: true, deactivatedAt: null
    });
  });

  it('should narrow to the listed users but never beyond the imported records', async () => {
    await invite.inviteImportedStaff('ABC1234', { userIds: ['t1'] }, 'root');

    const { where } = prisma.user.findMany.mock.calls[0][0];
    expect(where.id).toEqual({ in: ['t1'] });
    expect(where.isVerified).toBe(false);
    expect(where.schoolId).toBe('school-uuid');
  });

  it('should cap how many go out in one call', async () => {
    await invite.inviteImportedStaff('ABC1234', {}, 'root');

    expect(prisma.user.findMany.mock.calls[0][0].take).toBe(invite.MAX_INVITES_PER_CALL);
  });

  it('should carry on after one invitation fails and report it', async () => {
    invitationService.createTeacherInvitation
      .mockRejectedValueOnce(new Error('Email provider rejected the address'))
      .mockResolvedValueOnce({ emailSent: true });
    prisma.user.count.mockResolvedValue(1);

    const result = await invite.inviteImportedStaff('ABC1234', {}, 'root');

    expect(result).toEqual(expect.objectContaining({ attempted: 2, invited: 1, failed: 1, remainingNotInvited: 1 }));
    expect(result.results[0]).toEqual({ userId: 't1', email: 't1@example.com', status: 'failed', error: 'Email provider rejected the address' });
    expect(result.results[1].status).toBe('invited');
  });

  it('should audit the batch with counts only', async () => {
    await invite.inviteImportedStaff('ABC1234', {}, 'root', { ip: '1.1.1.1' });

    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'staff.invite',
      schoolId: 'school-uuid',
      actor: 'root',
      details: expect.objectContaining({ attempted: 2, invited: 2, failed: 0 })
    }));
    expect(JSON.stringify(audit.record.mock.calls[0][0])).not.toMatch(/example\.com/);
  });

  it('should do nothing, successfully, when nobody is waiting for an invitation', async () => {
    prisma.user.findMany.mockResolvedValue([]);

    const result = await invite.inviteImportedStaff('ABC1234', {}, 'root');

    expect(result).toEqual(expect.objectContaining({ attempted: 0, invited: 0, failed: 0 }));
    expect(invitationService.createTeacherInvitation).not.toHaveBeenCalled();
  });

  it('should refuse an inactive or archived school', async () => {
    prisma.school.findFirst.mockResolvedValue(school({ isActive: false }));
    await expect(invite.inviteImportedStaff('ABC1234', {}, 'root')).rejects.toMatchObject({ statusCode: 409, code: 'SCHOOL_NOT_ACTIVE' });

    prisma.school.findFirst.mockResolvedValue(school({ archivedAt: new Date() }));
    await expect(invite.inviteImportedStaff('ABC1234', {}, 'root')).rejects.toMatchObject({ statusCode: 409, code: 'SCHOOL_NOT_ACTIVE' });
  });

  it('should refuse a school with no active admin to issue invitations', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(invite.inviteImportedStaff('ABC1234', {}, 'root')).rejects.toMatchObject({ statusCode: 409, code: 'NO_SCHOOL_ADMIN' });
    expect(invitationService.createTeacherInvitation).not.toHaveBeenCalled();
  });
});
