/**
 * School Authentication Controller
 * Handles HTTP requests and delegates business logic to authService
 * Implements requirements 1.1, 1.2, 1.3, 1.4, 1.6, 2.1, 2.2, 2.4, 2.5
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

// Import services
const invitationService = require('../services/invitationService');
const logger = require('../utils/logger');

/**
 * School Registration Controller
 * Creates a new school with automatic admin user creation and OTP verification
 * Requirements: 1.1, 1.2, 1.3
 */
const registerSchool = catchAsync(async (req, res) => {
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
    const result = await authService.registerSchool(req.body, req.ip || req.connection.remoteAddress);

    res.status(201).json({
      success: true,
      message: 'School registration successful. Please check your email for verification code.',
      data: {
        schoolId: result.school.schoolId,
        schoolName: result.school.schoolName,
        email: result.school.email,
        adminUser: result.adminUser,
        verificationRequired: true,
        otpSent: result.otpSent
      }
    });
  } catch (error) {
    // Handle specific business logic errors
    if (error.message === 'A school with this email address already exists') {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    // Re-throw for global error handler
    throw error;
  }
});

/**
 * Verify School Email with OTP
 * Verifies the school email and activates the school account
 * Requirements: 1.4, 1.6
 */
const verifySchoolEmail = catchAsync(async (req, res) => {
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
    const { email, otp } = req.body;
    const result = await authService.verifyEmail(email, otp, req.ip || req.connection.remoteAddress);

    res.status(200).json({
      success: true,
      message: 'School email verified successfully',
      data: {
        schoolId: result.school.schoolId,
        schoolName: result.school.schoolName,
        isVerified: result.school.isVerified,
        isActive: result.school.isActive,
        welcomeEmailSent: result.emailSent
      }
    });
  } catch (error) {
    // Handle specific business logic errors
    if (error.message === 'School not found or already verified') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Invalid OTP') || error.message.includes('expired') || error.message.includes('No valid OTP found') || error.message.includes('Maximum verification attempts exceeded')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Re-throw for global error handler
    throw error;
  }
});

/**
 * School Admin Login
 * Authenticates school admin with schoolId, email, and password
 * Requirements: 2.1, 2.2
 */
const loginSchoolAdmin = catchAsync(async (req, res) => {
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
    const { schoolId, email, password } = req.body;
    const result = await authService.loginSchool(schoolId, email, password);

    // Set session ID as HttpOnly cookie (JWT stays server-side in Redis)
    if (result.sessionId) {
      setSessionIdCookie(res, result.sessionId, req);
    }

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: result.user.id,
          schoolId: result.school.schoolId,
          schoolName: result.school.schoolName,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          role: result.user.role
        },
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

    if (error.message.includes('not verified')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('deactivated')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    // Re-throw for global error handler
    throw error;
  }
});

/**
 * Refresh JWT Token
 * Reads session ID from HttpOnly cookie, retrieves refresh token from Redis,
 * generates new tokens, and updates the session.
 * Requirements: 2.5
 */
const refreshToken = catchAsync(async (req, res) => {
  const SessionService = require('../services/sessionService');

  try {
    const sessionId = getSessionIdFromCookie(req);

    if (!sessionId) {
      return res.status(401).json({
        success: false,
        message: 'No session found. Please login again.'
      });
    }

    const session = await SessionService.validateSession(sessionId);

    if (!session || !session.tokens || !session.tokens.refreshToken) {
      clearSessionIdCookie(res, req);
      return res.status(401).json({
        success: false,
        message: 'Session expired or invalid. Please login again.'
      });
    }

    const result = await authService.refreshToken(session.tokens.refreshToken, 'session');

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
        }
      }
    });
  } catch (error) {
    clearSessionIdCookie(res, req);

    if (error.message.includes('Invalid') || error.message.includes('expired') ||
      error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please login again.'
      });
    }

    throw error;
  }
});

/**
 * Logout
 * Clears session cookie and revokes server-side session
 * Requirements: 2.5
 */
const logout = catchAsync(async (req, res) => {
  try {
    const SessionService = require('../services/sessionService');

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const CacheService = require('../services/cacheService');
      await CacheService.blacklistToken(token, 3600);
    }

    const sessionId = getSessionIdFromCookie(req);
    if (sessionId) {
      const session = await SessionService.validateSession(sessionId);
      const userId = session ? session.userId : (req.user && req.user.userId);
      await SessionService.revokeSession(sessionId, userId);
    }

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
 * Forgot Password
 * Sends password reset email with secure token
 * Requirements: 2.4
 */
const forgotPassword = catchAsync(async (req, res) => {
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
    const { email } = req.body;
    const result = await authService.forgotPassword(email, req.ip || req.connection.remoteAddress);

    res.status(200).json({
      success: result.success,
      message: result.message,
      data: {
        emailSent: result.emailSent,
        expiresIn: result.expiresIn
      }
    });
  } catch (error) {
    // Handle specific business logic errors
    if (error.message.includes('Failed to send')) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }

    // Re-throw for global error handler
    throw error;
  }
});

/**
 * Reset Password
 * Resets password using secure token
 * Requirements: 2.4
 */
const resetPassword = catchAsync(async (req, res) => {
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
    const { email, otp, newPassword } = req.body;
    const result = await authService.resetPassword(email, otp, newPassword, req.ip || req.connection.remoteAddress);

    res.status(200).json({
      success: result.success,
      message: result.message,
      data: {
        passwordReset: result.passwordReset,
        schoolId: result.schoolId
      }
    });
  } catch (error) {
    // Handle specific business logic errors
    if (error.message === 'School not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Invalid') || error.message.includes('expired')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Re-throw for global error handler
    throw error;
  }
});

/**
 * Resend OTP
 * Resends OTP for school email verification
 */
const resendOTP = catchAsync(async (req, res) => {
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
    const { email } = req.body;
    const result = await authService.resendOTP(email, req.ip || req.connection.remoteAddress);

    res.status(200).json({
      success: result.success,
      message: result.message,
      data: {
        emailSent: result.emailSent,
        expiresIn: result.expiresIn
      }
    });
  } catch (error) {
    // Handle specific business logic errors
    if (error.message === 'School not found or already verified') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Failed to send OTP email') {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }

    // Re-throw for global error handler
    throw error;
  }
});

/**
 * Create Teacher Invitation (Admin only)
 * Creates invitation token for teacher registration
 * Requirements: 3.1, 8.1
 */
const createTeacherInvitation = catchAsync(async (req, res) => {
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
    // Use authenticated user's schoolId from JWT token
    const targetSchoolId = req.user.schoolId;
    const adminUserId = req.user.userId;

    if (!targetSchoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID not found in authentication token'
      });
    }

    if (!adminUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID not found in authentication token'
      });
    }

    const result = await invitationService.createTeacherInvitation(req.body, targetSchoolId, adminUserId);

    res.status(201).json({
      success: true,
      message: 'Teacher invitation sent successfully. User account created with temporary password.',
      data: {
        invitationId: result.invitation.id,
        userId: result.user.id,
        email: result.user.email,
        role: result.user.role,
        tempPassword: result.temporaryPassword, // Include for testing only - remove in production
        schoolId: result.schoolId,
        isActive: result.user.isActive,
        isTemporaryPassword: result.user.isTemporaryPassword,
        expiresAt: result.invitation.expiresAt,
        emailSent: result.emailSent
      }
    });
  } catch (error) {
    // Handle specific business logic errors
    if (error.message === 'School not found or inactive') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'No admin user found for this school') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Active invitation already exists for this email') {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    // Re-throw for global error handler
    throw error;
  }
});

/**
 * Create Parent Invitation (Admin only)
 * Creates invitation for parent registration with student linking
 * Requirements: 4.2, 4.3
 */
const createParentInvitation = catchAsync(async (req, res) => {
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
    // Use authenticated user's schoolId from JWT token
    const targetSchoolId = req.user.schoolId;
    const adminUserId = req.user.userId;

    if (!targetSchoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID not found in authentication token'
      });
    }

    if (!adminUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID not found in authentication token'
      });
    }

    const result = await invitationService.createParentInvitation(req.body, targetSchoolId, adminUserId);

    res.status(201).json({
      success: true,
      message: 'Parent invitation sent successfully. User account created with temporary password.',
      data: {
        invitationId: result.invitation.id,
        userId: result.user.id,
        email: result.user.email,
        role: result.user.role,
        tempPassword: result.temporaryPassword, // Include for testing only - remove in production
        schoolId: result.schoolId,
        studentIds: result.user.studentIds,
        linkedStudents: result.students,
        isActive: result.user.isActive,
        isTemporaryPassword: result.user.isTemporaryPassword,
        expiresAt: result.invitation.expiresAt,
        emailSent: result.emailSent
      }
    });
  } catch (error) {
    // Handle specific business logic errors
    if (error.message === 'School not found or inactive') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'No admin user found for this school') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'At least one student ID is required for parent invitation' ||
      error.message === 'One or more student IDs are invalid or do not belong to this school') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Active invitation already exists for this email') {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    // Re-throw for global error handler
    throw error;
  }
});

/**
 * Resend Invitation
 * Resends invitation email for pending invitations
 * Requirements: 8.2
 */
const resendInvitation = catchAsync(async (req, res) => {
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
    const { invitationId, schoolId } = req.body;

    // Use authenticated user's schoolId from JWT token
    let targetSchoolId = req.user.schoolId;

    if (!targetSchoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID not found in authentication token'
      });
    }

    const result = await invitationService.resendInvitation(invitationId, targetSchoolId);

    res.status(200).json({
      success: true,
      message: 'Invitation resent successfully',
      data: result
    });
  } catch (error) {
    // Handle specific business logic errors
    if (error.message === 'Invitation not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Cannot resend') ||
      error.message.includes('expired') ||
      error.message.includes('Can only resend')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    // Re-throw for global error handler
    throw error;
  }
});

/**
 * List Invitations
 * Get invitations for a school with filtering options
 * Requirements: 8.1
 */
const listInvitations = catchAsync(async (req, res) => {
  try {
    const { schoolId, status, role, page = 1, limit = 10 } = req.query;

    // Use authenticated user's schoolId from JWT token
    let targetSchoolId = req.user.schoolId;

    if (!targetSchoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID not found in authentication token'
      });
    }

    const filters = { schoolId: targetSchoolId, status, role };
    const pagination = { page, limit };

    const result = await invitationService.listInvitations(filters, pagination);

    res.status(200).json({
      success: true,
      message: 'Invitations retrieved successfully',
      data: result
    });
  } catch (error) {
    // Re-throw for global error handler
    throw error;
  }
});

/**
 * Cancel Invitation
 * Cancel a pending invitation
 * Requirements: 8.1
 */
const cancelInvitation = catchAsync(async (req, res) => {
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
    const { invitationId, reason, schoolId } = req.body;

    // Use authenticated user's schoolId from JWT token
    let targetSchoolId = req.user.schoolId;

    if (!targetSchoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID not found in authentication token'
      });
    }

    // Use the authenticated user's ID as the admin ID for tracking
    const adminId = req.user.userId;

    const result = await invitationService.cancelInvitation(invitationId, targetSchoolId, adminId, reason);

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        invitation: result.invitation
      }
    });
  } catch (error) {
    // Handle specific business logic errors
    if (error.message === 'Invitation not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Cannot cancel') ||
      error.message.includes('already cancelled') ||
      error.message.includes('already expired')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Re-throw for global error handler
    throw error;
  }
});

/**
 * Get Current User Profile (School Admin)
 * Returns school admin information based on refresh token from HttpOnly cookie
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

    // Verify refresh token using auth middleware function
    const { verifyRefreshToken } = require('../middleware/auth');
    let decoded;

    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      // Token is invalid or expired, clear cookies
      clearRefreshTokenCookie(res, req);
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please log in again.'
      });
    }

    // For school admins, fetch school data instead of user data
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
    res.status(200).json({
      success: true,
      user: {
        id: school.id,
        email: school.email,
        firstName: decoded.firstName || 'School',
        lastName: decoded.lastName || 'Admin',
        fullName: `${decoded.firstName || 'School'} ${decoded.lastName || 'Admin'}`,
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

  } catch (error) {
    logger.error('Error in getMe (school):', error);

    // Clear cookies on any error
    clearRefreshTokenCookie(res, req);

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Delete Invitation
 * Permanently removes a cancelled, expired, or pending invitation from the database
 * Requirements: 8.6
 */
const deleteInvitation = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  try {
    const { invitationId } = req.body;

    // Use authenticated user's schoolId from JWT token
    const targetSchoolId = req.user.schoolId;

    if (!targetSchoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID not found in authentication token'
      });
    }

    const result = await invitationService.deleteInvitation(invitationId, targetSchoolId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    if (error.message === 'Invitation not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Cannot delete')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    throw error;
  }
});

module.exports = {
  registerSchool,
  verifySchoolEmail,
  loginSchoolAdmin,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  resendOTP,
  createTeacherInvitation,
  createParentInvitation,
  resendInvitation,
  listInvitations,
  cancelInvitation,
  deleteInvitation,
  getMe
};