/**
 * School Authentication Routes
 * Routes for school registration, verification, and login
 */

const express = require('express');
const router = express.Router();
const schoolAuthController = require('../controllers/schoolAuthController');
const {
  validateSchoolRegistration,
  validateEmailVerification,
  validateSchoolLogin,
  validateTokenRefresh,
  validateOTPResend,
  validatePasswordResetRequest,
  validatePasswordReset,
  validateTeacherInvitation,
  validateParentInvitation,
  validateInvitationResend,
  validateInvitationCancel,
  sanitizeSchoolData,
  validateRateLimit
} = require('../middleware/schoolAuthValidation');
const rateLimiter = require('../middleware/rateLimiter');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

/**
 * @route   POST /api/school/auth/register
 * @desc    Register a new school with admin user
 * @access  Public
 * @body    {schoolName, email, password, adminFirstName, adminLastName, phone?, address?, website?, description?}
 */
router.post('/register', 
  rateLimiter.authLimiter,
  validateRateLimit,
  sanitizeSchoolData,
  validateSchoolRegistration,
  schoolAuthController.registerSchool
);

/**
 * @route   POST /api/school/auth/verify-email
 * @desc    Verify school email with OTP
 * @access  Public
 * @body    {email, otp, schoolId}
 */
router.post('/verify-email',
  rateLimiter.authLimiter,
  validateEmailVerification,
  schoolAuthController.verifySchoolEmail
);

/**
 * @route   POST /api/school/auth/login
 * @desc    Login school admin
 * @access  Public
 * @body    {schoolId, email, password}
 */
router.post('/login',
  rateLimiter.authLimiter,
  validateSchoolLogin,
  schoolAuthController.loginSchoolAdmin
);

/**
 * @route   POST /api/school/auth/refresh-token
 * @desc    Refresh JWT access token
 * @access  Public
 * @body    {refreshToken}
 */
router.post('/refresh-token',
  rateLimiter.authLimiter,
  validateTokenRefresh,
  schoolAuthController.refreshToken
);

/**
 * @route   POST /api/school/auth/logout
 * @desc    Logout (invalidate session)
 * @access  Public
 */
router.post('/logout',
  schoolAuthController.logout
);

/**
 * @route   POST /api/school/auth/resend-otp
 * @desc    Resend OTP for email verification
 * @access  Public
 * @body    {email, schoolId}
 */
router.post('/resend-otp',
  rateLimiter.authLimiter,
  validateOTPResend,
  schoolAuthController.resendOTP
);

/**
 * @route   POST /api/school/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 * @body    {email, schoolId?}
 */
router.post('/forgot-password',
  rateLimiter.authLimiter,
  validatePasswordResetRequest,
  schoolAuthController.forgotPassword
);

/**
 * @route   POST /api/school/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 * @body    {token, newPassword, confirmPassword}
 */
router.post('/reset-password',
  rateLimiter.authLimiter,
  validatePasswordReset,
  schoolAuthController.resetPassword
);

/**
 * @route   POST /api/school/auth/invite-teacher
 * @desc    Create teacher invitation (Admin only - for testing)
 * @access  Private (Admin)
 * @body    {email, firstName, lastName, subjects?, message?}
 */
router.post('/invite-teacher',
  rateLimiter.authLimiter,
  authenticateToken,
  requireRole(['admin']),
  sanitizeSchoolData,
  validateTeacherInvitation,
  schoolAuthController.createTeacherInvitation
);

/**
 * @route   POST /api/school/auth/invite-parent
 * @desc    Create parent invitation with student linking (Admin only - for testing)
 * @access  Private (Admin)
 * @body    {email, firstName, lastName, studentIds, message?}
 */
router.post('/invite-parent',
  rateLimiter.authLimiter,
  authenticateToken,
  requireRole(['admin']),
  sanitizeSchoolData,
  validateParentInvitation,
  schoolAuthController.createParentInvitation
);

/**
 * @route   POST /api/school/auth/resend-invitation
 * @desc    Resend invitation email (Admin only)
 * @access  Private (Admin)
 * @body    {invitationId, schoolId?}
 */
router.post('/resend-invitation',
  rateLimiter.authLimiter,
  authenticateToken,
  requireRole(['admin']),
  validateInvitationResend,
  schoolAuthController.resendInvitation
);

/**
 * @route   GET /api/school/auth/invitations
 * @desc    List invitations with filtering (Admin only)
 * @access  Private (Admin)
 * @query   {schoolId?, status?, role?, page?, limit?}
 */
router.get('/invitations',
  rateLimiter.generalLimiter,
  authenticateToken,
  requireRole(['admin']),
  schoolAuthController.listInvitations
);

/**
 * @route   POST /api/school/auth/cancel-invitation
 * @desc    Cancel pending invitation (Admin only)
 * @access  Private (Admin)
 * @body    {invitationId, reason?, schoolId?}
 */
router.post('/cancel-invitation',
  rateLimiter.authLimiter,
  authenticateToken,
  requireRole(['admin']),
  validateInvitationCancel,
  schoolAuthController.cancelInvitation
);

module.exports = router;