const { query, body, param } = require('express-validator');
const config = require('../config');

const SUPPORTED_LOCALES = config.locales.map(l => l.code);

const parseBooleanQuery = (value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

const validateNotificationQuery = [
  query('unread')
    .optional()
    .customSanitizer(parseBooleanQuery)
    .isBoolean().withMessage('unread must be a boolean'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('page must be at least 1')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50')
    .toInt()
];

const validateNotificationId = [
  param('id')
    .isUUID().withMessage('Invalid notification ID')
];

const validateTimetableQuery = [
  query('week')
    .optional()
    .matches(/^\d{4}-W\d{2}$/).withMessage('week must be in ISO format: YYYY-Www (e.g., 2025-W28)'),
  query('termId')
    .optional()
    .isUUID().withMessage('Invalid term ID')
];

const validateAcademicsQuery = [
  query('termId')
    .optional()
    .isUUID().withMessage('Invalid term ID'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('page must be at least 1')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50')
    .toInt()
];

const validateAssignmentsQuery = [
  query('status')
    .optional()
    .isIn(['pending', 'submitted', 'graded', 'overdue']).withMessage('status must be one of: pending, submitted, graded, overdue'),
  query('subjectId')
    .optional()
    .isUUID().withMessage('Invalid subject ID'),
  query('termId')
    .optional()
    .isUUID().withMessage('Invalid term ID'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('page must be at least 1')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50')
    .toInt()
];

const validateAssignmentId = [
  param('assignmentId')
    .isUUID().withMessage('Invalid assignment ID')
];

const validateAssignmentSubmit = [
  body('textResponse')
    .optional()
    .isString().withMessage('textResponse must be a string')
    .trim()
    .isLength({ max: 10000 }).withMessage('textResponse must be less than 10000 characters'),
  (req, res, next) => {
    if (!req.body.textResponse && (!req.files || req.files.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'At least one of textResponse or files must be provided'
      });
    }
    next();
  }
];

const validateTeachersQuery = [
  query('search')
    .optional()
    .isString().withMessage('search must be a string')
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('search must be between 1 and 100 characters'),
  query('subjectId')
    .optional()
    .isUUID().withMessage('Invalid subject ID'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('page must be at least 1')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50')
    .toInt()
];

const validateActivityQuery = [
  query('type')
    .optional()
    .isIn(['submission', 'grade_received', 'login', 'profile_update', 'fee_payment'])
    .withMessage('Invalid activity type'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('page must be at least 1')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50')
    .toInt()
];

const validateProfileUpdate = [
  body('phone')
    .optional()
    .trim()
    .custom((value) => {
      if (!value) return true;
      const nigerianPattern = /^(\+234|0)[789][01][0-9]{8}$/;
      const cleaned = value.replace(/[\s\-().]/g, '');
      if (!nigerianPattern.test(cleaned)) {
        throw new Error('Invalid Nigerian phone number format');
      }
      return true;
    }),
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Address must be less than 500 characters')
];

const validateSettingsUpdate = [
  body('notifications')
    .optional()
    .isObject().withMessage('notifications must be an object'),
  body('notifications.assignmentReminders')
    .optional()
    .isBoolean().withMessage('assignmentReminders must be a boolean'),
  body('notifications.gradePublished')
    .optional()
    .isBoolean().withMessage('gradePublished must be a boolean'),
  body('notifications.feeReminders')
    .optional()
    .isBoolean().withMessage('feeReminders must be a boolean'),
  body('notifications.schoolAnnouncements')
    .optional()
    .isBoolean().withMessage('schoolAnnouncements must be a boolean'),
  body('notifications.smsEnabled')
    .optional()
    .isBoolean().withMessage('smsEnabled must be a boolean'),
  body('notifications.emailEnabled')
    .optional()
    .isBoolean().withMessage('emailEnabled must be a boolean'),
  body('preferences')
    .optional()
    .isObject().withMessage('preferences must be an object'),
  body('preferences.language')
    .optional()
    .isIn(SUPPORTED_LOCALES).withMessage(`language must be one of: ${SUPPORTED_LOCALES.join(', ')}`),
  body('preferences.timezone')
    .optional()
    .matches(/^[A-Za-z]+\/[A-Za-z_]+$/).withMessage('Invalid IANA timezone format'),
  body('preferences.darkMode')
    .optional()
    .isBoolean().withMessage('darkMode must be a boolean'),
  body('preferences.compactView')
    .optional()
    .isBoolean().withMessage('compactView must be a boolean')
];

const validatePasswordChange = [
  body('currentPassword')
    .notEmpty().withMessage('currentPassword is required')
    .isString().withMessage('currentPassword must be a string'),
  body('newPassword')
    .notEmpty().withMessage('newPassword is required')
    .isString().withMessage('newPassword must be a string')
    .isLength({ min: 8 }).withMessage('newPassword must be at least 8 characters')
    .custom((value) => {
      if (!/[A-Z]/.test(value)) {
        throw new Error('newPassword must contain at least one uppercase letter');
      }
      if (!/[0-9]/.test(value)) {
        throw new Error('newPassword must contain at least one number');
      }
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)) {
        throw new Error('newPassword must contain at least one special character');
      }
      return true;
    }),
  body('confirmPassword')
    .notEmpty().withMessage('confirmPassword is required')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('confirmPassword must match newPassword');
      }
      return true;
    })
];

const validatePaginationDefaults = (req, res, next) => {
  req.query.page = parseInt(req.query.page) || 1;
  req.query.limit = Math.min(parseInt(req.query.limit) || 20, 50);
  next();
};

module.exports = {
  validateNotificationQuery,
  validateNotificationId,
  validateTimetableQuery,
  validateAcademicsQuery,
  validateAssignmentsQuery,
  validateAssignmentId,
  validateAssignmentSubmit,
  validateTeachersQuery,
  validateActivityQuery,
  validateProfileUpdate,
  validateSettingsUpdate,
  validatePasswordChange,
  validatePaginationDefaults
};
