/**
 * Teacher Dashboard Routes
 * Handles all teacher dashboard related endpoints
 */

const express = require('express');
const router = express.Router();

// Import controllers and middleware
const teacherDashboardController = require('../controllers/teacherDashboardController');
const { validateTeacherQuery } = require('../middleware/dashboardValidation');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// Apply authentication to all routes
router.use(authenticateToken);

// Apply teacher role requirement to all routes
router.use(requireRole(['teacher']));

/**
 * @route   GET /api/teacher/dashboard
 * @desc    Get teacher dashboard data
 * @access  Teacher
 */
router.get('/dashboard', teacherDashboardController.getTeacherDashboard);

/**
 * @route   GET /api/teacher/students
 * @desc    Get teacher's students
 * @access  Teacher
 */
router.get('/students', 
  validateTeacherQuery,
  teacherDashboardController.getMyStudents
);

/**
 * @route   GET /api/teacher/profile
 * @desc    Get teacher profile information
 * @access  Teacher
 */
router.get('/profile', teacherDashboardController.getTeacherProfile);

module.exports = router;