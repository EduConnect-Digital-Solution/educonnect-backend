const { authenticateToken } = require('./auth');

const authenticate = authenticateToken;

const authorize = (...allowedPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (req.user.role === 'system_admin') return next();
    if (!allowedPermissions || allowedPermissions.length === 0) return next();
    next();
  };
};

module.exports = { authenticate, authorize };
