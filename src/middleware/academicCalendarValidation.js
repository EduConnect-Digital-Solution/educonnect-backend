/**
 * Academic Calendar Validation Middleware
 * Validates academic year and term management requests
 */

const { body, param, validationResult } = require('express-validator');

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
 * Validate academic year creation
 */
const validateAcademicYearCreation = [
  body('years')
    .isArray({ min: 1 })
    .withMessage('Years must be a non-empty array'),
  
  body('years.*.year')
    .notEmpty()
    .withMessage('Year identifier is required')
    .matches(/^\d{4}-\d{4}$/)
    .withMessage('Year must be in format YYYY-YYYY (e.g., 2023-2024)'),
  
  body('years.*.name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Year name must be between 1 and 100 characters'),
  
  body('years.*.startDate')
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  
  body('years.*.endDate')
    .isISO8601()
    .withMessage('End date must be a valid date'),
  
  body('years.*.isCurrent')
    .optional()
    .isBoolean()
    .withMessage('isCurrent must be a boolean'),
  
  // Custom validation to ensure unique years within the request
  body('years').custom((years) => {
    const yearIdentifiers = years.map(y => y.year).filter(Boolean);
    const uniqueYears = new Set(yearIdentifiers);
    
    if (yearIdentifiers.length !== uniqueYears.size) {
      throw new Error('Year identifiers must be unique within the request');
    }
    
    return true;
  }),
  
  // Custom validation to ensure startDate < endDate for each year
  body('years').custom((years) => {
    for (const year of years) {
      if (year.startDate && year.endDate) {
        const startDate = new Date(year.startDate);
        const endDate = new Date(year.endDate);
        
        if (startDate >= endDate) {
          throw new Error(`Start date must be before end date for year ${year.year}`);
        }
      }
    }
    return true;
  }),
  
  handleValidationErrors
];

/**
 * Validate academic term creation
 */
const validateAcademicTermCreation = [
  body('terms')
    .isArray({ min: 1 })
    .withMessage('Terms must be a non-empty array'),
  
  body('terms.*.academicYearId')
    .notEmpty()
    .withMessage('Academic year ID is required')
    .isUUID()
    .withMessage('Academic year ID must be a valid UUID'),
  
  body('terms.*.term')
    .notEmpty()
    .withMessage('Term is required')
    .isIn(['First_Term', 'Second_Term', 'Third_Term'])
    .withMessage('Term must be First_Term, Second_Term, or Third_Term'),
  
  body('terms.*.name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Term name must be between 1 and 100 characters'),
  
  body('terms.*.startDate')
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  
  body('terms.*.endDate')
    .isISO8601()
    .withMessage('End date must be a valid date'),
  
  body('terms.*.isCurrent')
    .optional()
    .isBoolean()
    .withMessage('isCurrent must be a boolean'),
  
  // Custom validation to ensure unique terms within academic year
  body('terms').custom((terms) => {
    const termKeys = terms.map(t => `${t.academicYearId}-${t.term}`).filter(Boolean);
    const uniqueTerms = new Set(termKeys);
    
    if (termKeys.length !== uniqueTerms.size) {
      throw new Error('Terms must be unique within each academic year');
    }
    
    return true;
  }),
  
  // Custom validation to ensure startDate < endDate for each term
  body('terms').custom((terms) => {
    for (const term of terms) {
      if (term.startDate && term.endDate) {
        const startDate = new Date(term.startDate);
        const endDate = new Date(term.endDate);
        
        if (startDate >= endDate) {
          throw new Error(`Start date must be before end date for term ${term.term}`);
        }
      }
    }
    return true;
  }),
  
  handleValidationErrors
];

/**
 * Validate UUID parameter
 */
const validateUUID = (paramName) => [
  param(paramName)
    .isUUID()
    .withMessage(`Invalid ${paramName} format`),
  
  handleValidationErrors
];

/**
 * Validate academic year ID parameter
 */
const validateAcademicYearId = validateUUID('yearId');

/**
 * Validate academic term ID parameter
 */
const validateAcademicTermId = validateUUID('termId');

/**
 * Validate academic year ID query parameter
 */
const validateAcademicYearQuery = [
  body('academicYearId')
    .optional()
    .isUUID()
    .withMessage('Academic year ID must be a valid UUID'),
  
  handleValidationErrors
];

module.exports = {
  validateAcademicYearCreation,
  validateAcademicTermCreation,
  validateAcademicYearId,
  validateAcademicTermId,
  validateAcademicYearQuery,
  handleValidationErrors
};
