/**
 * Student Management Validation Middleware
 * Validation rules for student management operations
 */

const { body, query, param } = require('express-validator');

/**
 * Validation for student creation
 */
const validateStudentCreation = [
  body('schoolId')
    .optional()
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('Invalid school ID format'),

  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('First name contains invalid characters'),

  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('Last name contains invalid characters'),

  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  body('class')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Class cannot exceed 20 characters'),

  body('section')
    .optional()
    .trim()
    .isLength({ max: 10 })
    .withMessage('Section cannot exceed 10 characters'),

  body('rollNumber')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Roll number cannot exceed 20 characters'),

  body('grade')
    .optional()
    .trim()
    .isLength({ max: 10 })
    .withMessage('Grade cannot exceed 10 characters'),

  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date of birth'),

  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),

  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address cannot exceed 500 characters'),

  body('phone')
    .optional()
    .isMobilePhone('any', { strictMode: false })
    .withMessage('Please provide a valid phone number'),

  body('parentIds')
    .optional()
    .isArray()
    .withMessage('Parent IDs must be an array'),

  body('parentIds.*')
    .optional()
    .isMongoId()
    .withMessage('Each parent ID must be a valid MongoDB ObjectId'),

  body('teacherIds')
    .optional()
    .isArray()
    .withMessage('Teacher IDs must be an array'),

  body('teacherIds.*')
    .optional()
    .isMongoId()
    .withMessage('Each teacher ID must be a valid MongoDB ObjectId')
];

/**
 * Validation for student update
 */
const validateStudentUpdate = [
  param('studentId')
    .isMongoId()
    .withMessage('Invalid student ID format'),

  body('schoolId')
    .optional()
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('Invalid school ID format'),

  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('First name contains invalid characters'),

  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('Last name contains invalid characters'),

  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  body('class')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Class cannot exceed 20 characters'),

  body('section')
    .optional()
    .trim()
    .isLength({ max: 10 })
    .withMessage('Section cannot exceed 10 characters'),

  body('rollNumber')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Roll number cannot exceed 20 characters'),

  body('grade')
    .optional()
    .trim()
    .isLength({ max: 10 })
    .withMessage('Grade cannot exceed 10 characters'),

  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date of birth'),

  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),

  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address cannot exceed 500 characters'),

  body('phone')
    .optional()
    .isMobilePhone('any', { strictMode: false })
    .withMessage('Please provide a valid phone number')
];

/**
 * Validation for student list query
 */
const validateStudentQuery = [
  query('schoolId')
    .optional()
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('Invalid school ID format'),

  query('class')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Class filter cannot exceed 20 characters'),

  query('section')
    .optional()
    .trim()
    .isLength({ max: 10 })
    .withMessage('Section filter cannot exceed 10 characters'),

  query('status')
    .optional()
    .isIn(['all', 'active', 'inactive', 'unenrolled'])
    .withMessage('Status must be one of: all, active, inactive, unenrolled'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term cannot exceed 100 characters')
];

/**
 * Validation for student status toggle
 */
const validateStudentStatusToggle = [
  body('studentId')
    .isMongoId()
    .withMessage('Invalid student ID format'),

  body('action')
    .isIn(['activate', 'deactivate', 'enroll', 'unenroll'])
    .withMessage('Action must be one of: activate, deactivate, enroll, unenroll'),

  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters'),

  body('schoolId')
    .optional()
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('Invalid school ID format')
];

/**
 * Validation for student removal
 */
const validateStudentRemoval = [
  body('studentId')
    .isMongoId()
    .withMessage('Invalid student ID format'),

  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters'),

  body('schoolId')
    .optional()
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('Invalid school ID format')
];

/**
 * Validation for student details query
 */
const validateStudentDetailsQuery = [
  param('studentId')
    .isMongoId()
    .withMessage('Invalid student ID format'),

  query('schoolId')
    .optional()
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('Invalid school ID format')
];

/**
 * Sanitization middleware for student data
 */
const sanitizeStudentData = (req, res, next) => {
  if (req.body.firstName) {
    req.body.firstName = req.body.firstName.trim();
  }
  if (req.body.lastName) {
    req.body.lastName = req.body.lastName.trim();
  }
  if (req.body.class) {
    req.body.class = req.body.class.trim();
  }
  if (req.body.section) {
    req.body.section = req.body.section.trim();
  }
  if (req.body.rollNumber) {
    req.body.rollNumber = req.body.rollNumber.trim();
  }
  if (req.body.grade) {
    req.body.grade = req.body.grade.trim();
  }
  if (req.body.address) {
    req.body.address = req.body.address.trim();
  }
  if (req.body.phone) {
    req.body.phone = req.body.phone.trim();
  }
  if (req.body.reason) {
    req.body.reason = req.body.reason.trim();
  }
  if (req.query.search) {
    req.query.search = req.query.search.trim();
  }
  next();
};

module.exports = {
  validateStudentCreation,
  validateStudentUpdate,
  validateStudentQuery,
  validateStudentStatusToggle,
  validateStudentRemoval,
  validateStudentDetailsQuery,
  sanitizeStudentData
};