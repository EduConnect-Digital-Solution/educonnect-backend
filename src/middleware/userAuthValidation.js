/**
 * User Authentication Validation Middleware
 * Validation rules for teacher and parent registration and authentication
 */

const { body } = require('express-validator');



/**
 * Validation for parent registration
 */
const validateParentRegistration = [
  body('invitationToken')
    .notEmpty()
    .withMessage('Invitation token is required')
    .isLength({ min: 32, max: 128 })
    .withMessage('Invalid invitation token format'),

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

  body('phone')
    .optional()
    .isMobilePhone('any', { strictMode: false })
    .withMessage('Please provide a valid phone number'),

  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address cannot exceed 500 characters'),

  body('occupation')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Occupation cannot exceed 100 characters'),

  body('emergencyContact')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Emergency contact cannot exceed 100 characters'),

  body('emergencyPhone')
    .optional()
    .isMobilePhone('any', { strictMode: false })
    .withMessage('Please provide a valid emergency phone number')
];

/**
 * Validation for user login
 */
const validateUserLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  body('password')
    .isLength({ min: 1 })
    .withMessage('Password is required'),

  body('schoolId')
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('Invalid school ID format')
];



/**
 * Validation for complete registration
 */
const validateCompleteRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  body('schoolId')
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('Invalid school ID format'),

  body('currentPassword')
    .isLength({ min: 1 })
    .withMessage('Current password is required'),

  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('First name contains invalid characters'),

  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('Last name contains invalid characters'),

  body('phone')
    .optional()
    .isMobilePhone('any', { strictMode: false })
    .withMessage('Please provide a valid phone number'),

  // Teacher-specific validations
  body('subjects')
    .optional()
    .isArray()
    .withMessage('Subjects must be an array'),

  body('qualifications')
    .optional()
    .isArray()
    .withMessage('Qualifications must be an array'),

  body('experience')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('Experience must be a number between 0 and 50 years'),

  // Parent-specific validations
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address cannot exceed 500 characters'),

  body('occupation')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Occupation cannot exceed 100 characters'),

  body('emergencyContact')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Emergency contact cannot exceed 100 characters'),

  body('emergencyPhone')
    .optional()
    .isMobilePhone('any', { strictMode: false })
    .withMessage('Please provide a valid emergency phone number')
];

/**
 * Sanitization middleware for user data
 */
const sanitizeUserData = (req, res, next) => {
  if (req.body.firstName) {
    req.body.firstName = req.body.firstName.trim();
  }
  if (req.body.lastName) {
    req.body.lastName = req.body.lastName.trim();
  }
  if (req.body.address) {
    req.body.address = req.body.address.trim();
  }
  if (req.body.occupation) {
    req.body.occupation = req.body.occupation.trim();
  }
  if (req.body.emergencyContact) {
    req.body.emergencyContact = req.body.emergencyContact.trim();
  }
  if (req.body.subjects && Array.isArray(req.body.subjects)) {
    req.body.subjects = req.body.subjects.map(subject => subject.trim()).filter(subject => subject.length > 0);
  }
  if (req.body.qualifications && Array.isArray(req.body.qualifications)) {
    req.body.qualifications = req.body.qualifications.map(qual => qual.trim()).filter(qual => qual.length > 0);
  }
  next();
};

module.exports = {
  validateParentRegistration,
  validateUserLogin,
  validateCompleteRegistration,
  sanitizeUserData
};