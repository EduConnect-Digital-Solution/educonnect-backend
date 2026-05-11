/**
 * Academic Structure Validation Middleware
 * Validates subjects, arms, and their relationships
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

// =============== SUBJECT VALIDATIONS ===============

/**
 * Validate subject creation
 */
const validateSubjectCreation = [
  body('subjects')
    .isArray({ min: 1 })
    .withMessage('Subjects must be a non-empty array'),
  
  body('subjects.*.name')
    .notEmpty()
    .withMessage('Subject name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Subject name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-]+$/)
    .withMessage('Subject name can only contain letters, numbers, spaces, and hyphens'),
  
  body('subjects.*.code')
    .notEmpty()
    .withMessage('Subject code is required')
    .isLength({ min: 1, max: 10 })
    .withMessage('Subject code must be between 1 and 10 characters')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Subject code must contain only uppercase letters and numbers'),
  
  body('subjects.*.category')
    .optional()
    .isIn(['core', 'elective', 'optional', 'religious'])
    .withMessage('Category must be core, elective, optional, or religious'),
  
  body('subjects.*.description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  
  // Custom validation to ensure unique names and codes within request
  body('subjects').custom((subjects) => {
    const names = subjects.map(s => s.name).filter(Boolean);
    const codes = subjects.map(s => s.code).filter(Boolean);
    const uniqueNames = new Set(names);
    const uniqueCodes = new Set(codes);
    
    if (names.length !== uniqueNames.size) {
      throw new Error('Subject names must be unique within request');
    }
    
    if (codes.length !== uniqueCodes.size) {
      throw new Error('Subject codes must be unique within request');
    }
    
    return true;
  }),
  
  handleValidationErrors
];

/**
 * Validate subject update
 */
const validateSubjectUpdate = [
  param('subjectId')
    .isUUID()
    .withMessage('Invalid subject ID format'),
  
  body('name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Subject name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-]+$/)
    .withMessage('Subject name can only contain letters, numbers, spaces, and hyphens'),
  
  body('category')
    .optional()
    .isIn(['core', 'elective', 'optional', 'religious'])
    .withMessage('Category must be core, elective, optional, or religious'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  
  handleValidationErrors
];

/**
 * Validate subject deletion
 */
const validateSubjectDeletion = [
  body('subjectIds')
    .notEmpty()
    .withMessage('Subject IDs are required')
    .custom((value) => {
      // Accept both string and array
      if (typeof value === 'string' || Array.isArray(value)) {
        return true;
      }
      throw new Error('Subject IDs must be a string or array');
    }),
  
  handleValidationErrors
];

// =============== ARM VALIDATIONS ===============

/**
 * Validate arm creation
 */
const validateArmCreation = [
  body('arms')
    .isArray({ min: 1 })
    .withMessage('Arms must be a non-empty array'),
  
  body('arms.*.classId')
    .notEmpty()
    .withMessage('Class ID is required')
    .isUUID()
    .withMessage('Invalid class ID format'),
  
  body('arms.*.name')
    .notEmpty()
    .withMessage('Arm name is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('Arm name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z0-9\s\-]+$/)
    .withMessage('Arm name can only contain letters, numbers, spaces, and hyphens'),
  
  body('arms.*.classTeacherId')
    .optional()
    .isUUID()
    .withMessage('Invalid class teacher ID format'),
  
  // Custom validation to ensure unique arm names within same class
  body('arms').custom((arms) => {
    const armGroups = {};
    arms.forEach(arm => {
      if (!armGroups[arm.classId]) {
        armGroups[arm.classId] = [];
      }
      armGroups[arm.classId].push(arm.name);
    });
    
    for (const classId in armGroups) {
      const names = armGroups[classId];
      const uniqueNames = new Set(names);
      if (names.length !== uniqueNames.size) {
        throw new Error(`Arm names must be unique within class ${classId}`);
      }
    }
    
    return true;
  }),
  
  handleValidationErrors
];

/**
 * Validate arm update
 */
const validateArmUpdate = [
  param('armId')
    .isUUID()
    .withMessage('Invalid arm ID format'),
  
  body('name')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Arm name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z0-9\s\-]+$/)
    .withMessage('Arm name can only contain letters, numbers, spaces, and hyphens'),
  
  body('classTeacherId')
    .optional()
    .isUUID()
    .withMessage('Invalid class teacher ID format'),
  
  handleValidationErrors
];

/**
 * Validate arm deletion
 */
const validateArmDeletion = [
  body('armIds')
    .notEmpty()
    .withMessage('Arm IDs are required')
    .custom((value) => {
      // Accept both string and array
      if (typeof value === 'string' || Array.isArray(value)) {
        return true;
      }
      throw new Error('Arm IDs must be a string or array');
    }),
  
  handleValidationErrors
];

// =============== ARM-SUBJECT VALIDATIONS ===============

/**
 * Validate adding subjects to arm
 */
const validateArmSubjectAddition = [
  param('armId')
    .isUUID()
    .withMessage('Invalid arm ID format'),
  
  body('subjectIds')
    .notEmpty()
    .withMessage('Subject IDs are required')
    .custom((value) => {
      // Accept both string and array
      if (typeof value === 'string' || Array.isArray(value)) {
        return true;
      }
      throw new Error('Subject IDs must be a string or array');
    }),
  
  handleValidationErrors
];

// =============== CLASS-SUBJECT VALIDATIONS ===============

/**
 * Validate adding subjects to class
 */
const validateClassSubjectAddition = [
  param('classId')
    .isUUID()
    .withMessage('Invalid class ID format'),
  
  body('subjectIds')
    .isArray({ min: 1 })
    .withMessage('Subject IDs must be a non-empty array'),
  
  body('subjectIds.*')
    .isUUID()
    .withMessage('Each subject ID must be a valid UUID'),
  
  handleValidationErrors
];

/**
 * Validate arm subject replacement
 */
const validateArmSubjectReplacement = [
  param('armId')
    .isUUID()
    .withMessage('Invalid arm ID format'),
  
  body('subjectIds')
    .isArray({ min: 0 })
    .withMessage('Subject IDs must be an array'),
  
  body('subjectIds.*')
    .isUUID()
    .withMessage('Each subject ID must be a valid UUID'),
  
  handleValidationErrors
];

/**
 * Validate arm subject copying
 */
const validateArmSubjectCopy = [
  param('sourceArmId')
    .isUUID()
    .withMessage('Invalid source arm ID format'),
  
  param('targetArmId')
    .isUUID()
    .withMessage('Invalid target arm ID format'),
  
  handleValidationErrors
];

// =============== COMMON VALIDATIONS ===============

/**
 * Validate UUID parameter
 */
const validateUUID = (paramName) => [
  param(paramName)
    .isUUID()
    .withMessage(`Invalid ${paramName} format`)
];

module.exports = {
  // Subject validations
  validateSubjectCreation,
  validateSubjectUpdate,
  validateSubjectDeletion,
  
  // Arm validations
  validateArmCreation,
  validateArmUpdate,
  validateArmDeletion,
  
  // Arm-Subject validations
  validateArmSubjectAddition,
  validateClassSubjectAddition,
  validateArmSubjectReplacement,
  validateArmSubjectCopy,
  
  // Common validations
  validateUUID,
  handleValidationErrors
};
