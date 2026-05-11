/**
 * Student Assignment Routes
 * Handles student class assignment and unassignment operations
 */

const express = require('express');
const router = express.Router();

// Import controllers and middleware
const studentAssignmentController = require('../controllers/studentClassAssignmentController');
const {
  validateBulkStudentAssignment,
  validateBulkStudentUnassignment,
  validatePagination,
  validateClassIdQuery
} = require('../middleware/studentAssignmentValidation');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// Apply authentication to all routes
router.use(authenticateToken);

// Apply admin role requirement to all assignment routes
router.use(requireRole(['admin']));

/**
 * @route   POST /api/admin/students/assign
 * @desc    Bulk assign students to classes and arms
 * @access  Admin
 */
router.post('/assign',
  validateBulkStudentAssignment,
  studentAssignmentController.bulkAssignStudents
);

/**
 * @route   POST /api/admin/students/unassign
 * @desc    Bulk unassign students from classes
 * @access  Admin
 */
router.post('/unassign',
  validateBulkStudentUnassignment,
  studentAssignmentController.bulkUnassignStudents
);

/**
 * @route   GET /api/admin/classes/population
 * @desc    Get class population statistics
 * @access  Admin
 */
router.get('/classes/population',
  validateClassIdQuery,
  studentAssignmentController.getClassPopulation
);

/**
 * @route   GET /api/admin/students/unassigned
 * @desc    Get unassigned students
 * @access  Admin
 */
router.get('/students/unassigned',
  validatePagination,
  studentAssignmentController.getUnassignedStudents
);

module.exports = router;
