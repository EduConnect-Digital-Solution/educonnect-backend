/**
 * Class Validation Middleware
 * Validates class management requests
 */

const { body, param, validationResult } = require('express-validator');
const { ValidationError } = require('./errorHandler');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages
    });
  }
  next();
};

/**
 * Validate bulk class creation
 */
const validateBulkClassCreation = [
  body('classes')
    .isArray({ min: 1 })
    .withMessage('Classes must be a non-empty array'),
  
  body('classes.*.level')
    .isInt({ min: 1, max: 100 })
    .withMessage('Level must be a number between 1 and 100'),
  
  body('classes.*.name')
    .notEmpty()
    .withMessage('Class name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Class name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-]+$/)
    .withMessage('Class name can only contain letters, numbers, spaces, and hyphens'),
  
  body('classes.*.description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  
  // Custom validation to ensure unique names within the request
  body('classes').custom((classes) => {
    const names = classes.map(cls => cls.name).filter(Boolean);
    const uniqueNames = new Set(names);
    
    if (names.length !== uniqueNames.size) {
      throw new Error('Class names must be unique within the request');
    }
    
    return true;
  }),
  
  handleValidationErrors
];

/**
 * Validate class ID parameter
 */
const validateClassId = [
  param('classId')
    .isUUID()
    .withMessage('Invalid class ID format'),
  
  handleValidationErrors
];

/**
 * Validate class update (if needed in future)
 */
const validateClassUpdate = [
  param('classId')
    .isUUID()
    .withMessage('Invalid class ID format'),
  
  body('baseLevel')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Base level must be between 1 and 50 characters')
    .matches(/^[a-zA-Z0-9\s\-]+$/)
    .withMessage('Base level can only contain letters, numbers, spaces, and hyphens'),
  
  body('name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Class name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-]+$/)
    .withMessage('Class name can only contain letters, numbers, spaces, and hyphens'),
  
  body('arm')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Class arm must be between 1 and 50 characters')
    .matches(/^[a-zA-Z0-9\s\-]+$/)
    .withMessage('Class arm can only contain letters, numbers, spaces, and hyphens'),
  
  body('level')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Level must be an integer greater than 1 and less than 100'),
  
  handleValidationErrors
];

module.exports = {
  validateBulkClassCreation,
  validateClassId,
  validateClassUpdate,
  handleValidationErrors
};
