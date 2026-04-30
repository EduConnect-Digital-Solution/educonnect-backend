/**
 * User Authentication Controller
 * Handles HTTP requests and delegates business logic to authService
 * Requirements: 2.1, 2.2, 2.3, 3.3, 3.4, 4.2, 4.3
 */

const authService = require('../services/authService');
const { prisma } = require('../config/database');
const catchAsync = require('../utils/catchAsync');
const { validationResult } = require('express-validator');
const {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshTokenFromCookie,
  setSessionIdCookie,
  clearSessionIdCookie,
  getSessionIdFromCookie
} = require('../utils/cookieHelper');

// Legacy imports for non-auth functions (to be refactored in Phase 3)
const EmailService = require('../config/email');
const logger = require('../utils/logger');



/**
 * Complete User Registration
 * Allows users with temporary passwords to complete their registration
 * Requirements: 3.3, 3.4, 4.2, 4.3
 */
const completeRegistration = catchAsync(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  try {
    const result = await authService.completeRegistration(req.body);

    // Generate tokens for the user
    const tokens = authService.generateTokens(result.user.id, result.user.schoolId, result.user.role);

    // Set refresh token as HttpOnly cookie
    setRefreshTokenCookie(res, tokens.refreshToken, req);

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        user: result.user,
        tokens: {
          accessToken: tokens.accessToken,
          expiresIn: tokens.expiresIn
          // refreshToken is now in HttpOnly cookie
        }
      }
    });
  } catch (error) {
    // Handle specific business logic errors
    if (error.message === 'User not found or registration already completed') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Invalid current password') {
      return res.status(401).json({
        success: false,
        message: error.message
      });
    }

    // Re-throw for global error handler
    throw error;
  }
});

/**
 * Universal User Login
 * Handles login for teachers, parents, and other users
 * Requirements: 2.1, 2.2, 2.3
 */
const loginUser = catchAsync(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  try {
    const { email, password, schoolId } = req.body;
    const result = await authService.loginUser(email, password, schoolId);

    // Handle temporary password users
    if (result.redirectTo) {
      return res.status(200).json({
        success: true,
        message: 'Login successful. Please complete your registration.',
        data: {
          user: result.user,
          redirectTo: result.redirectTo
        }
      });
    }

    // Set session ID as HttpOnly cookie (JWT stays server-side in Redis)
    if (result.sessionId) {
      setSessionIdCookie(res, result.sessionId, req);
    }

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        school: result.school,
        tokens: {
          accessToken: result.tokens.accessToken,
          expiresIn: result.tokens.expiresIn
          // refreshToken and sessionId are server-side only
        }
      }
    });
  } catch (error) {
    // Handle specific business logic errors
    if (error.message === 'Invalid credentials') {
      return res.status(401).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('not verified') || error.message.includes('deactivated') || error.message.includes('contact school administration')) {
      return res.status(401).json({
        success: false,
        message: error.message
      });
    }

    // Re-throw for global error handler
    throw error;
  }
});

/**
 * Refresh Access Token
 * Reads session ID from HttpOnly cookie, retrieves refresh token from Redis,
 * generates new tokens, and updates the session.
 */
const refreshToken = catchAsync(async (req, res) => {
  const SessionService = require('../services/sessionService');

  try {
    // 1. Get session ID from cookie
    const sessionId = getSessionIdFromCookie(req);

    if (!sessionId) {
      return res.status(401).json({
        success: false,
        message: 'No session found. Please login again.'
      });
    }

    // 2. Look up session in Redis to get the stored refresh token
    const session = await SessionService.validateSession(sessionId);

    if (!session || !session.tokens || !session.tokens.refreshToken) {
      clearSessionIdCookie(res, req);
      return res.status(401).json({
        success: false,
        message: 'Session expired or invalid. Please login again.'
      });
    }

    // 3. Use the server-side refresh token to get new tokens
    const result = await authService.refreshToken(session.tokens.refreshToken, 'session');

    // 4. Update the session in Redis with the new tokens
    const { getRedisClient, isRedisAvailable } = require('../config/redis');
    if (isRedisAvailable()) {
      const redis = getRedisClient();
      const sessionKey = `session:${sessionId}`;
      const updatedSession = {
        ...session,
        tokens: {
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken
        },
        lastActivity: new Date().toISOString()
      };
      await redis.setex(sessionKey, 7 * 24 * 60 * 60, JSON.stringify(updatedSession));
    }

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        user: result.user,
        tokens: {
          accessToken: result.tokens.accessToken,
          expiresIn: result.tokens.expiresIn
          // refreshToken stays server-side in Redis
        }
      }
    });
  } catch (error) {
    clearSessionIdCookie(res, req);

    if (error.message.includes('Invalid') || error.message.includes('expired')) {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please login again.'
      });
    }

    throw error;
  }
});

/**
 * User Logout
 * Clears session cookie and revokes server-side session
 */
const logout = catchAsync(async (req, res) => {
  try {
    const SessionService = require('../services/sessionService');

    // 1. Blacklist the access token if present
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const CacheService = require('../services/cacheService');
      await CacheService.blacklistToken(token, 3600);
    }

    // 2. Revoke the server-side session using cookie
    const sessionId = getSessionIdFromCookie(req);
    if (sessionId) {
      const session = await SessionService.validateSession(sessionId);
      const userId = session ? session.userId : (req.user && req.user.userId);
      await SessionService.revokeSession(sessionId, userId);
    }

    // 3. Clear all cookies
    clearRefreshTokenCookie(res, req);
    clearSessionIdCookie(res, req);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    // Even if anything fails, always clear cookies and return success
    try {
      clearRefreshTokenCookie(res, req);
      clearSessionIdCookie(res, req);
    } catch (cookieError) {
      // Ignore cookie clearing errors
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  }
});

/**
 * Get Current User Profile (Unified for All User Types)
 * Uses session ID from HttpOnly cookie via authenticateRefreshToken middleware
 * Handles: teachers, parents, school admins, system admins
 */
const getMe = catchAsync(async (req, res) => {
  try {
    const { userId, role, schoolId, isSystemAdmin, email } = req.user;

    // Handle system admin
    if (isSystemAdmin || role === 'system_admin') {
      return res.status(200).json({
        success: true,
        user: {
          id: req.user.userId,
          email: email,
          firstName: 'System',
          lastName: 'Administrator',
          fullName: 'System Administrator',
          role: 'system_admin',
          schoolId: null,
          school: null,
          isActive: true,
          isVerified: true,
          isSystemAdmin: true,
          systemAdminLevel: req.user.systemAdminLevel || 'super',
          crossSchoolAccess: req.user.crossSchoolAccess || true
        }
      });
    }

    // Handle school admin (has schoolId but no userId)
    if (schoolId && !userId) {
      // Find school by either UUID (id) or human-readable schoolId
      let school = await prisma.school.findFirst({
        where: { id: schoolId }
      });
      
      // If not found by UUID, try human-readable schoolId
      if (!school) {
        school = await prisma.school.findFirst({
          where: { schoolId: schoolId }
        });
      }

      if (!school) {
        return res.status(401).json({
          success: false,
          message: 'School not found. Please log in again.'
        });
      }

      if (!school.isActive) {
        return res.status(401).json({
          success: false,
          message: 'School account has been deactivated. Please contact support.'
        });
      }

      return res.status(200).json({
        success: true,
        user: {
          id: school.id,
          email: school.email,
          firstName: req.user.firstName || 'School',
          lastName: req.user.lastName || 'Admin',
          fullName: `${req.user.firstName || 'School'} ${req.user.lastName || 'Admin'}`,
          role: 'admin',
          schoolId: school.schoolId,
          school: {
            id: school.id,
            schoolName: school.schoolName,
            email: school.email,
            address: school.address,
            phone: school.phone,
            website: school.website
          },
          phone: school.phone,
          isActive: school.isActive,
          isVerified: school.isVerified,
          isSchoolAdmin: true,
          lastLogin: school.lastLogin,
          createdAt: school.createdAt
        }
      });
    }

    // Handle regular user (teacher/parent)
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, schoolId: true, isActive: true, isVerified: true,
          isTemporaryPassword: true, phone: true, subjects: true,
          createdAt: true, lastLoginAt: true
        }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found. Please log in again.'
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account has been deactivated. Please contact your administrator.'
        });
      }

      // Fetch school data (schoolId is a string, not a reference)
      let schoolData = null;
      if (user.schoolId) {
        const school = await prisma.school.findFirst({
          where: { id: user.schoolId },
          select: { id: true, schoolName: true, email: true, address: true, phone: true, website: true }
        });
        
        if (school) {
          schoolData = {
            id: school.id,
            schoolName: school.schoolName,
            email: school.email,
            address: school.address,
            phone: school.phone,
            website: school.website
          };
        }
      }

      return res.status(200).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: `${user.firstName} ${user.lastName}`,
          role: user.role,
          schoolId: user.schoolId,
          school: schoolData,
          phone: user.phone,
          profileImage: user.profileImage,
          isActive: user.isActive,
          isVerified: user.isVerified,
          isSchoolAdmin: user.isSchoolAdmin,
          lastLogin: user.lastLoginAt,
          createdAt: user.createdAt,
          // Role-specific fields
          ...(user.role === 'teacher' && {
            subjects: user.subjects,
            classes: user.classes
          }),
          ...(user.role === 'parent' && {
            studentIds: user.studentIds,
            children: user.studentIds // For backward compatibility
          })
        }
      });
    }

    // Unexpected token format
    return res.status(401).json({
      success: false,
      message: 'Invalid token format. Please log in again.'
    });

  } catch (error) {
    logger.error('Error in getMe:', error.message);

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      ...(process.env.NODE_ENV !== 'production' && { error: error.message })
    });
  }
});

module.exports = {
  completeRegistration,
  loginUser,
  refreshToken,
  logout,
  getMe
};