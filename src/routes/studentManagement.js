/**
 * Student Management Routes
 * Routes for student record creation, updates, and management
 */

const express = require('express');
const router = express.Router();
const studentManagementController = require('../controllers/studentManagementController');
const {
  validateStudentCreation,
  validateStudentUpdate,
  validateStudentQuery,
  validateStudentStatusToggle,
  validateStudentRemoval,
  validateStudentDetailsQuery,
  sanitizeStudentData
} = require('../middleware/studentManagementValidation');
const rateLimiter = require('../middleware/rateLimiter');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route   POST /api/students
 * @desc    Create a new student record (Admin only)
 * @access  Private (Admin)
 * @body    {schoolId?, firstName, lastName, email?, class?, section?, rollNumber?, grade?, dateOfBirth?, gender?, address?, phone?, parentIds?, teacherIds?}
 */
router.post('/',
  requireRole(['admin']),
  rateLimiter.authLimiter,
  sanitizeStudentData,
  validateStudentCreation,
  studentManagementController.createStudent
);

/**
 * @route   GET /api/students
 * @desc    Get students list with filtering and pagination (Admin/Teacher only)
 * @access  Private (Admin/Teacher)
 * @query   {schoolId?, class?, section?, status?, page?, limit?, search?}
 */
router.get('/',
  requireRole(['admin', 'teacher']),
  rateLimiter.generalLimiter,
  validateStudentQuery,
  studentManagementController.getStudents
);

/**
 * @route   GET /api/students/:studentId
 * @desc    Get detailed information about a specific student (Admin/Teacher/Parent only)
 * @access  Private (Admin/Teacher/Parent)
 * @params  {studentId}
 * @query   {schoolId?}
 */
router.get('/:studentId',
  requireRole(['admin', 'teacher', 'parent']),
  rateLimiter.generalLimiter,
  validateStudentDetailsQuery,
  studentManagementController.getStudentDetails
);

/**
 * @route   PUT /api/students/:studentId
 * @desc    Update student information (Admin only)
 * @access  Private (Admin)
 * @params  {studentId}
 * @body    {schoolId?, firstName?, lastName?, email?, class?, section?, rollNumber?, grade?, dateOfBirth?, gender?, address?, phone?}
 */
router.put('/:studentId',
  requireRole(['admin']),
  rateLimiter.authLimiter,
  sanitizeStudentData,
  validateStudentUpdate,
  studentManagementController.updateStudent
);

/**
 * @route   POST /api/students/toggle-status
 * @desc    Activate/deactivate or enroll/unenroll students (Admin only)
 * @access  Private (Admin)
 * @body    {studentId, action, reason?, schoolId?}
 */
router.post('/toggle-status',
  requireRole(['admin']),
  rateLimiter.authLimiter,
  sanitizeStudentData,
  validateStudentStatusToggle,
  studentManagementController.toggleStudentStatus
);

/**
 * @route   DELETE /api/students/remove
 * @desc    Permanently remove student record (Admin only - use with caution)
 * @access  Private (Admin)
 * @body    {studentId, reason?, schoolId?}
 */
router.delete('/remove',
  requireRole(['admin']),
  rateLimiter.authLimiter,
  sanitizeStudentData,
  validateStudentRemoval,
  studentManagementController.removeStudent
);

module.exports = router;