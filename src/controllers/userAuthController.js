/**
 * User Authentication Controller
 * Handles HTTP requests and delegates business logic to authService
 * Requirements: 2.1, 2.2, 2.3, 3.3, 3.4, 4.2, 4.3
 */

const authService = require('../services/authService');
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
const User = require('../models/User');
const School = require('../models/School');
const Student = require('../models/Student');
const Invitation = require('../models/Invitation');
const EmailService = require('../config/email');



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

    // Set refresh token as HttpOnly cookie
    setRefreshTokenCookie(res, result.tokens.refreshToken, req);

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        user: result.user,
        tokens: {
          accessToken: result.tokens.accessToken,
          expiresIn: result.tokens.expiresIn
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
 * Uses HttpOnly cookie to refresh access token
 */
const refreshToken = catchAsync(async (req, res) => {
  try {
    // Try to get refresh token from cookie first, then fallback to body for backward compatibility
    let refreshTokenValue = getRefreshTokenFromCookie(req);
    let source = 'cookie';

    if (!refreshTokenValue && req.body.refreshToken) {
      refreshTokenValue = req.body.refreshToken;
      source = 'body';
      console.log('⚠️ Using refresh token from request body (deprecated)');
    }

    if (!refreshTokenValue) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token not found. Please login again.'
      });
    }

    const result = await authService.refreshToken(refreshTokenValue, source);

    // Set new refresh token as HttpOnly cookie
    setRefreshTokenCookie(res, result.tokens.refreshToken, req);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        user: result.user,
        tokens: {
          accessToken: result.tokens.accessToken,
          expiresIn: result.tokens.expiresIn
          // refreshToken is now in HttpOnly cookie
        }
      }
    });
  } catch (error) {
    // Clear invalid refresh token cookie
    clearRefreshTokenCookie(res, req);

    if (error.message.includes('Invalid') || error.message.includes('expired')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token. Please login again.'
      });
    }

    // Re-throw for global error handler
    throw error;
  }
});

/**
 * User Logout
 * Clears HttpOnly cookie and invalidates session
 */
const logout = catchAsync(async (req, res) => {
  try {
    // Clear both cookies (refresh token + session ID)
    clearRefreshTokenCookie(res, req);
    clearSessionIdCookie(res, req);

    // If user ID is available from auth middleware, invalidate cached session
    if (req.user && req.user.userId) {
      await authService.invalidateUserSession(req.user.userId);
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    // Even if session invalidation fails, clear the cookies
    clearRefreshTokenCookie(res, req);
    clearSessionIdCookie(res, req);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  }
});

/**
 * Get Current User Profile (Unified for All User Types)
 * Uses refresh token from HttpOnly cookie via authenticateRefreshToken middleware
 * Handles: teachers, parents, school admins, system admins
 * Requirements: Session management, User profile access
 */
const getMe = catchAsync(async (req, res) => {
  try {
    // req.user is populated by authenticateToken middleware
    const { userId, role, schoolId, isSystemAdmin, email } = req.user;

    // Handle system admin
    if (isSystemAdmin || role === 'system_admin') {
      return res.status(200).json({
        success: true,
        user: {
          id: req.user.id,
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
      const school = await School.findOne({ schoolId })
        .select('-password');

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
          id: school._id,
          email: school.email,
          firstName: req.user.firstName || 'School',
          lastName: req.user.lastName || 'Admin',
          fullName: `${req.user.firstName || 'School'} ${req.user.lastName || 'Admin'}`,
          role: 'admin',
          schoolId: school.schoolId,
          school: {
            _id: school._id,
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
      const user = await User.findById(userId)
        .populate('studentIds', 'firstName lastName studentId class grade')
        .select('-password -invitationToken -passwordResetToken');

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
        const school = await School.findOne({ schoolId: user.schoolId })
          .select('schoolName email address phone website');

        if (school) {
          schoolData = {
            _id: school._id,
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
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          role: user.role,
          schoolId: user.schoolId,
          school: schoolData,
          phone: user.phone,
          profileImage: user.profileImage,
          isActive: user.isActive,
          isVerified: user.isVerified,
          isSchoolAdmin: user.isSchoolAdmin,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          // Role-specific fields
          ...(user.role === 'teacher' && {
            employeeId: user.employeeId,
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
    console.error('Error in getMe:', error.message);

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