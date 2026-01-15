/**
 * Admin Dashboard Controller
 * Handles admin dashboard analytics and school management
 * Requirements: 7.1, 7.2, 7.3
 */

const DashboardService = require('../services/dashboardService');
const InvitationService = require('../services/invitationService');
const catchAsync = require('../utils/catchAsync');
const { validationResult } = require('express-validator');

/**
 * Debug Invitation Status
 * Get raw invitation data for debugging
 * Requirements: Debug functionality
 */
const debugInvitationStatus = catchAsync(async (req, res) => {
  const { schoolId } = req.query;
  
  // Get or determine school ID
  const targetSchoolId = await DashboardService.getSchoolId(schoolId);
  
  // Get raw invitation data
  const invitations = await InvitationService.listInvitations(
    { schoolId: targetSchoolId },
    { page: 1, limit: 100 }
  );

  // Get raw database stats
  const Invitation = require('../models/Invitation');
  const rawStats = await Invitation.aggregate([
    { $match: { schoolId: targetSchoolId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    message: 'Debug invitation status retrieved',
    data: {
      schoolId: targetSchoolId,
      rawStats,
      invitations: invitations.invitations,
      summary: invitations.summary,
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * Force Refresh Dashboard Analytics
 * Forces a fresh fetch of dashboard data bypassing all caches
 * Requirements: Debug/Admin functionality
 */
const forceRefreshDashboard = catchAsync(async (req, res) => {
  const { schoolId } = req.query;
  
  // Get or determine school ID
  const targetSchoolId = await DashboardService.getSchoolId(schoolId);
  
  // Force refresh dashboard data
  const data = await DashboardService.refreshDashboardCache(targetSchoolId);

  res.status(200).json({
    success: true,
    message: 'Dashboard analytics force refreshed successfully',
    data,
    refreshedAt: new Date().toISOString()
  });
});

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

/**
 * List Invitations
 * Get all invitations with filtering and pagination for admin dashboard
 * Requirements: 8.1
 */
const listInvitations = catchAsync(async (req, res) => {
  const { schoolId, status, role, page = 1, limit = 10 } = req.query;
  
  // Get or determine school ID
  const targetSchoolId = await DashboardService.getSchoolId(schoolId);
  
  // Get invitations from service
  const data = await InvitationService.listInvitations(
    { schoolId: targetSchoolId, status, role },
    { page, limit }
  );

  res.status(200).json({
    success: true,
    message: 'Invitations retrieved successfully',
    data
  });
});

/**
 * Cancel Invitation
 * Cancel a pending invitation from admin dashboard
 * Requirements: 8.5
 */
const cancelInvitation = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  try {
    const { invitationId } = req.params;
    const { reason, schoolId } = req.body;
    
    // Get or determine school ID
    const targetSchoolId = await DashboardService.getSchoolId(schoolId);
    
    // Get admin user ID from token (should be available from auth middleware)
    const adminUserId = req.user.userId;
    
    // Cancel invitation using service
    const result = await InvitationService.cancelInvitation(invitationId, targetSchoolId, adminUserId, reason);

    res.status(200).json({
      success: true,
      message: 'Invitation cancelled successfully',
      data: result
    });
  } catch (error) {
    // Handle specific business logic errors
    if (error.message === 'Invitation not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Cannot cancel invitation - user has already completed registration' ||
        error.message === 'Invitation is already cancelled') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'No admin user found for this school') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Re-throw for global error handler
    throw error;
  }
});

/**
 * Resend Invitation
 * Resend a pending invitation from admin dashboard
 * Requirements: 8.2
 */
const resendInvitation = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  try {
    const { invitationId } = req.params;
    const { schoolId } = req.body;
    
    // Get or determine school ID
    const targetSchoolId = await DashboardService.getSchoolId(schoolId);
    
    // Resend invitation using service
    const result = await InvitationService.resendInvitation(invitationId, targetSchoolId);

    res.status(200).json({
      success: true,
      message: 'Invitation resent successfully',
      data: result
    });
  } catch (error) {
    // Handle specific business logic errors
    if (error.message === 'Invitation not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Cannot resend invitation - user has already completed registration' ||
        error.message === 'Cannot resend cancelled invitation' ||
        error.message === 'Can only resend pending invitations' ||
        error.message === 'Cannot resend expired invitation. Please create a new invitation.') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Re-throw for global error handler
    throw error;
  }
});

module.exports = {
  getDashboardAnalytics,
  forceRefreshDashboard,
  debugInvitationStatus,
  getUserManagement,
  toggleUserStatus,
  removeUser,
  listInvitations,
  cancelInvitation,
  resendInvitation
};