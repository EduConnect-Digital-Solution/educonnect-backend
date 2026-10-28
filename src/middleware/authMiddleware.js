const { authenticateToken } = require('./auth');
const { ROLES } = require('./rbac');

const authenticate = authenticateToken;

/**
 * Roles that hold each permission. The fee endpoints are scoped to a school
 * but not to a student, so they are back-office operations for school admins.
 * `fees.pay` covers the /api/fees/my routes, which only ever touch the
 * caller's own (or their children's) invoices.
 * A permission that is not listed here is granted to nobody (fail closed).
 */
const PERMISSION_ROLES = {
  'fees.read': [ROLES.ADMIN],
  'fees.create': [ROLES.ADMIN],
  'fees.update': [ROLES.ADMIN],
  'fees.delete': [ROLES.ADMIN],
  'fees.admin': [ROLES.ADMIN],
  'fees.pay': [ROLES.PARENT, ROLES.STUDENT]
};

const hasPermission = (role, permission) =>
  (PERMISSION_ROLES[permission] || []).includes(role);

const authorize = (...allowedPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (req.user.role === ROLES.SYSTEM_ADMIN) return next();
    if (!allowedPermissions.every((permission) => hasPermission(req.user.role, permission))) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        required: allowedPermissions,
        current: req.user.role
      });
    }
    next();
  };
};

module.exports = { authenticate, authorize, PERMISSION_ROLES };
