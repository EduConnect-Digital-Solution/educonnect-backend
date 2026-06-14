const { query, body, param, validationResult } = require('express-validator');

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

const validateDateParam = [
  param('date')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Date must be in YYYY-MM-DD format'),
  handleValidationErrors
];

const validateScheduleDate = [
  query('date')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Date must be in YYYY-MM-DD format'),
  query('armId')
    .optional()
    .isUUID()
    .withMessage('armId must be a valid UUID'),
  handleValidationErrors
];

const validateScheduleId = [
  param('scheduleId')
    .isString()
    .notEmpty()
    .withMessage('scheduleId is required'),
  handleValidationErrors
];

const validateSessionStudents = [
  param('scheduleId')
    .isString()
    .notEmpty()
    .withMessage('scheduleId is required'),
  query('armId')
    .optional()
    .isUUID()
    .withMessage('armId must be a valid UUID'),
  handleValidationErrors
];

const validateDraftBody = [
  body('date')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('date must be in YYYY-MM-DD format'),
  body('classId')
    .optional()
    .isUUID()
    .withMessage('classId must be a valid UUID'),
  body('armId')
    .optional()
    .isUUID()
    .withMessage('armId must be a valid UUID'),
  body('attendances')
    .isArray()
    .withMessage('attendances must be an array'),
  body('attendances.*.studentId')
    .isString()
    .notEmpty()
    .withMessage('each attendance must have a studentId'),
  handleValidationErrors
];

const validateSubmitBody = [
  body('date')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('date must be in YYYY-MM-DD format'),
  body('classId')
    .optional()
    .isUUID()
    .withMessage('classId must be a valid UUID'),
  body('armId')
    .optional()
    .isUUID()
    .withMessage('armId must be a valid UUID'),
  body('attendances')
    .isArray()
    .withMessage('attendances must be an array'),
  body('attendances.*.studentId')
    .isString()
    .notEmpty()
    .withMessage('each attendance must have a studentId'),
  handleValidationErrors
];

const validateUpdateBody = [
  param('attendanceId')
    .isString()
    .notEmpty()
    .withMessage('attendanceId is required'),
  body('armId')
    .optional()
    .isUUID()
    .withMessage('armId must be a valid UUID'),
  body('attendances')
    .isArray()
    .withMessage('attendances must be an array'),
  body('attendances.*.studentId')
    .isString()
    .notEmpty()
    .withMessage('each attendance must have a studentId'),
  handleValidationErrors
];

const validateHistoryQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100'),
  query('classId')
    .optional()
    .isUUID()
    .withMessage('classId must be a valid UUID'),
  query('armId')
    .optional()
    .isUUID()
    .withMessage('armId must be a valid UUID'),
  query('subjectId')
    .optional()
    .isUUID()
    .withMessage('subjectId must be a valid UUID'),
  query('startDate')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('startDate must be in YYYY-MM-DD format'),
  query('endDate')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('endDate must be in YYYY-MM-DD format'),
  query('status')
    .optional()
    .isIn(['submitted', 'draft', 'all'])
    .withMessage('status must be one of: submitted, draft, all'),
  handleValidationErrors
];

module.exports = {
  validateScheduleDate,
  validateDateParam,
  validateScheduleId,
  validateSessionStudents,
  validateDraftBody,
  validateSubmitBody,
  validateUpdateBody,
  validateHistoryQuery
};
