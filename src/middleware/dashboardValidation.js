/**
 * Dashboard Validation Middleware
 * Provides validation for dashboard-related operations
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

/**
 * Validate child ID parameter for parent dashboard
 */
const validateChildId = [
  param('childId')
    .isMongoId()
    .withMessage('Invalid child ID format'),
  
  handleValidationErrors
];

/**
 * Validate parent profile update
 */
const validateParentProfileUpdate = [
  body('firstName')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('lastName')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('phone')
    .optional()
    .matches(/^\+?[\d\s\-\(\)]+$/)
    .withMessage('Phone number format is invalid'),
  
  body('address')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Address cannot exceed 200 characters'),
  
  body('occupation')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Occupation cannot exceed 100 characters'),
  
  body('emergencyContact')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Emergency contact name must be between 2 and 100 characters'),
  
  body('emergencyPhone')
    .optional()
    .matches(/^\+?[\d\s\-\(\)]+$/)
    .withMessage('Emergency phone number format is invalid'),
  
  handleValidationErrors
];

/**
 * Validate teacher dashboard query parameters
 */
const validateTeacherQuery = [
  query('class')
    .optional()
    .isLength({ min: 1, max: 20 })
    .withMessage('Class must be between 1 and 20 characters'),
  
  query('section')
    .optional()
    .isLength({ min: 1, max: 10 })
    .withMessage('Section must be between 1 and 10 characters'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors
];

module.exports = {
  validateChildId,
  validateParentProfileUpdate,
  validateTeacherQuery,
  handleValidationErrors
};