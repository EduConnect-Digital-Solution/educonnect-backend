const { body, param, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
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

const validatePolicy = [
  body('name')
    .trim()
    .notEmpty().withMessage('Policy name is required')
    .isLength({ max: 100 }).withMessage('Policy name must be 100 characters or less'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description must be 500 characters or less'),
  body('caComponents')
    .isArray({ min: 1 }).withMessage('At least one CA component is required'),
  body('caComponents.*.name')
    .trim()
    .notEmpty().withMessage('Each component must have a name'),
  body('caComponents.*.maxScore')
    .isInt({ min: 1 }).withMessage('Each component maxScore must be at least 1'),
  body('caComponents.*.sortOrder')
    .optional()
    .isInt({ min: 0 }).withMessage('sortOrder must be a non-negative integer'),
  body('examMax')
    .isInt({ min: 1 }).withMessage('examMax must be at least 1'),
  body('caComponents').custom((components, { req }) => {
    const caMax = components.reduce((sum, c) => sum + c.maxScore, 0);
    const total = caMax + req.body.examMax;
    if (total !== 100) {
      throw new Error(`CA max (${caMax}) + exam max (${req.body.examMax}) must equal 100, got ${total}`);
    }
    return true;
  }),
  handleValidationErrors
];

const validatePolicyUpdate = [
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Policy name cannot be empty')
    .isLength({ max: 100 }).withMessage('Policy name must be 100 characters or less'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description must be 500 characters or less'),
  body('caComponents')
    .optional()
    .isArray({ min: 1 }).withMessage('At least one CA component is required'),
  body('caComponents.*.name')
    .if(body('caComponents').exists())
    .trim()
    .notEmpty().withMessage('Each component must have a name'),
  body('caComponents.*.maxScore')
    .if(body('caComponents').exists())
    .isInt({ min: 1 }).withMessage('Each component maxScore must be at least 1'),
  body('caComponents.*.sortOrder')
    .optional()
    .isInt({ min: 0 }).withMessage('sortOrder must be a non-negative integer'),
  body('examMax')
    .optional()
    .isInt({ min: 1 }).withMessage('examMax must be at least 1'),
  body('caComponents').custom((components, { req }) => {
    if (!components && !req.body.examMax) return true;
    const caMax = components ? components.reduce((sum, c) => sum + c.maxScore, 0) : undefined;
    const examMax = req.body.examMax;
    if (caMax !== undefined && examMax !== undefined) {
      if (caMax + examMax !== 100) {
        throw new Error(`CA max (${caMax}) + exam max (${examMax}) must equal 100, got ${caMax + examMax}`);
      }
    }
    return true;
  }),
  handleValidationErrors
];

const validateAssignment = [
  body('scope')
    .trim()
    .isIn(['school', 'class', 'arm', 'subject', 'subject_class'])
    .withMessage('Scope must be one of: school, class, arm, subject, subject_class'),
  body('scopeId')
    .if(body('scope').not().equals('school'))
    .notEmpty().withMessage('scopeId is required for non-school scopes'),
  body('scopeName')
    .if(body('scope').not().equals('school'))
    .notEmpty().withMessage('scopeName is required for non-school scopes'),
  body('secondaryScopeId')
    .if(body('scope').equals('subject_class'))
    .notEmpty().withMessage('secondaryScopeId is required for subject_class scope'),
  body('secondaryScopeName')
    .if(body('scope').equals('subject_class'))
    .notEmpty().withMessage('secondaryScopeName is required for subject_class scope'),
  body('scopeId')
    .if(body('scope').equals('school'))
    .isEmpty().withMessage('scopeId must be null for school scope'),
  handleValidationErrors
];

const validatePolicyId = [
  param('id').isUUID().withMessage('Invalid policy ID'),
  handleValidationErrors
];

const validateAssignmentDelete = [
  param('id').isUUID().withMessage('Invalid policy ID'),
  param('assignmentId').isUUID().withMessage('Invalid assignment ID'),
  handleValidationErrors
];

module.exports = {
  validatePolicy,
  validatePolicyUpdate,
  validateAssignment,
  validatePolicyId,
  validateAssignmentDelete
};
