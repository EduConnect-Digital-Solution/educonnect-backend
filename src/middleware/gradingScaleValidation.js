const { body } = require('express-validator');

const createScaleValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Scale name is required')
    .isLength({ max: 100 }).withMessage('Scale name must be 100 characters or less'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description must be 500 characters or less'),
  body('isDefault')
    .optional()
    .isBoolean().withMessage('isDefault must be a boolean'),
  body('bands')
    .optional()
    .isArray({ min: 1 }).withMessage('Bands must be a non-empty array'),
  body('bands.*.label')
    .if(body('bands').exists())
    .trim()
    .notEmpty().withMessage('Each band must have a label'),
  body('bands.*.minPercent')
    .if(body('bands').exists())
    .isFloat({ min: 0, max: 100 }).withMessage('minPercent must be between 0 and 100'),
  body('bands.*.maxPercent')
    .if(body('bands').exists())
    .isFloat({ min: 0, max: 100 }).withMessage('maxPercent must be between 0 and 100'),
  body('bands.*.gradePoints')
    .optional()
    .isFloat({ min: 0 }).withMessage('gradePoints must be a non-negative number'),
  body('bands.*.description')
    .optional()
    .trim()
];

const updateScaleValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Scale name cannot be empty')
    .isLength({ max: 100 }).withMessage('Scale name must be 100 characters or less'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description must be 500 characters or less'),
  body('isDefault')
    .optional()
    .isBoolean().withMessage('isDefault must be a boolean'),
  body('bands')
    .optional()
    .isArray({ min: 1 }).withMessage('Bands must be a non-empty array'),
  body('bands.*.label')
    .if(body('bands').exists())
    .trim()
    .notEmpty().withMessage('Each band must have a label'),
  body('bands.*.minPercent')
    .if(body('bands').exists())
    .isFloat({ min: 0, max: 100 }).withMessage('minPercent must be between 0 and 100'),
  body('bands.*.maxPercent')
    .if(body('bands').exists())
    .isFloat({ min: 0, max: 100 }).withMessage('maxPercent must be between 0 and 100'),
  body('bands.*.gradePoints')
    .optional()
    .isFloat({ min: 0 }).withMessage('gradePoints must be a non-negative number'),
  body('bands.*.description')
    .optional()
    .trim()
];

const addBandValidation = [
  body('label')
    .trim()
    .notEmpty().withMessage('Band label is required'),
  body('minPercent')
    .isFloat({ min: 0, max: 100 }).withMessage('minPercent must be between 0 and 100'),
  body('maxPercent')
    .isFloat({ min: 0, max: 100 }).withMessage('maxPercent must be between 0 and 100'),
  body('gradePoints')
    .optional()
    .isFloat({ min: 0 }).withMessage('gradePoints must be a non-negative number'),
  body('description')
    .optional()
    .trim()
];

const updateBandValidation = [
  body('label')
    .optional()
    .trim()
    .notEmpty().withMessage('Band label cannot be empty'),
  body('minPercent')
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage('minPercent must be between 0 and 100'),
  body('maxPercent')
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage('maxPercent must be between 0 and 100'),
  body('gradePoints')
    .optional()
    .isFloat({ min: 0 }).withMessage('gradePoints must be a non-negative number'),
  body('description')
    .optional()
    .trim()
];

module.exports = {
  createScaleValidation, updateScaleValidation,
  addBandValidation, updateBandValidation
};
