const { body, param, query, validationResult } = require('express-validator');

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

const validateGetEvents = [
  query('termId')
    .optional()
    .isUUID()
    .withMessage('termId must be a valid UUID'),
  handleValidationErrors
];

const validateCreateEvent = [
  body('termId')
    .isUUID()
    .withMessage('termId must be a valid UUID'),
  body('name')
    .isString()
    .notEmpty()
    .withMessage('name is required'),
  body('date')
    .isISO8601()
    .withMessage('date must be a valid ISO8601 datetime'),
  body('endDate')
    .optional({ values: 'null' })
    .isISO8601()
    .withMessage('endDate must be a valid ISO8601 datetime'),
  body('type')
    .isIn(['holiday', 'exam', 'event'])
    .withMessage('type must be one of: holiday, exam, event'),
  body('notifications.enabled')
    .optional()
    .isBoolean()
    .withMessage('notifications.enabled must be a boolean'),
  body('notifications.targets.roles')
    .optional()
    .isArray()
    .withMessage('notifications.targets.roles must be an array'),
  body('notifications.targets.classIds')
    .optional()
    .isArray()
    .withMessage('notifications.targets.classIds must be an array'),
  body('notifications.targets.userIds')
    .optional()
    .isArray()
    .withMessage('notifications.targets.userIds must be an array'),
  body('notifications.channels')
    .optional()
    .isArray()
    .withMessage('notifications.channels must be an array'),
  body('notifications.schedule.type')
    .optional()
    .isIn(['immediate', 'scheduled'])
    .withMessage('notifications.schedule.type must be immediate or scheduled'),
  body('notifications.schedule.sendAt')
    .optional({ values: 'null' })
    .isISO8601()
    .withMessage('notifications.schedule.sendAt must be a valid ISO8601 date'),
  handleValidationErrors
];

const validateUpdateEvent = [
  param('eventId')
    .isUUID()
    .withMessage('eventId must be a valid UUID'),
  body('name')
    .optional()
    .isString()
    .notEmpty()
    .withMessage('name must be a non-empty string'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('date must be a valid ISO8601 datetime'),
  body('endDate')
    .optional({ values: 'null' })
    .isISO8601()
    .withMessage('endDate must be a valid ISO8601 datetime'),
  body('type')
    .optional()
    .isIn(['holiday', 'exam', 'event'])
    .withMessage('type must be one of: holiday, exam, event'),
  body('notifications')
    .optional()
    .isObject()
    .withMessage('notifications must be an object'),
  handleValidationErrors
];

const validateEventId = [
  param('eventId')
    .isUUID()
    .withMessage('eventId must be a valid UUID'),
  handleValidationErrors
];

const validateUpdateNotifications = [
  param('eventId')
    .isUUID()
    .withMessage('eventId must be a valid UUID'),
  body('targets.roles')
    .optional()
    .isArray()
    .withMessage('targets.roles must be an array'),
  body('targets.classIds')
    .optional()
    .isArray()
    .withMessage('targets.classIds must be an array'),
  body('targets.userIds')
    .optional()
    .isArray()
    .withMessage('targets.userIds must be an array'),
  body('channels')
    .optional()
    .isArray()
    .withMessage('channels must be an array'),
  body('schedule.type')
    .optional()
    .isIn(['immediate', 'scheduled'])
    .withMessage('schedule.type must be immediate or scheduled'),
  body('schedule.sendAt')
    .optional({ values: 'null' })
    .isISO8601()
    .withMessage('schedule.sendAt must be a valid ISO8601 date'),
  handleValidationErrors
];

const validateSendNotification = [
  param('eventId')
    .isUUID()
    .withMessage('eventId must be a valid UUID'),
  body('targets.roles')
    .optional()
    .isArray()
    .withMessage('targets.roles must be an array'),
  body('targets.classIds')
    .optional()
    .isArray()
    .withMessage('targets.classIds must be an array'),
  body('targets.userIds')
    .optional()
    .isArray()
    .withMessage('targets.userIds must be an array'),
  body('channels')
    .optional()
    .isArray()
    .withMessage('channels must be an array'),
  body('message')
    .optional()
    .isString()
    .withMessage('message must be a string'),
  handleValidationErrors
];

const validateGetLogs = [
  query('eventId')
    .isUUID()
    .withMessage('eventId must be a valid UUID'),
  query('status')
    .optional()
    .isIn(['sent', 'failed', 'pending'])
    .withMessage('status must be one of: sent, failed, pending'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateGetEvents,
  validateCreateEvent,
  validateUpdateEvent,
  validateEventId,
  validateUpdateNotifications,
  validateSendNotification,
  validateGetLogs
};
