/**
 * Admin Dashboard Routes
 * Routes for admin dashboard analytics and user management
 */

const express = require('express');
const router = express.Router();
const adminDashboardController = require('../controllers/adminDashboardController');
const {
  validateDashboardQuery,
  validateUserManagementQuery,
  validateUserStatusToggle,
  validateUserRemoval,
  sanitizeAdminData
} = require('../middleware/adminDashboardValidation');
const rateLimiter = require('../middleware/rateLimiter');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// Apply authentication to all routes
router.use(authenticateToken);
router.use(requireRole(['admin']));

/**
 * @route   GET /api/admin/dashboard/analytics
 * @desc    Get dashboard analytics and school statistics (Admin only)
 * @access  Private (Admin)
 * @query   {schoolId?}
 */
router.get('/analytics',
  rateLimiter.generalLimiter,
  validateDashboardQuery,
  adminDashboardController.getDashboardAnalytics
);

/**
 * @route   GET /api/admin/dashboard/users
 * @desc    Get user management data with filtering and pagination (Admin only)
 * @access  Private (Admin)
 * @query   {schoolId?, role?, status?, page?, limit?, search?}
 */
router.get('/users',
  rateLimiter.generalLimiter,
  validateUserManagementQuery,
  adminDashboardController.getUserManagement
);

/**
 * @route   POST /api/admin/dashboard/users/toggle-status
 * @desc    Activate or deactivate user accounts (Admin only)
 * @access  Private (Admin)
 * @body    {userId, action, reason?, schoolId?}
 */
router.post('/users/toggle-status',
  rateLimiter.authLimiter,
  sanitizeAdminData,
  validateUserStatusToggle,
  adminDashboardController.toggleUserStatus
);

/**
 * @route   DELETE /api/admin/dashboard/users/remove
 * @desc    Permanently remove user account (Admin only - use with caution)
 * @access  Private (Admin)
 * @body    {userId, reason?, schoolId?}
 */
router.delete('/users/remove',
  rateLimiter.authLimiter,
  sanitizeAdminData,
  validateUserRemoval,
  adminDashboardController.removeUser
);

module.exports = router;