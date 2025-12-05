/**
 * Parent Dashboard Controller
 * Handles parent-specific dashboard data and functionality
 */

const ParentDashboardService = require('../services/parentDashboardService');
const catchAsync = require('../utils/catchAsync');
const { validationResult } = require('express-validator');

/**
 * Get Parent Dashboard Data
 * Provides parent-specific dashboard information
 */
const getParentDashboard = catchAsync(async (req, res) => {
  const { userId, schoolId } = req.user;

  const data = await ParentDashboardService.getParentDashboard(userId, schoolId);

  res.status(200).json({
    success: true,
    message: 'Parent dashboard data retrieved successfully',
    data
  });
});

/**
 * Get Parent's Children Details
 * Retrieves detailed information about parent's children
 */
const getMyChildren = catchAsync(async (req, res) => {
  const { userId, schoolId } = req.user;
  const { childId } = req.params;

  const data = await ParentDashboardService.getMyChildren(userId, schoolId, childId);

  res.status(200).json({
    success: true,
    message: childId ? 'Child details retrieved successfully' : 'Children retrieved successfully',
    data
  });
});

/**
 * Get Parent Profile
 * Retrieves parent's profile information
 */
const getParentProfile = catchAsync(async (req, res) => {
  const { userId, schoolId } = req.user;

  const data = await ParentDashboardService.getParentProfile(userId, schoolId);

  res.status(200).json({
    success: true,
    message: 'Parent profile retrieved successfully',
    data
  });
});

/**
 * Update Parent Profile
 * Allows parents to update their profile information
 */
const updateParentProfile = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { userId } = req.user;
  
  const data = await ParentDashboardService.updateParentProfile(userId, req.body);

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data
  });
});

module.exports = {
  getParentDashboard,
  getMyChildren,
  getParentProfile,
  updateParentProfile
};