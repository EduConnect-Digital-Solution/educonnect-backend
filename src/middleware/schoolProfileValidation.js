/**
 * School Profile Management Validation Middleware
 * Validation rules for school profile viewing and updating
 */

const { body, query } = require('express-validator');

/**
 * Validation for school profile query parameters
 */
const validateSchoolProfileQuery = [
  query('schoolId')
    .optional()
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('Invalid school ID format')
];

/**
 * Validation for school profile update
 */
const validateSchoolProfileUpdate = [
  body('schoolId')
    .optional()
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('Invalid school ID format'),

  body('schoolName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('School name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-'.,&()]+$/)
    .withMessage('School name contains invalid characters'),

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
 * Validation for admin profile update
 */
const validateAdminProfileUpdate = [
  body('schoolId')
    .optional()
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('Invalid school ID format'),

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
    .withMessage('Please provide a valid phone number')
];

/**
 * Validation for school status change
 */
const validateSchoolStatusChange = [
  body('schoolId')
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('Invalid school ID format'),

  body('isActive')
    .isBoolean()
    .withMessage('isActive must be a boolean value'),

  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters')
];

/**
 * Sanitization middleware for school profile data
 */
const sanitizeSchoolProfileData = (req, res, next) => {
  if (req.body.schoolName) {
    req.body.schoolName = req.body.schoolName.trim();
  }
  if (req.body.phone) {
    req.body.phone = req.body.phone.trim();
  }
  if (req.body.address) {
    req.body.address = req.body.address.trim();
  }
  if (req.body.website) {
    req.body.website = req.body.website.trim();
  }
  if (req.body.description) {
    req.body.description = req.body.description.trim();
  }
  if (req.body.firstName) {
    req.body.firstName = req.body.firstName.trim();
  }
  if (req.body.lastName) {
    req.body.lastName = req.body.lastName.trim();
  }
  if (req.body.reason) {
    req.body.reason = req.body.reason.trim();
  }
  next();
};

module.exports = {
  validateSchoolProfileQuery,
  validateSchoolProfileUpdate,
  validateAdminProfileUpdate,
  validateSchoolStatusChange,
  sanitizeSchoolProfileData
};