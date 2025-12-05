/**
 * Parent Management Validation Middleware
 * Provides validation for parent management operations
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
 * Validate parent invitation data
 */
const validateInviteParent = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  
  body('firstName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
  
  body('lastName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
  
  body('studentIds')
    .isArray({ min: 1 })
    .withMessage('At least one student ID is required'),
  
  body('studentIds.*')
    .isMongoId()
    .withMessage('Each student ID must be a valid MongoDB ObjectId'),
  
  body('message')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Message cannot exceed 500 characters'),
  
  body('schoolId')
    .optional()
    .isLength({ min: 1 })
    .withMessage('School ID must be provided'),
  
  handleValidationErrors
];

/**
 * Validate query parameters for getting parents
 */
const validateGetParents = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('search')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  
  query('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be either active or inactive'),
  
  handleValidationErrors
];

/**
 * Validate parent ID parameter
 */
const validateParentId = [
  param('parentId')
    .isMongoId()
    .withMessage('Invalid parent ID format'),
  
  handleValidationErrors
];

/**
 * Validate linking parent to students
 */
const validateLinkParentToStudents = [
  param('parentId')
    .isMongoId()
    .withMessage('Invalid parent ID format'),
  
  body('studentIds')
    .isArray({ min: 1 })
    .withMessage('Student IDs must be a non-empty array'),
  
  body('studentIds.*')
    .isMongoId()
    .withMessage('Each student ID must be a valid MongoDB ObjectId'),
  
  handleValidationErrors
];

/**
 * Validate unlinking parent from students
 */
const validateUnlinkParentFromStudents = [
  param('parentId')
    .isMongoId()
    .withMessage('Invalid parent ID format'),
  
  body('studentIds')
    .isArray({ min: 1 })
    .withMessage('Student IDs must be a non-empty array'),
  
  body('studentIds.*')
    .isMongoId()
    .withMessage('Each student ID must be a valid MongoDB ObjectId'),
  
  handleValidationErrors
];

/**
 * Validate parent removal
 */
const validateRemoveParent = [
  param('parentId')
    .isMongoId()
    .withMessage('Invalid parent ID format'),
  
  body('reason')
    .optional()
    .isLength({ min: 1, max: 500 })
    .withMessage('Reason must be between 1 and 500 characters'),
  
  handleValidationErrors
];

module.exports = {
  validateInviteParent,
  validateGetParents,
  validateParentId,
  validateLinkParentToStudents,
  validateUnlinkParentFromStudents,
  validateRemoveParent,
  handleValidationErrors
};