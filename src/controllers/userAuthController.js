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
  getRefreshTokenFromCookie 
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

    // Set refresh token as HttpOnly cookie
    setRefreshTokenCookie(res, result.tokens.refreshToken, req);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        school: result.school,
        tokens: {
          accessToken: result.tokens.accessToken,
          expiresIn: result.tokens.expiresIn
          // refreshToken is now in HttpOnly cookie
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
    // Clear refresh token cookie
    clearRefreshTokenCookie(res, req);

    // If user ID is available from auth middleware, invalidate cached session
    if (req.user && req.user.userId) {
      await authService.invalidateUserSession(req.user.userId);
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    // Even if session invalidation fails, clear the cookie
    clearRefreshTokenCookie(res, req);
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  }
});

/**
 * Get Current User Profile (Unified for All User Types)
 * Returns user information based on refresh token from HttpOnly cookie
 * Handles: teachers, parents, school admins, system admins
 * Requirements: Session management, User profile access
 */
const getMe = catchAsync(async (req, res) => {
  try {
    // Get refresh token from HttpOnly cookie
    const refreshToken = getRefreshTokenFromCookie(req);
    
    if (!refreshToken) {
      // Clear any existing cookies and return unauthorized
      clearRefreshTokenCookie(res, req);
      return res.status(401).json({
        success: false,
        message: 'No active session found'
      });
    }

    // First, try to verify as regular user token
    const { verifyRefreshToken } = require('../middleware/auth');
    let decoded;
    let userType = 'user'; // Default to regular user
    
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      // If regular token verification fails, try system admin token
      try {
        const { verifySystemAdminToken } = require('../services/systemAdminAuthService');
        decoded = verifySystemAdminToken(refreshToken);
        userType = 'system_admin';
      } catch (systemAdminError) {
        // Both token verifications failed, clear cookies
        clearRefreshTokenCookie(res, req);
        return res.status(401).json({
          success: false,
          message: 'Session expired. Please log in again.'
        });
      }
    }

    // Handle different user types based on token content and type
    if (userType === 'system_admin') {
      // System Admin User
      return res.status(200).json({
        success: true,
        user: {
          id: `system_admin_${decoded.email}`,
          email: decoded.email,
          firstName: 'System',
          lastName: 'Administrator',
          fullName: 'System Administrator',
          role: 'system_admin',
          schoolId: null,
          school: null,
          isActive: true,
          isVerified: true,
          isSystemAdmin: true,
          systemAdminLevel: decoded.systemAdminLevel,
          crossSchoolAccess: decoded.crossSchoolAccess,
          loginTime: new Date(decoded.iat * 1000),
          expiresAt: new Date(decoded.exp * 1000)
        }
      });
    }

    // For regular users, determine if it's a school admin or regular user
    if (decoded.schoolId && !decoded.userId) {
      // This is a school admin token (has schoolId but no userId)
      const School = require('../models/School');
      const school = await School.findOne({ schoolId: decoded.schoolId })
        .select('-password');

      if (!school) {
        // School not found, clear cookies
        clearRefreshTokenCookie(res, req);
        return res.status(401).json({
          success: false,
          message: 'School not found. Please log in again.'
        });
      }

      // Check if school is still active
      if (!school.isActive) {
        clearRefreshTokenCookie(res, req);
        return res.status(401).json({
          success: false,
          message: 'School account has been deactivated. Please contact support.'
        });
      }

      // Return school admin profile data
      return res.status(200).json({
        success: true,
        user: {
          id: school._id,
          email: school.email,
          firstName: decoded.firstName || 'School',
          lastName: decoded.lastName || 'Admin',
          fullName: `${decoded.firstName || 'School'} ${decoded.lastName || 'Admin'}`,
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

    // Regular user (teacher/parent) - has userId in token
    if (decoded.userId) {
      const user = await User.findById(decoded.userId)
        .populate('school', 'schoolName email address phone website')
        .populate('studentIds', 'firstName lastName studentId class grade')
        .select('-password -invitationToken -passwordResetToken');

      if (!user) {
        // User not found, clear cookies
        clearRefreshTokenCookie(res, req);
        return res.status(401).json({
          success: false,
          message: 'User not found. Please log in again.'
        });
      }

      // Check if user is still active
      if (!user.isActive) {
        clearRefreshTokenCookie(res, req);
        return res.status(401).json({
          success: false,
          message: 'Account has been deactivated. Please contact your administrator.'
        });
      }

      // Return user profile data
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
          school: user.school,
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

    // If we reach here, token format is unexpected
    clearRefreshTokenCookie(res, req);
    return res.status(401).json({
      success: false,
      message: 'Invalid token format. Please log in again.'
    });

  } catch (error) {
    console.error('Error in unified getMe:', error);
    
    // Clear cookies on any error
    clearRefreshTokenCookie(res, req);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error'
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