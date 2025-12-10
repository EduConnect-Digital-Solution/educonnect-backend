/**
 * Admin Dashboard Controller
 * Handles admin dashboard analytics and school management
 * Requirements: 7.1, 7.2, 7.3
 */

const DashboardService = require('../services/dashboardService');
const catchAsync = require('../utils/catchAsync');
const { validationResult } = require('express-validator');

/**
 * Get Dashboard Analytics
 * Provides school-wide statistics and analytics for admin dashboard
 * Requirements: 7.1, 7.2, 7.3
 */
const getDashboardAnalytics = catchAsync(async (req, res) => {
  const { schoolId } = req.query;
  
  // Get or determine school ID
  const targetSchoolId = await DashboardService.getSchoolId(schoolId);
  
  // Get dashboard analytics from service
  const data = await DashboardService.getDashboardAnalytics(targetSchoolId);

  res.status(200).json({
    success: true,
    message: 'Dashboard analytics retrieved successfully',
    data
  });
});

/**
 * Get User Management Data
 * Provides user lists with management actions for admin
 * Requirements: 7.2, 7.3
 */
const getUserManagement = catchAsync(async (req, res) => {
  const { schoolId, role, status, page = 1, limit = 20, search } = req.query;
  
  // Get or determine school ID
  const targetSchoolId = await DashboardService.getSchoolId(schoolId);
  
  // Get user management data from service
  const data = await DashboardService.getUserManagement({
    schoolId: targetSchoolId,
    role,
    status,
    page,
    limit,
    search
  });

  res.status(200).json({
    success: true,
    message: 'User management data retrieved successfully',
    data
  });
});

/**
 * Toggle User Status
 * Activate or deactivate user accounts
 * Requirements: 7.3
 */
const toggleUserStatus = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { userId, action, reason, schoolId } = req.body;
  
  // Get or determine school ID
  const targetSchoolId = await DashboardService.getSchoolId(schoolId);
  
  // Toggle user status using service
  const data = await DashboardService.toggleUserStatus(userId, action, targetSchoolId, reason);

  res.status(200).json({
    success: true,
    message: `User ${action}d successfully`,
    data
  });
});

/**
 * Remove User
 * Permanently remove a user account (Admin only - use with caution)
 * Requirements: 7.3
 */
const removeUser = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { userId, reason, schoolId } = req.body;
  
  // Get or determine school ID
  const targetSchoolId = await DashboardService.getSchoolId(schoolId);
  
  // Remove user using service
  const data = await DashboardService.removeUser(userId, targetSchoolId, reason);

  res.status(200).json({
    success: true,
    message: 'User removed successfully',
    data
  });
});

module.exports = {
  getDashboardAnalytics,
  getUserManagement,
  toggleUserStatus,
  removeUser
};