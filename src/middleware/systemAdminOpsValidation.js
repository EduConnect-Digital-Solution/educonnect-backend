const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('./systemAdminValidation');
const { SCHOOL_CODE_PATTERN } = require('../utils/schoolIdentifiers');

/**
 * Request validation for the system admin school operations: create, switch
 * on/off, archive/restore/purge, remove people, import, invite and read.
 *
 * Destructive actions need a written reason, and the most destructive ones
 * (archive, purge) also need the school's name typed back.
 */

const SUBSCRIPTION_TIERS = ['basic', 'standard', 'premium', 'enterprise'];

const schoolParam = param('schoolId')
  .matches(SCHOOL_CODE_PATTERN)
  .withMessage('School ID must follow format: ABC1234 (3 letters + 4 digits)');

const reasonField = body('reason')
  .trim()
  .notEmpty()
  .withMessage('Reason is required')
  .isLength({ min: 10, max: 500 })
  .withMessage('Reason must be between 10 and 500 characters');

const confirmNameField = body('confirmSchoolName')
  .trim()
  .notEmpty()
  .withMessage('Type the school name to confirm')
  .isLength({ max: 200 })
  .withMessage('School name is too long');

const pagination = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  query('search').optional().trim().isLength({ max: 100 }).withMessage('search is too long')
];

const validateCreateSchool = [
  body('schoolName').trim().isLength({ min: 2, max: 100 }).withMessage('School name must be between 2 and 100 characters'),
  body('email').trim().isEmail().isLength({ max: 254 }).withMessage('A valid email address is required'),
  body('password')
    .optional()
    .isString()
    .isLength({ min: 10, max: 128 })
    .withMessage('Password must be between 10 and 128 characters. Leave it out to generate one.'),
  body('phone').optional().trim().isLength({ max: 20 }).withMessage('Phone number is too long'),
  body('address').optional().trim().isLength({ max: 500 }).withMessage('Address is too long'),
  body('website').optional().trim().isURL().withMessage('Website must be a valid URL'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description is too long'),
  body('principalName').optional().trim().isLength({ max: 100 }).withMessage('Principal name is too long'),
  body('schoolType').optional().trim().isLength({ min: 2, max: 50 }).withMessage('School type is invalid'),
  body('subscriptionTier').optional().isIn(SUBSCRIPTION_TIERS).withMessage(`Subscription tier must be one of: ${SUBSCRIPTION_TIERS.join(', ')}`),
  body('adminUserData').optional().isObject().withMessage('adminUserData must be an object'),
  body('adminUserData.firstName').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Admin first name is invalid'),
  body('adminUserData.lastName').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Admin last name is invalid'),
  handleValidationErrors
];

const validateSchoolOnly = [schoolParam, handleValidationErrors];

const validateStatusChange = [schoolParam, reasonField, handleValidationErrors];

const validateArchive = [schoolParam, reasonField, confirmNameField, handleValidationErrors];

const validateRestore = [schoolParam, reasonField, handleValidationErrors];

const validateDelete = [schoolParam, reasonField, confirmNameField, handleValidationErrors];

const validateListStudents = [
  schoolParam,
  ...pagination,
  query('status').optional().isIn(['active', 'inactive']).withMessage('status must be active or inactive'),
  query('classId').optional().isUUID().withMessage('classId must be a valid ID'),
  handleValidationErrors
];

const validateListStaff = [
  schoolParam,
  ...pagination,
  query('status')
    .optional()
    .isIn(['not_invited', 'invited', 'active', 'inactive'])
    .withMessage('status must be not_invited, invited, active or inactive'),
  query('role').optional().isIn(['teacher', 'admin']).withMessage('role must be teacher or admin'),
  handleValidationErrors
];

const validateRemoveUser = [
  schoolParam,
  param('userId').isUUID().withMessage('Invalid user ID'),
  reasonField,
  handleValidationErrors
];

const validateRemoveStudent = [
  schoolParam,
  param('studentId').isUUID().withMessage('Invalid student ID'),
  reasonField,
  handleValidationErrors
];

const validateImport = [
  schoolParam,
  query('dryRun').optional().isBoolean().withMessage('dryRun must be true or false'),
  handleValidationErrors
];

const validateInviteStaff = [
  schoolParam,
  body('userIds').optional().isArray({ max: 100 }).withMessage('userIds must be a list of at most 100 IDs'),
  body('userIds.*').isUUID().withMessage('Each user ID must be valid'),
  handleValidationErrors
];

const validateAuditQuery = [
  query('schoolId').optional().matches(SCHOOL_CODE_PATTERN).withMessage('School ID must follow format: ABC1234'),
  query('action').optional().trim().isLength({ max: 60 }).withMessage('action is too long'),
  query('actor').optional().trim().isLength({ max: 254 }).withMessage('actor is too long'),
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('limit must be between 1 and 200'),
  handleValidationErrors
];

module.exports = {
  validateCreateSchool,
  validateSchoolOnly,
  validateStatusChange,
  validateArchive,
  validateRestore,
  validateDelete,
  validateListStudents,
  validateListStaff,
  validateRemoveUser,
  validateRemoveStudent,
  validateImport,
  validateInviteStaff,
  validateAuditQuery
};
