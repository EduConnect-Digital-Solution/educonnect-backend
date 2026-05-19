const { query, body, validationResult } = require('express-validator');

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

const validateCompositeKey = [
  query('classId')
    .isUUID()
    .withMessage('classId must be a valid UUID'),
  query('termId')
    .isUUID()
    .withMessage('termId must be a valid UUID'),
  query('armId')
    .optional()
    .isUUID()
    .withMessage('armId must be a valid UUID'),
  handleValidationErrors
];

const validateDraftSave = [
  body('classId')
    .isUUID()
    .withMessage('classId must be a valid UUID'),
  body('termId')
    .isUUID()
    .withMessage('termId must be a valid UUID'),
  body('armId')
    .optional({ values: 'null' })
    .isUUID()
    .withMessage('armId must be a valid UUID'),
  body('academicYearId')
    .optional()
    .isUUID()
    .withMessage('academicYearId must be a valid UUID'),
  body('periods')
    .isArray()
    .withMessage('periods must be an array'),
  body('schedules')
    .isArray()
    .withMessage('schedules must be an array'),
  handleValidationErrors
];

const validateConflictCheck = [
  body('classId')
    .isUUID()
    .withMessage('classId must be a valid UUID'),
  body('termId')
    .isUUID()
    .withMessage('termId must be a valid UUID'),
  body('armId')
    .optional({ values: 'null' })
    .isUUID()
    .withMessage('armId must be a valid UUID'),
  body('schedules')
    .isArray()
    .withMessage('schedules must be an array'),
  handleValidationErrors
];

const validatePublish = [
  body('classId')
    .isUUID()
    .withMessage('classId must be a valid UUID'),
  body('termId')
    .isUUID()
    .withMessage('termId must be a valid UUID'),
  body('academicYearId')
    .optional()
    .isUUID()
    .withMessage('academicYearId must be a valid UUID'),
  body('armId')
    .optional({ values: 'null' })
    .isUUID()
    .withMessage('armId must be a valid UUID'),
  body('periods')
    .isArray()
    .withMessage('periods must be an array'),
  body('schedules')
    .isArray()
    .withMessage('schedules must be an array'),
  handleValidationErrors
];

module.exports = {
  validateCompositeKey,
  validateDraftSave,
  validateConflictCheck,
  validatePublish,
  handleValidationErrors
};
