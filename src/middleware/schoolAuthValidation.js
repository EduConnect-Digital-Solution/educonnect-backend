/**
 * School Authentication Validation Middleware
 * Validation rules for school registration, verification, and login
 */

const { body } = require('express-validator');

/**
 * Validation for school registration
 */
const validateSchoolRegistration = [
  body('schoolName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('School name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-'.,&()]+$/)
    .withMessage('School name contains invalid characters'),

  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
    .isLength({ max: 255 })
    .withMessage('Email address is too long'),

  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  body('adminFirstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('First name contains invalid characters'),

  body('adminLastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('Last name contains invalid characters'),

  body('phone')
    .optional()
    .isMobilePhone('any', { strictMode: false })
    .withMessage('Please provide a valid phone number'),

  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address cannot exceed 500 characters'),

  body('website')
    .optional()
    .isURL({ 
      protocols: ['http', 'https'],
      require_protocol: true 
    })
    .withMessage('Please provide a valid website URL'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters')
];

/**
 * Validation for email verification
 */
const validateEmailVerification = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  body('otp')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be exactly 6 characters')
    .isNumeric()
    .withMessage('OTP must contain only numbers')
];

/**
 * Validation for school admin login
 */
const validateSchoolLogin = [
  body('schoolId')
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('Invalid school ID format'),

  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  body('password')
    .isLength({ min: 1 })
    .withMessage('Password is required')
];

/**
 * Validation for token refresh
 */
const validateTokenRefresh = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
    .isJWT()
    .withMessage('Invalid refresh token format')
];

/**
 * Validation for OTP resend
 */
const validateOTPResend = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
];

/**
 * Validation for password reset request
 */
const validatePasswordResetRequest = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
];

/**
 * Validation for password reset completion
 */
const validatePasswordReset = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  body('otp')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be exactly 6 characters')
    .isNumeric()
    .withMessage('OTP must contain only numbers'),

  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    })
];

/**
 * Common validation for school ID parameter
 */
const validateSchoolIdParam = [
  body('schoolId')
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('Invalid school ID format')
];

/**
 * Validation for teacher invitation creation
 */
const validateTeacherInvitation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('First name contains invalid characters'),

  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('Last name contains invalid characters'),

  body('schoolId')
    .optional()
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('Invalid school ID format'),

  body('subjects')
    .optional()
    .isArray()
    .withMessage('Subjects must be an array'),

  body('message')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Message cannot exceed 500 characters')
];

/**
 * Validation for parent invitation creation
 */
const validateParentInvitation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('First name contains invalid characters'),

  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('Last name contains invalid characters'),

  body('schoolId')
    .optional()
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('Invalid school ID format'),

  body('studentIds')
    .isArray({ min: 1 })
    .withMessage('At least one student ID is required')
    .custom((studentIds) => {
      for (const studentId of studentIds) {
        if (!studentId || typeof studentId !== 'string' || studentId.length !== 24) {
          throw new Error('Each student ID must be a valid MongoDB ObjectId');
        }
      }
      return true;
    }),

  body('message')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Message cannot exceed 500 characters')
];

/**
 * Sanitization middleware for school data
 */
const sanitizeSchoolData = (req, res, next) => {
  if (req.body.schoolName) {
    req.body.schoolName = req.body.schoolName.trim();
  }
  if (req.body.adminFirstName) {
    req.body.adminFirstName = req.body.adminFirstName.trim();
  }
  if (req.body.adminLastName) {
    req.body.adminLastName = req.body.adminLastName.trim();
  }
  if (req.body.address) {
    req.body.address = req.body.address.trim();
  }
  if (req.body.description) {
    req.body.description = req.body.description.trim();
  }
  next();
};

/**
 * Rate limiting validation for sensitive operations
 */
const validateRateLimit = (req, res, next) => {
  // Add custom rate limiting logic here if needed
  // For now, we'll rely on the global rate limiter
  next();
};

/**
 * Validation for invitation resend
 */
const validateInvitationResend = [
  body('invitationId')
    .isMongoId()
    .withMessage('Invalid invitation ID format'),

  body('schoolId')
    .optional()
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('Invalid school ID format')
];

/**
 * Validation for invitation cancellation
 */
const validateInvitationCancel = [
  body('invitationId')
    .isMongoId()
    .withMessage('Invalid invitation ID format'),

  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Cancellation reason cannot exceed 500 characters'),

  body('schoolId')
    .optional()
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('Invalid school ID format')
];

module.exports = {
  validateSchoolRegistration,
  validateEmailVerification,
  validateSchoolLogin,
  validateTokenRefresh,
  validateOTPResend,
  validatePasswordResetRequest,
  validatePasswordReset,
  validateSchoolIdParam,
  validateTeacherInvitation,
  validateParentInvitation,
  validateInvitationResend,
  validateInvitationCancel,
  sanitizeSchoolData,
  validateRateLimit
};