/**
 * System Admin Authentication Middleware
 * Handles authentication for system administrators using pre-configured credentials
 */

const { verifySystemAdminToken } = require('../services/systemAdminAuthService');
const { ROLES } = require('./rbac');

/**
 * Authenticate system admin using JWT token
 * Middleware to verify system admin authentication
 */
const authenticateSystemAdmin = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'System admin authentication required',
        code: 'MISSING_AUTH_TOKEN'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifySystemAdminToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired system admin token',
        code: 'INVALID_AUTH_TOKEN'
      });
    }

    // Ensure this is a system admin token
    if (decoded.role !== ROLES.SYSTEM_ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'System administrator access required',
        code: 'INSUFFICIENT_PRIVILEGES'
      });
    }

    // Add user info to request
    req.user = {
      id: `system_admin_${decoded.email}`, // Unique ID for system admin
      email: decoded.email,
      role: decoded.role,
      crossSchoolAccess: decoded.crossSchoolAccess,
      systemAdminLevel: decoded.systemAdminLevel,
      schoolId: null // System admins are not tied to any school
    };

    // Add system admin specific info
    req.systemAdmin = {
      email: decoded.email,
      level: decoded.systemAdminLevel,
      loginTime: new Date(decoded.iat * 1000),
      expiresAt: new Date(decoded.exp * 1000)
    };

    next();

  } catch (error) {
    console.error('System admin authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Require system admin authentication
 * Combines authentication and authorization in one middleware
 */
const requireSystemAdminAuth = (req, res, next) => {
  authenticateSystemAdmin(req, res, (err) => {
    if (err) {
      return next(err);
    }

    // Double-check system admin role
    if (!req.user || req.user.role !== ROLES.SYSTEM_ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'System administrator access required',
        code: 'SYSTEM_ADMIN_REQUIRED'
      });
    }

    next();
  });
};

/**
 * Optional system admin authentication
 * Authenticates if token is present, but doesn't require it
 */
const optionalSystemAdminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(); // No token provided, continue without authentication
  }

  // Token provided, try to authenticate
  authenticateSystemAdmin(req, res, next);
};

/**
 * Validate system admin session
 * Check if the current session is still valid
 */
const validateSystemAdminSession = (req, res, next) => {
  if (!req.user || req.user.role !== ROLES.SYSTEM_ADMIN) {
    return res.status(401).json({
      success: false,
      message: 'System admin session required',
      code: 'NO_SYSTEM_ADMIN_SESSION'
    });
  }

  // Check if session is about to expire (within 5 minutes)
  const expiresAt = req.systemAdmin?.expiresAt;
  if (expiresAt) {
    const timeUntilExpiry = expiresAt.getTime() - Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (timeUntilExpiry < fiveMinutes) {
      // Add warning header for client to refresh token
      res.set('X-Token-Expiry-Warning', 'Token expires soon');
    }
  }

  next();
};

/**
 * Require system admin role (alias for requireSystemAdminAuth)
 * This is the main middleware function mentioned in the task
 */
const requireSystemAdmin = requireSystemAdminAuth;

/**
 * Validate cross-school access permissions
 * Ensures system admin has proper permissions for cross-school operations
 */
const validateCrossSchoolAccess = (req, res, next) => {
  if (!req.user || req.user.role !== ROLES.SYSTEM_ADMIN) {
    return res.status(403).json({
      success: false,
      message: 'System administrator access required for cross-school operations',
      code: 'CROSS_SCHOOL_ACCESS_DENIED'
    });
  }

  // Verify cross-school access flag
  if (!req.user.crossSchoolAccess) {
    return res.status(403).json({
      success: false,
      message: 'Cross-school access not authorized',
      code: 'CROSS_SCHOOL_ACCESS_NOT_AUTHORIZED'
    });
  }

  // Add cross-school context to request
  req.crossSchoolContext = {
    authorized: true,
    systemAdminEmail: req.user.email,
    accessLevel: req.user.systemAdminLevel,
    timestamp: new Date()
  };

  next();
};

/**
 * Audit system operation middleware
 * Logs all system admin operations for audit trail
 */
const auditSystemOperation = (operationType = 'unknown') => {
  return async (req, res, next) => {
    try {
      // Skip if not a system admin
      if (!req.user || req.user.role !== ROLES.SYSTEM_ADMIN) {
        return next();
      }

      // Prepare audit log data
      const auditData = {
        operationType,
        systemAdminEmail: req.user.email,
        method: req.method,
        path: req.path,
        query: req.query,
        body: req.method !== 'GET' ? req.body : undefined,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip || req.connection.remoteAddress,
        timestamp: new Date(),
        sessionId: req.sessionID || `system_admin_${Date.now()}`
      };

      // Add audit data to request for later use
      req.auditData = auditData;

      // Log the operation (in a real implementation, this would go to PlatformAuditLog)
      console.log('🔍 System Admin Operation:', JSON.stringify(auditData, null, 2));

      // Continue to next middleware
      next();

    } catch (error) {
      console.error('Audit logging error:', error);
      // Don't fail the request due to audit logging issues
      next();
    }
  };
};

/**
 * Complete audit log after operation
 * Call this after the operation completes to log the result
 */
const completeAuditLog = (req, res, next) => {
  try {
    if (req.auditData && req.user && req.user.role === ROLES.SYSTEM_ADMIN) {
      const completedAudit = {
        ...req.auditData,
        statusCode: res.statusCode,
        completedAt: new Date(),
        duration: Date.now() - req.auditData.timestamp.getTime(),
        success: res.statusCode < 400
      };

      console.log('✅ System Admin Operation Completed:', JSON.stringify(completedAudit, null, 2));
    }
  } catch (error) {
    console.error('Complete audit log error:', error);
  }
  
  next();
};

module.exports = {
  authenticateSystemAdmin,
  requireSystemAdminAuth,
  requireSystemAdmin,
  optionalSystemAdminAuth,
  validateSystemAdminSession,
  validateCrossSchoolAccess,
  auditSystemOperation,
  completeAuditLog
};