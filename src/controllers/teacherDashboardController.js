/**
 * Teacher Dashboard Controller
 * Handles teacher-specific dashboard data and functionality
 */

const TeacherService = require('../services/teacherService');
const catchAsync = require('../utils/catchAsync');
const { validationResult } = require('express-validator');

/**
 * Get Teacher Dashboard Data
 * Provides teacher-specific dashboard information
 */
const getTeacherDashboard = catchAsync(async (req, res) => {
  const { userId, schoolId } = req.user;

  const data = await TeacherService.getTeacherDashboard(userId, schoolId);

  res.status(200).json({
    success: true,
    message: 'Teacher dashboard data retrieved successfully',
    data
  });
});

/**
 * Get Teacher's Students
 * Retrieves detailed information about students assigned to the teacher
 */
const getMyStudents = catchAsync(async (req, res) => {
  const { userId, schoolId } = req.user;
  const { class: studentClass, page = 1, limit = 20 } = req.query;

  const data = await TeacherService.getMyStudents(userId, schoolId, {
    studentClass,
    page,
    limit
  });

  res.status(200).json({
    success: true,
    message: 'Teacher students retrieved successfully',
    data
  });
});

/**
 * Get Teacher Profile
 * Retrieves teacher's profile information
 */
const getTeacherProfile = catchAsync(async (req, res) => {
  const { userId, schoolId } = req.user;

  const data = await TeacherService.getTeacherProfile(userId, schoolId);

  res.status(200).json({
    success: true,
    message: 'Teacher profile retrieved successfully',
    data
  });
});

/**
 * Update Teacher Profile
 * Allows teachers to update their profile information
 */
const updateTeacherProfile = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { userId } = req.user;

  const data = await TeacherService.updateTeacherProfile(userId, req.body);

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data
  });
});

module.exports = {
  getTeacherDashboard,
  getMyStudents,
  getTeacherProfile,
  updateTeacherProfile
};