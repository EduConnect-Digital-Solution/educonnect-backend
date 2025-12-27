/**
 * Teacher Assignment Routes
 * Dedicated routes for linking/unlinking teachers with students
 */

const express = require('express');
const router = express.Router();
const teacherAssignmentController = require('../controllers/teacherAssignmentController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const rateLimiter = require('../middleware/rateLimiter');
const {
  validateTeacherAssignment,
  validateBulkTeacherAssignment,
  validateTeacherUnassignment
} = require('../middleware/teacherAssignmentValidation');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route   POST /api/admin/assign-teacher
 * @desc    Assign a teacher to one or more students
 * @access  Private (Admin only)
 * @body    {teacherId, studentIds[], schoolId?}
 */
router.post('/assign-teacher',
  requireRole(['admin']),
  rateLimiter.adminLimiter,
  validateTeacherAssignment,
  teacherAssignmentController.assignTeacher
);

/**
 * @route   POST /api/admin/assign-teachers-bulk
 * @desc    Assign multiple teachers to multiple students (bulk operation)
 * @access  Private (Admin only)
 * @body    {assignments: [{teacherId, studentIds[]}], schoolId?}
 */
router.post('/assign-teachers-bulk',
  requireRole(['admin']),
  rateLimiter.adminLimiter,
  validateBulkTeacherAssignment,
  teacherAssignmentController.assignTeachersBulk
);

/**
 * @route   DELETE /api/admin/unassign-teacher
 * @desc    Remove a teacher from one or more students
 * @access  Private (Admin only)
 * @body    {teacherId, studentIds[], schoolId?}
 */
router.delete('/unassign-teacher',
  requireRole(['admin']),
  rateLimiter.adminLimiter,
  validateTeacherUnassignment,
  teacherAssignmentController.unassignTeacher
);

/**
 * @route   POST /api/students/:studentId/teachers/:teacherId
 * @desc    Assign a specific teacher to a specific student
 * @access  Private (Admin only)
 * @params  {studentId, teacherId}
 * @query   {schoolId?}
 */
router.post('/students/:studentId/teachers/:teacherId',
  requireRole(['admin']),
  rateLimiter.adminLimiter,
  teacherAssignmentController.assignTeacherToStudent
);

/**
 * @route   DELETE /api/students/:studentId/teachers/:teacherId
 * @desc    Remove a specific teacher from a specific student
 * @access  Private (Admin only)
 * @params  {studentId, teacherId}
 * @query   {schoolId?}
 */
router.delete('/students/:studentId/teachers/:teacherId',
  requireRole(['admin']),
  rateLimiter.adminLimiter,
  teacherAssignmentController.unassignTeacherFromStudent
);

/**
 * @route   GET /api/teachers/:teacherId/students
 * @desc    Get all students assigned to a specific teacher
 * @access  Private (Admin/Teacher)
 * @params  {teacherId}
 * @query   {schoolId?, page?, limit?}
 */
router.get('/teachers/:teacherId/students',
  requireRole(['admin', 'teacher']),
  rateLimiter.generalLimiter,
  teacherAssignmentController.getTeacherStudents
);

/**
 * @route   GET /api/students/:studentId/teachers
 * @desc    Get all teachers assigned to a specific student
 * @access  Private (Admin/Teacher/Parent)
 * @params  {studentId}
 * @query   {schoolId?}
 */
router.get('/students/:studentId/teachers',
  requireRole(['admin', 'teacher', 'parent']),
  rateLimiter.generalLimiter,
  teacherAssignmentController.getStudentTeachers
);

module.exports = router;