const { body, param, validationResult } = require('express-validator');

const handleErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
};

const validateCreateScale = [
  body('name')
    .trim()
    .notEmpty().withMessage('name is required')
    .isLength({ max: 100 }).withMessage('name must be at most 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('description must be at most 500 characters'),
  body('bands')
    .optional()
    .isArray().withMessage('bands must be an array'),
  body('bands.*.label')
    .if(body('bands').isArray())
    .trim()
    .notEmpty().withMessage('each band requires a label')
    .isLength({ max: 50 }).withMessage('band label must be at most 50 characters'),
  body('bands.*.minPercent')
    .if(body('bands').isArray())
    .isFloat({ min: 0, max: 100 }).withMessage('minPercent must be between 0 and 100'),
  body('bands.*.maxPercent')
    .if(body('bands').isArray())
    .isFloat({ min: 0, max: 100 }).withMessage('maxPercent must be between 0 and 100'),
  body('bands.*.gradePoints')
    .if(body('bands').isArray())
    .optional({ values: 'null' })
    .isFloat({ min: 0 }).withMessage('gradePoints must be a positive number'),
  body('bands.*.sortOrder')
    .if(body('bands').isArray())
    .optional({ values: 'null' })
    .isInt({ min: 0 }).withMessage('sortOrder must be a non-negative integer'),
  handleErrors
];

const validateUpdateScale = [
  param('id').isUUID().withMessage('Invalid scale ID'),
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('name cannot be empty')
    .isLength({ max: 100 }).withMessage('name must be at most 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('description must be at most 500 characters'),
  handleErrors
];

const validateScaleId = [
  param('id').isUUID().withMessage('Invalid scale ID'),
  handleErrors
];

const validateAddBand = [
  param('id').isUUID().withMessage('Invalid scale ID'),
  body('label')
    .trim()
    .notEmpty().withMessage('label is required')
    .isLength({ max: 50 }).withMessage('label must be at most 50 characters'),
  body('minPercent')
    .isFloat({ min: 0, max: 100 }).withMessage('minPercent must be between 0 and 100'),
  body('maxPercent')
    .isFloat({ min: 0, max: 100 }).withMessage('maxPercent must be between 0 and 100'),
  body('gradePoints')
    .optional({ values: 'null' })
    .isFloat({ min: 0 }).withMessage('gradePoints must be a positive number'),
  body('sortOrder')
    .optional({ values: 'null' })
    .isInt({ min: 0 }).withMessage('sortOrder must be a non-negative integer'),
  handleErrors
];

const validateUpdateBand = [
  param('id').isUUID().withMessage('Invalid scale ID'),
  param('bandId').isUUID().withMessage('Invalid band ID'),
  body('label')
    .optional()
    .trim()
    .notEmpty().withMessage('label cannot be empty')
    .isLength({ max: 50 }).withMessage('label must be at most 50 characters'),
  body('minPercent')
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage('minPercent must be between 0 and 100'),
  body('maxPercent')
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage('maxPercent must be between 0 and 100'),
  body('gradePoints')
    .optional({ values: 'null' })
    .isFloat({ min: 0 }).withMessage('gradePoints must be a positive number'),
  body('sortOrder')
    .optional({ values: 'null' })
    .isInt({ min: 0 }).withMessage('sortOrder must be a non-negative integer'),
  handleErrors
];

module.exports = {
  validateCreateScale,
  validateUpdateScale,
  validateScaleId,
  validateAddBand,
  validateUpdateBand
};
