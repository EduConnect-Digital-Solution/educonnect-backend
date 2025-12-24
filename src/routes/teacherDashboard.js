/**
 * Teacher Dashboard Routes
 * Handles all teacher dashboard related endpoints including grades
 */

const express = require('express');
const router = express.Router();

// Import controllers and middleware
const teacherDashboardController = require('../controllers/teacherDashboardController');
const gradeController = require('../controllers/gradeController');
const { validateTeacherQuery } = require('../middleware/dashboardValidation');
const {
  validateGradeAssignment,
  validatePublishGrades,
  validateClassName,
  validateSubject,
  validateGradeId,
  validateStudentQuery,
  validateStatisticsQuery,
  sanitizeGradeData,
  validateTeacherAccess
} = require('../middleware/gradeValidation');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// Apply authentication to all routes
router.use(authenticateToken);

// Apply teacher role requirement to all routes
router.use(requireRole(['teacher']));

// ============================================================================
// EXISTING TEACHER DASHBOARD ROUTES
// ============================================================================

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

// ============================================================================
// GRADES MANAGEMENT ROUTES
// ============================================================================

/**
 * @route   GET /api/teacher/classes
 * @desc    Get teacher's classes for grade management
 * @access  Teacher
 */
router.get('/classes', gradeController.getTeacherClasses);

/**
 * @route   GET /api/teacher/classes/:className/subjects
 * @desc    Get subjects teacher teaches in a specific class
 * @access  Teacher
 */
router.get('/classes/:className/subjects',
  validateClassName,
  validateTeacherAccess,
  gradeController.getSubjectsByClass
);

/**
 * @route   GET /api/teacher/classes/:className/subjects/:subject/students
 * @desc    Get students in a class for a specific subject with grade information
 * @access  Teacher
 */
router.get('/classes/:className/subjects/:subject/students',
  validateClassName,
  validateSubject,
  validateStudentQuery,
  validateTeacherAccess,
  gradeController.getStudentsByClassAndSubject
);

/**
 * @route   POST /api/teacher/grades
 * @desc    Assign or update grade for a student
 * @access  Teacher
 */
router.post('/grades',
  sanitizeGradeData,
  validateGradeAssignment,
  gradeController.assignGrade
);

/**
 * @route   GET /api/teacher/grades/:gradeId
 * @desc    Get detailed information about a specific grade
 * @access  Teacher
 */
router.get('/grades/:gradeId',
  validateGradeId,
  gradeController.getGradeDetails
);

/**
 * @route   PUT /api/teacher/grades/:gradeId
 * @desc    Update an existing grade
 * @access  Teacher
 */
router.put('/grades/:gradeId',
  validateGradeId,
  sanitizeGradeData,
  validateGradeAssignment,
  gradeController.updateGrade
);

/**
 * @route   DELETE /api/teacher/grades/:gradeId
 * @desc    Delete a grade record
 * @access  Teacher
 */
router.delete('/grades/:gradeId',
  validateGradeId,
  gradeController.deleteGrade
);

/**
 * @route   POST /api/teacher/grades/publish
 * @desc    Publish grades for a class and subject
 * @access  Teacher
 */
router.post('/grades/publish',
  sanitizeGradeData,
  validatePublishGrades,
  gradeController.publishGrades
);

/**
 * @route   GET /api/teacher/classes/:className/subjects/:subject/statistics
 * @desc    Get grade statistics for a class and subject
 * @access  Teacher
 */
router.get('/classes/:className/subjects/:subject/statistics',
  validateClassName,
  validateSubject,
  validateStatisticsQuery,
  validateTeacherAccess,
  gradeController.getClassStatistics
);

module.exports = router;