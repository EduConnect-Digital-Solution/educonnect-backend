/**
 * authenticateToken must refuse a perfectly valid token once the account or
 * its school has been deactivated, instead of waiting for the token to expire.
 */

jest.mock('../../services/accessGuard', () => ({
  check: jest.fn(),
  isUserBlocked: jest.fn(),
  isSchoolBlocked: jest.fn()
}));

jest.mock('../../services/cacheService', () => ({
  isTokenBlacklisted: jest.fn().mockResolvedValue(false)
}));

jest.mock('../../services/systemAdminAuthService', () => ({
  verifySystemAdminToken: jest.fn()
}));

const jwt = require('jsonwebtoken');
const config = require('../../config');
const AccessGuard = require('../../services/accessGuard');
const { verifySystemAdminToken } = require('../../services/systemAdminAuthService');
const { authenticateToken } = require('../auth');

const tokenFor = (claims = {}) =>
  jwt.sign({ userId: 'user-1', email: 'teacher@school.test', role: 'teacher', schoolId: 'school-1', ...claims }, config.jwt.secret);

const run = async (token) => {
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
  const next = jest.fn();
  await authenticateToken(req, res, next);
  return { req, res, next };
};

describe('authenticateToken access guard', () => {
  beforeEach(() => {
    verifySystemAdminToken.mockImplementation(() => { throw new Error('not a system admin token'); });
  });

  it('should let an allowed user through and attach them to the request', async () => {
    AccessGuard.check.mockResolvedValue({ allowed: true });

    const { req, next } = await run(tokenFor());

    expect(next).toHaveBeenCalled();
    expect(AccessGuard.check).toHaveBeenCalledWith('user-1');
    expect(req.user).toEqual(expect.objectContaining({ userId: 'user-1', schoolId: 'school-1' }));
  });

  it('should refuse a valid token whose account was deactivated', async () => {
    AccessGuard.check.mockResolvedValue({
      allowed: false, status: 403, code: 'ACCOUNT_DEACTIVATED', message: 'Your account has been deactivated.'
    });

    const { res, next } = await run(tokenFor());

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ success: false, message: 'Your account has been deactivated.', code: 'ACCOUNT_DEACTIVATED' });
  });

  it('should refuse a valid token whose school was deactivated', async () => {
    AccessGuard.check.mockResolvedValue({
      allowed: false, status: 403, code: 'SCHOOL_DEACTIVATED', message: 'This school account has been deactivated.'
    });

    const { res, next } = await run(tokenFor({ role: 'parent' }));

    expect(next).not.toHaveBeenCalled();
    expect(res.body.code).toBe('SCHOOL_DEACTIVATED');
  });

  it('should answer 401 when the account no longer exists', async () => {
    AccessGuard.check.mockResolvedValue({ allowed: false, status: 401, code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' });

    const { res } = await run(tokenFor());

    expect(res.statusCode).toBe(401);
  });

  it('should fail closed with 503 when the status cannot be checked', async () => {
    AccessGuard.check.mockRejectedValue(new Error('database is down'));

    const { res, next } = await run(tokenFor());

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe('ACCESS_CHECK_FAILED');
  });

  it('should not run the school account check for a system admin', async () => {
    verifySystemAdminToken.mockReturnValue({
      role: 'system_admin', email: 'root@educonnect.test', crossSchoolAccess: true, systemAdminLevel: 'super', iat: 1, exp: 2
    });

    const { next } = await run('any-token');

    expect(next).toHaveBeenCalled();
    expect(AccessGuard.check).not.toHaveBeenCalled();
  });
});
