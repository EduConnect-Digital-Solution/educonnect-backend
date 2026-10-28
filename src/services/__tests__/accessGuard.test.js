/**
 * AccessGuard tests: who is let in once they hold a valid token.
 */

jest.mock('../../config/database', () => ({
  prisma: { user: { findUnique: jest.fn() } },
  connectDB: jest.fn()
}));

const { prisma } = require('../../config/database');
const AccessGuard = require('../accessGuard');

const account = (overrides = {}) => ({
  isActive: true,
  isTemporaryPassword: false,
  deactivatedAt: null,
  school: { isActive: true, archivedAt: null },
  ...overrides
});

describe('AccessGuard', () => {
  beforeEach(() => {
    AccessGuard.invalidateAll();
    prisma.user.findUnique.mockReset();
    jest.restoreAllMocks();
  });

  describe('check', () => {
    it('should let an active user of an active school in', async () => {
      prisma.user.findUnique.mockResolvedValue(account());

      expect(await AccessGuard.check('user-1')).toEqual({ allowed: true });
    });

    it('should refuse a token whose account no longer exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      expect(await AccessGuard.check('user-1')).toEqual(expect.objectContaining({
        allowed: false, status: 401, code: 'ACCOUNT_NOT_FOUND'
      }));
    });

    it('should refuse a user a system admin deactivated, even on a temporary password', async () => {
      prisma.user.findUnique.mockResolvedValue(
        account({ isActive: false, isTemporaryPassword: true, deactivatedAt: new Date() })
      );

      expect(await AccessGuard.check('user-1')).toEqual(expect.objectContaining({
        allowed: false, status: 403, code: 'ACCOUNT_DEACTIVATED'
      }));
    });

    it('should refuse an inactive user who is not on a temporary password', async () => {
      prisma.user.findUnique.mockResolvedValue(account({ isActive: false }));

      expect((await AccessGuard.check('user-1')).code).toBe('ACCOUNT_DEACTIVATED');
    });

    it('should still let a freshly invited, not yet active user (temporary password) in', async () => {
      prisma.user.findUnique.mockResolvedValue(account({ isActive: false, isTemporaryPassword: true }));

      expect(await AccessGuard.check('user-1')).toEqual({ allowed: true });
    });

    it('should refuse everyone in a deactivated school', async () => {
      prisma.user.findUnique.mockResolvedValue(account({ school: { isActive: false, archivedAt: null } }));

      expect(await AccessGuard.check('user-1')).toEqual(expect.objectContaining({
        allowed: false, status: 403, code: 'SCHOOL_DEACTIVATED'
      }));
    });

    it('should refuse everyone in an archived school even if it is flagged active', async () => {
      prisma.user.findUnique.mockResolvedValue(account({ school: { isActive: true, archivedAt: new Date() } }));

      expect((await AccessGuard.check('user-1')).code).toBe('SCHOOL_DEACTIVATED');
    });

    it('should propagate a database failure so the caller can fail closed', async () => {
      prisma.user.findUnique.mockRejectedValue(new Error('database is down'));

      await expect(AccessGuard.check('user-1')).rejects.toThrow('database is down');
    });
  });

  describe('caching', () => {
    it('should ask the database once for repeated requests', async () => {
      prisma.user.findUnique.mockResolvedValue(account());

      await AccessGuard.check('user-1');
      await AccessGuard.check('user-1');
      await AccessGuard.check('user-1');

      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should keep separate answers per user', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(account()).mockResolvedValueOnce(account({ deactivatedAt: new Date() }));

      expect((await AccessGuard.check('user-1')).allowed).toBe(true);
      expect((await AccessGuard.check('user-2')).allowed).toBe(false);
    });

    it('should see a change straight away once the user is invalidated', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(account());
      expect((await AccessGuard.check('user-1')).allowed).toBe(true);

      prisma.user.findUnique.mockResolvedValueOnce(account({ isActive: false, deactivatedAt: new Date() }));
      AccessGuard.invalidateUser('user-1');

      expect((await AccessGuard.check('user-1')).allowed).toBe(false);
    });

    it('should see a school-wide change once everything is invalidated', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(account());
      await AccessGuard.check('user-1');

      prisma.user.findUnique.mockResolvedValueOnce(account({ school: { isActive: false, archivedAt: null } }));
      AccessGuard.invalidateAll();

      expect((await AccessGuard.check('user-1')).code).toBe('SCHOOL_DEACTIVATED');
    });

    it('should re-check after the cache lifetime has passed', async () => {
      const start = Date.now();
      const clock = jest.spyOn(Date, 'now').mockReturnValue(start);
      prisma.user.findUnique.mockResolvedValueOnce(account());
      await AccessGuard.check('user-1');

      prisma.user.findUnique.mockResolvedValueOnce(account({ deactivatedAt: new Date() }));
      clock.mockReturnValue(start + AccessGuard.CACHE_TTL_MS + 1);

      expect((await AccessGuard.check('user-1')).allowed).toBe(false);
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('helpers', () => {
    it('should treat a deactivation stamp as blocking regardless of other flags', () => {
      expect(AccessGuard.isUserBlocked({ isActive: true, isTemporaryPassword: true, deactivatedAt: new Date() })).toBe(true);
      expect(AccessGuard.isUserBlocked({ isActive: true, isTemporaryPassword: false, deactivatedAt: null })).toBe(false);
    });

    it('should treat a missing, inactive or archived school as blocked', () => {
      expect(AccessGuard.isSchoolBlocked(null)).toBe(true);
      expect(AccessGuard.isSchoolBlocked({ isActive: false, archivedAt: null })).toBe(true);
      expect(AccessGuard.isSchoolBlocked({ isActive: true, archivedAt: new Date() })).toBe(true);
      expect(AccessGuard.isSchoolBlocked({ isActive: true, archivedAt: null })).toBe(false);
    });
  });
});
