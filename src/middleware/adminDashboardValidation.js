/**
 * Admin Dashboard Validation Middleware
 * Validation rules for admin dashboard and user management
 */

const { body, query } = require('express-validator');

/**
 * Validation for dashboard analytics query parameters
 */
const validateDashboardQuery = [
  query('schoolId')
    .optional()
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('Invalid school ID format')
];

/**
 * Validation for user management query parameters
 */
const validateUserManagementQuery = [
  query('schoolId')
    .optional()
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('Invalid school ID format'),

  query('role')
    .optional()
    .isIn(['all', 'admin', 'teacher', 'parent'])
    .withMessage('Role must be one of: all, admin, teacher, parent'),

  query('status')
    .optional()
    .isIn(['all', 'active', 'inactive', 'pending'])
    .withMessage('Status must be one of: all, active, inactive, pending'),

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
 * Validation for user status toggle
 */
const validateUserStatusToggle = [
  body('userId')
    .isMongoId()
    .withMessage('Invalid user ID format'),

  body('action')
    .isIn(['activate', 'deactivate'])
    .withMessage('Action must be either "activate" or "deactivate"'),

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
 * Validation for user removal
 */
const validateUserRemoval = [
  body('userId')
    .isMongoId()
    .withMessage('Invalid user ID format'),

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
 * Sanitization middleware for admin dashboard data
 */
const sanitizeAdminData = (req, res, next) => {
  if (req.body.reason) {
    req.body.reason = req.body.reason.trim();
  }
  if (req.query.search) {
    req.query.search = req.query.search.trim();
  }
  next();
};

module.exports = {
  validateDashboardQuery,
  validateUserManagementQuery,
  validateUserStatusToggle,
  validateUserRemoval,
  sanitizeAdminData
};