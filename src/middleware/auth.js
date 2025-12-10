const jwt = require('jsonwebtoken');
const config = require('../config');
const { verifySystemAdminToken } = require('../services/systemAdminAuthService');
const { ROLES } = require('./rbac');

/**
 * Authentication middleware to verify JWT tokens
 * Handles both regular user tokens and system admin tokens
 * Extracts user information from valid tokens and attaches to req.user
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    // Check if the authorization header has the correct format
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    let decoded;
    let isSystemAdmin = false;

    // Try to verify as system admin token first
    try {
      const systemAdminDecoded = verifySystemAdminToken(token);
      if (systemAdminDecoded && systemAdminDecoded.role === ROLES.SYSTEM_ADMIN) {
        decoded = systemAdminDecoded;
        isSystemAdmin = true;
      }
    } catch (systemAdminError) {
      // Not a system admin token, continue to regular token verification
    }

    // If not a system admin token, verify as regular user token
    if (!decoded) {
      decoded = jwt.verify(token, config.jwt.secret);
    }

    // Attach user information to request
    if (isSystemAdmin) {
      // System admin user object
      req.user = {
        id: `system_admin_${decoded.email}`,
        userId: `system_admin_${decoded.email}`, // For backward compatibility
        email: decoded.email,
        role: decoded.role,
        schoolId: null, // System admins are not tied to any school
        crossSchoolAccess: decoded.crossSchoolAccess,
        systemAdminLevel: decoded.systemAdminLevel,
        isSystemAdmin: true
      };

      // Add system admin specific info
      req.systemAdmin = {
        email: decoded.email,
        level: decoded.systemAdminLevel,
        loginTime: new Date(decoded.iat * 1000),
        expiresAt: new Date(decoded.exp * 1000)
      };
    } else {
      // Regular user object
      req.user = {
        userId: decoded.userId,
        id: decoded.userId, // For backward compatibility
        email: decoded.email,
        role: decoded.role,
        schoolId: decoded.schoolId
      };
      
      // Only add optional fields if they exist in the decoded token
      if (decoded.firstName) req.user.firstName = decoded.firstName;
      if (decoded.lastName) req.user.lastName = decoded.lastName;
      if (decoded.isSchoolAdmin !== undefined) req.user.isSchoolAdmin = decoded.isSchoolAdmin;
    }

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        success: false,
        message: 'Invalid token'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

/**
 * Optional authentication middleware
 * Attaches user info if token is present and valid, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret);
      req.user = {
        userId: decoded.userId,
        id: decoded.userId, // For backward compatibility
        email: decoded.email,
        role: decoded.role,
        schoolId: decoded.schoolId,
        firstName: decoded.firstName,
        lastName: decoded.lastName,
        isSchoolAdmin: decoded.isSchoolAdmin || false
      };
    }

    next();
  } catch (error) {
    // For optional auth, we continue even if token is invalid
    next();
  }
};

/**
 * Generate JWT access token
 */
const generateAccessToken = (payload) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  });
};

/**
 * Generate JWT refresh token
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn
  });
};

/**
 * Verify refresh token and return decoded payload
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.jwt.refreshSecret || config.jwt.secret);
};

/**
 * Generate both access and refresh tokens
 */
const generateTokenPair = (payload) => {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return {
    accessToken,
    refreshToken,
    expiresIn: config.jwt.expiresIn
  };
};

/**
 * Generate both access and refresh tokens (alias for tests)
 */
const generateTokens = (payload) => {
  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  });

  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn
  });

  return {
    accessToken,
    refreshToken
  };
};

module.exports = {
  authenticateToken,
  optionalAuth,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateTokenPair,
  generateTokens
};