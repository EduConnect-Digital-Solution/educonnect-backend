/**
 * Login lockout: a deactivated school or user must not be able to sign in.
 */

jest.mock('../../config/database', () => ({
  prisma: {
    school: { findFirst: jest.fn() },
    user: { findFirst: jest.fn() }
  },
  connectDB: jest.fn()
}));

jest.mock('../../config/email', () => ({}));
jest.mock('../cacheService', () => ({}));
jest.mock('../sessionService', () => ({}));
jest.mock('../systemAdminAuthService', () => ({
  validateSystemAdminCredentials: jest.fn(),
  generateSystemAdminToken: jest.fn(),
  verifySystemAdminToken: jest.fn()
}));
jest.mock('../../middleware/auth', () => ({
  generateTokenPair: jest.fn(),
  verifyRefreshToken: jest.fn()
}));
jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));

const bcrypt = require('bcrypt');
const { prisma } = require('../../config/database');
const { loginUser } = require('../authService');

const school = (overrides = {}) => ({
  id: 'school-uuid', schoolId: 'ABC1234', isVerified: true, isActive: true, archivedAt: null, ...overrides
});
const user = (overrides = {}) => ({
  id: 'user-1', schoolId: 'school-uuid', email: 'teacher@school.test', password: 'hash',
  firstName: 'Ada', lastName: 'Obi', role: 'teacher',
  isVerified: true, isActive: true, isTemporaryPassword: false, deactivatedAt: null, ...overrides
});

describe('loginUser lockout', () => {
  beforeEach(() => {
    prisma.school.findFirst.mockReset();
    prisma.user.findFirst.mockReset();
    bcrypt.compare.mockReset().mockResolvedValue(false);
  });

  it('should refuse sign-in to a deactivated school', async () => {
    prisma.school.findFirst.mockResolvedValue(school({ isActive: false }));

    await expect(loginUser('teacher@school.test', 'pw', 'ABC1234')).rejects.toThrow('School account has been deactivated');
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('should refuse sign-in to an archived school', async () => {
    prisma.school.findFirst.mockResolvedValue(school({ archivedAt: new Date() }));

    await expect(loginUser('teacher@school.test', 'pw', 'ABC1234')).rejects.toThrow('School account has been deactivated');
  });

  it('should refuse a user a system admin deactivated, even with a temporary password', async () => {
    prisma.school.findFirst.mockResolvedValue(school());
    prisma.user.findFirst.mockResolvedValue(user({ isActive: false, isTemporaryPassword: true, deactivatedAt: new Date() }));

    await expect(loginUser('teacher@school.test', 'pw', 'ABC1234')).rejects.toThrow('User account is deactivated');
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('should refuse an inactive user who is not on a temporary password', async () => {
    prisma.school.findFirst.mockResolvedValue(school());
    prisma.user.findFirst.mockResolvedValue(user({ isActive: false }));

    await expect(loginUser('teacher@school.test', 'pw', 'ABC1234')).rejects.toThrow('User account is deactivated');
  });

  it('should still reach the password check for a normal user (the lockout is not over-eager)', async () => {
    prisma.school.findFirst.mockResolvedValue(school());
    prisma.user.findFirst.mockResolvedValue(user());

    await expect(loginUser('teacher@school.test', 'wrong', 'ABC1234')).rejects.toThrow('Invalid credentials');
    expect(bcrypt.compare).toHaveBeenCalled();
  });

  it('should still let an invited, not yet active user reach the password check', async () => {
    prisma.school.findFirst.mockResolvedValue(school());
    prisma.user.findFirst.mockResolvedValue(user({ isActive: false, isTemporaryPassword: true }));

    await expect(loginUser('teacher@school.test', 'wrong', 'ABC1234')).rejects.toThrow('Invalid credentials');
    expect(bcrypt.compare).toHaveBeenCalled();
  });

  it('should never sign in an imported teacher record that has not been invited', async () => {
    prisma.school.findFirst.mockResolvedValue(school());
    prisma.user.findFirst.mockResolvedValue(user({ isVerified: false, isTemporaryPassword: true }));

    await expect(loginUser('teacher@school.test', 'pw', 'ABC1234')).rejects.toThrow('not verified');
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });
});
