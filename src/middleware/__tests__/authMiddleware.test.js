/**
 * authorize() tests.
 *
 * The fee routes are school-wide back-office endpoints, so their permissions
 * belong to school admins. Anything not explicitly granted is denied.
 */

jest.mock('../auth', () => ({
  authenticateToken: jest.fn((req, res, next) => next())
}));

const { authorize, PERMISSION_ROLES } = require('../authMiddleware');

const run = (middleware, user) => {
  const req = { user };
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
  const next = jest.fn();
  middleware(req, res, next);
  return { res, next };
};

describe('authorize', () => {
  it('should let a school admin through for every back-office fee permission', () => {
    const backOffice = Object.keys(PERMISSION_ROLES).filter((permission) => permission !== 'fees.pay');
    expect(backOffice).toEqual(['fees.read', 'fees.create', 'fees.update', 'fees.delete', 'fees.admin']);
    for (const permission of backOffice) {
      const { next } = run(authorize(permission), { role: 'admin' });
      expect(next).toHaveBeenCalled();
    }
  });

  it.each(['parent', 'student'])('should let a %s use the self-service pay routes', (role) => {
    const { next } = run(authorize('fees.pay'), { role });
    expect(next).toHaveBeenCalled();
  });

  it.each(['admin', 'teacher'])('should keep a %s off the self-service pay routes', (role) => {
    const { res, next } = run(authorize('fees.pay'), { role });
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('should let a system admin through', () => {
    const { next } = run(authorize('fees.admin'), { role: 'system_admin' });
    expect(next).toHaveBeenCalled();
  });

  it.each(['teacher', 'parent', 'student'])('should refuse fee access to a %s', (role) => {
    const { res, next } = run(authorize('fees.read'), { role });

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(expect.objectContaining({ success: false, message: 'Insufficient permissions' }));
  });

  it('should refuse a permission nobody was granted', () => {
    const { res, next } = run(authorize('fees.unknown'), { role: 'admin' });

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('should require authentication', () => {
    const { res, next } = run(authorize('fees.read'), undefined);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});
