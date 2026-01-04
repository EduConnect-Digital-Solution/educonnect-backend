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
  getRefreshTokenFromCookie 
} = require('../utils/cookieHelper');

// Import services
const invitationService = require('../services/invitationService');

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

    if (error.message.includes('Invalid OTP') || error.message.includes('expired')) {
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

    // Set refresh token as HttpOnly cookie
    setRefreshTokenCookie(res, result.tokens.refreshToken, req);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: result.user.id,
          schoolId: result.user.schoolId,
          schoolName: result.school.schoolName,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          role: result.user.role
        },
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
 * Generates new access token using refresh token from HttpOnly cookie
 * Requirements: 2.5
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
    
    if (error.message.includes('Invalid') || error.message.includes('expired') || 
        error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
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
 * Logout
 * Clears HttpOnly cookie and invalidates the current session
 * Requirements: 2.5
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
    // For testing, allow schoolId in body, in production this would come from auth middleware
    const { schoolId } = req.body;
    let targetSchoolId = schoolId;
    
    if (!targetSchoolId) {
      // If no schoolId provided, find the most recent active school for testing
      const School = require('../models/School');
      const recentSchool = await School.findOne({ 
        isActive: true, 
        isVerified: true 
      }).sort({ createdAt: -1 });
      
      if (!recentSchool) {
        return res.status(404).json({
          success: false,
          message: 'No active school found. Please provide schoolId or ensure school is registered and verified.'
        });
      }
      targetSchoolId = recentSchool.schoolId;
    }

    // For testing, find admin user. In production, this would be req.user.userId from auth middleware
    const User = require('../models/User');
    const adminUser = await User.findOne({ 
      schoolId: targetSchoolId, 
      role: 'admin' 
    });
    
    if (!adminUser) {
      return res.status(400).json({
        success: false,
        message: 'No admin user found for this school'
      });
    }

    const result = await invitationService.createTeacherInvitation(req.body, targetSchoolId, adminUser._id);

    res.status(201).json({
      success: true,
      message: 'Teacher invitation sent successfully. User account created with temporary password.',
      data: {
        invitationId: result.invitation.id,
        userId: result.user.id,
        email: result.user.email,
        role: result.user.role,
        tempPassword: result.temporaryPassword, // Include for testing only - remove in production
        schoolId: targetSchoolId,
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
    // For testing, allow schoolId in body, in production this would come from auth middleware
    const { schoolId } = req.body;
    let targetSchoolId = schoolId;
    
    if (!targetSchoolId) {
      // If no schoolId provided, find the most recent active school for testing
      const School = require('../models/School');
      const recentSchool = await School.findOne({ 
        isActive: true, 
        isVerified: true 
      }).sort({ createdAt: -1 });
      
      if (!recentSchool) {
        return res.status(404).json({
          success: false,
          message: 'No active school found. Please provide schoolId or ensure school is registered and verified.'
        });
      }
      targetSchoolId = recentSchool.schoolId;
    }

    // For testing, find admin user. In production, this would be req.user.userId from auth middleware
    const User = require('../models/User');
    const adminUser = await User.findOne({ 
      schoolId: targetSchoolId, 
      role: 'admin' 
    });
    
    if (!adminUser) {
      return res.status(400).json({
        success: false,
        message: 'No admin user found for this school'
      });
    }

    const result = await invitationService.createParentInvitation(req.body, targetSchoolId, adminUser._id);

    res.status(201).json({
      success: true,
      message: 'Parent invitation sent successfully. User account created with temporary password.',
      data: {
        invitationId: result.invitation.id,
        userId: result.user.id,
        email: result.user.email,
        role: result.user.role,
        tempPassword: result.temporaryPassword, // Include for testing only - remove in production
        schoolId: targetSchoolId,
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
    
    // Get school info
    let targetSchoolId = schoolId;
    if (!targetSchoolId) {
      const School = require('../models/School');
      const recentSchool = await School.findOne({ 
        isActive: true, 
        isVerified: true 
      }).sort({ createdAt: -1 });
      
      if (!recentSchool) {
        return res.status(404).json({
          success: false,
          message: 'No active school found'
        });
      }
      targetSchoolId = recentSchool.schoolId;
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

    if (error.message === 'Cannot resend invitation - user has already completed registration' ||
        error.message === 'Cannot resend cancelled invitation' ||
        error.message === 'Can only resend pending invitations' ||
        error.message === 'Cannot resend expired invitation. Please create a new invitation.') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Associated user or school not found') {
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
    
    // Get school info
    let targetSchoolId = schoolId;
    if (!targetSchoolId) {
      const School = require('../models/School');
      const recentSchool = await School.findOne({ 
        isActive: true, 
        isVerified: true 
      }).sort({ createdAt: -1 });
      
      if (!recentSchool) {
        return res.status(404).json({
          success: false,
          message: 'No active school found'
        });
      }
      targetSchoolId = recentSchool.schoolId;
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
    
    // Get school info
    let targetSchoolId = schoolId;
    if (!targetSchoolId) {
      const School = require('../models/School');
      const recentSchool = await School.findOne({ 
        isActive: true, 
        isVerified: true 
      }).sort({ createdAt: -1 });
      
      if (!recentSchool) {
        return res.status(404).json({
          success: false,
          message: 'No active school found'
        });
      }
      targetSchoolId = recentSchool.schoolId;
    }

    // For testing, find admin user. In production, this would be req.user.userId from auth middleware
    const User = require('../models/User');
    const adminUser = await User.findOne({ 
      schoolId: targetSchoolId, 
      role: 'admin' 
    });

    if (!adminUser) {
      return res.status(400).json({
        success: false,
        message: 'No admin user found for this school'
      });
    }

    const result = await invitationService.cancelInvitation(invitationId, targetSchoolId, adminUser._id, reason);

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

    if (error.message === 'No admin user found for this school') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Cannot cancel invitation - user has already completed registration' ||
        error.message === 'Invitation is already cancelled') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Re-throw for global error handler
    throw error;
  }
});module.
exports = {
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
  cancelInvitation
};