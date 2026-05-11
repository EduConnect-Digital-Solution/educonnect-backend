/**
 * Student Assignment Validation Middleware
 * Validates student class assignment requests
 */

const { body, query, validationResult } = require('express-validator');

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
 * Validate bulk student assignment
 */
const validateBulkStudentAssignment = [
  body('assignments')
    .isArray({ min: 1 })
    .withMessage('Assignments must be a non-empty array'),
  
  body('assignments.*.studentId')
    .notEmpty()
    .withMessage('Student ID is required')
    .isUUID()
    .withMessage('Student ID must be a valid UUID'),
  
  body('assignments.*.classId')
    .notEmpty()
    .withMessage('Class ID is required')
    .isUUID()
    .withMessage('Class ID must be a valid UUID'),
  
  body('assignments.*.armId')
    .notEmpty()
    .withMessage('Arm ID is required')
    .isUUID()
    .withMessage('Arm ID must be a valid UUID'),
  
  // Custom validation to ensure unique student assignments
  body('assignments').custom((assignments) => {
    const studentIds = assignments.map(a => a.studentId).filter(Boolean);
    const uniqueStudents = new Set(studentIds);
    
    if (studentIds.length !== uniqueStudents.size) {
      throw new Error('Each student can only be assigned once in a single request');
    }
    
    return true;
  }),
  
  handleValidationErrors
];

/**
 * Validate bulk student unassignment
 */
const validateBulkStudentUnassignment = [
  body('studentIds')
    .isArray({ min: 1 })
    .withMessage('Student IDs must be a non-empty array'),
  
  body('studentIds.*')
    .notEmpty()
    .withMessage('Student ID is required')
    .isUUID()
    .withMessage('Student ID must be a valid UUID'),
  
  handleValidationErrors
];

/**
 * Validate pagination parameters
 */
const validatePagination = [
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

/**
 * Validate class ID query parameter
 */
const validateClassIdQuery = [
  query('classId')
    .optional()
    .isUUID()
    .withMessage('Class ID must be a valid UUID'),
  
  handleValidationErrors
];

module.exports = {
  validateBulkStudentAssignment,
  validateBulkStudentUnassignment,
  validatePagination,
  validateClassIdQuery,
  handleValidationErrors
};
