/**
 * Inviting a teacher whose record was imported from a CSV claims that record.
 */

jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('temp-password-hash') }));

jest.mock('../../config/database', () => ({
  prisma: {
    school: { findFirst: jest.fn() },
    user: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    invitation: { findFirst: jest.fn(), create: jest.fn() }
  },
  connectDB: jest.fn()
}));

jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../config/email', () => ({ sendTemplatedEmail: jest.fn().mockResolvedValue({ success: true }) }));
jest.mock('../cacheService', () => ({ delPattern: jest.fn().mockResolvedValue(0) }));
jest.mock('../dashboardService', () => ({ invalidateDashboardCache: jest.fn().mockResolvedValue(undefined) }));

const { prisma } = require('../../config/database');
const EmailService = require('../../config/email');
const invitationService = require('../invitationService');

const SCHOOL = { id: 'school-uuid', schoolId: 'ABC1234', schoolName: 'Greenfield' };
const ADMIN = { id: 'admin-1', role: 'admin' };

const imported = (overrides = {}) => ({
  id: 'teacher-1', email: 'tunde@example.com', role: 'teacher',
  isVerified: false, invitedBy: null, isTemporaryPassword: true, subjects: ['Physics'], ...overrides
});

const invite = (data = {}) =>
  invitationService.createTeacherInvitation(
    { email: 'Tunde@Example.com', firstName: 'Tunde', lastName: 'Bello', ...data },
    'school-uuid',
    'admin-1'
  );

describe('createTeacherInvitation with an imported record', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.school.findFirst.mockReset().mockResolvedValue(SCHOOL);
    prisma.user.findFirst.mockReset();
    prisma.user.create.mockReset().mockImplementation(async ({ data }) => ({ id: 'new-teacher', ...data }));
    prisma.user.update.mockReset().mockImplementation(async ({ data }) => ({ ...imported(), ...data }));
    prisma.invitation.findFirst.mockReset().mockResolvedValue(null);
    prisma.invitation.create.mockReset().mockImplementation(async ({ data }) => ({ id: 'inv-1', ...data }));
  });

  const existingUserIs = (user) => prisma.user.findFirst.mockResolvedValueOnce(ADMIN).mockResolvedValueOnce(user);

  it('should recognise an imported teacher record', () => {
    expect(invitationService.isImportedTeacherRecord(imported())).toBe(true);
    expect(invitationService.isImportedTeacherRecord(imported({ isVerified: true }))).toBe(false);
    expect(invitationService.isImportedTeacherRecord(imported({ invitedBy: 'admin-1' }))).toBe(false);
    expect(invitationService.isImportedTeacherRecord(imported({ role: 'parent' }))).toBe(false);
  });

  it('should claim the imported record instead of creating a second user', async () => {
    existingUserIs(imported());

    const result = await invite();

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'teacher-1' },
      data: { password: 'temp-password-hash', isVerified: true, isTemporaryPassword: true, invitedBy: 'admin-1' }
    });
    expect(result.user.id).toBe('teacher-1');
    expect(result.temporaryPassword).toEqual(expect.any(String));
  });

  it('should keep the imported subjects unless the invitation names some', async () => {
    existingUserIs(imported());
    await invite();
    expect(prisma.user.update.mock.calls[0][0].data).not.toHaveProperty('subjects');

    existingUserIs(imported());
    await invite({ subjects: ['Chemistry'] });
    expect(prisma.user.update.mock.calls[1][0].data.subjects).toEqual(['Chemistry']);
  });

  it('should email the teacher their sign-in details', async () => {
    existingUserIs(imported());

    await invite();

    expect(EmailService.sendTemplatedEmail).toHaveBeenCalledWith(
      'teacher-invitation',
      'tunde@example.com',
      expect.any(String),
      expect.objectContaining({ email: 'tunde@example.com', tempPassword: expect.any(String), schoolId: 'ABC1234' })
    );
  });

  it('should still refuse a real duplicate: an already invited teacher', async () => {
    existingUserIs(imported({ isVerified: true, invitedBy: 'admin-1' }));

    await expect(invite()).rejects.toThrow('A user with this email already exists in this school');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('should still refuse a duplicate who is not a teacher', async () => {
    existingUserIs(imported({ role: 'parent' }));

    await expect(invite()).rejects.toThrow('A user with this email already exists in this school');
  });

  it('should keep creating a new user when nobody has that email', async () => {
    existingUserIs(null);

    await invite({ subjects: ['Maths'] });

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ role: 'teacher', isVerified: true, isTemporaryPassword: true, invitedBy: 'admin-1', subjects: ['Maths'] })
    });
  });
});
