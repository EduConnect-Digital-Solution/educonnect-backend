/**
 * Teacher Class Assignment Routes
 * Admin routes for managing teacher class and subject assignments
 */

const express = require('express');
const router = express.Router();

// Import controllers and middleware
const teacherClassAssignmentController = require('../controllers/teacherClassAssignmentController');
const {
  validateAssignClasses,
  validateAssignSubjects,
  validateRemoveClasses,
  validateTeacherId
} = require('../middleware/teacherClassAssignmentValidation');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// Apply authentication to all routes
router.use(authenticateToken);

// Apply admin role requirement to all routes (only admins can manage teacher assignments)
router.use(requireRole(['admin']));

/**
 * @route   POST /api/admin/teachers/assign-classes
 * @desc    Assign classes to a teacher
 * @access  Admin
 */
router.post('/assign-classes',
  validateAssignClasses,
  teacherClassAssignmentController.assignClassesToTeacher
);

/**
 * @route   POST /api/admin/teachers/assign-subjects
 * @desc    Assign subjects to a teacher
 * @access  Admin
 */
router.post('/assign-subjects',
  validateAssignSubjects,
  teacherClassAssignmentController.assignSubjectsToTeacher
);

/**
 * @route   DELETE /api/admin/teachers/remove-classes
 * @desc    Remove classes from a teacher
 * @access  Admin
 */
router.delete('/remove-classes',
  validateRemoveClasses,
  teacherClassAssignmentController.removeClassesFromTeacher
);

/**
 * @route   GET /api/admin/teachers/:teacherId/assignments
 * @desc    Get teacher's current class and subject assignments
 * @access  Admin
 */
router.get('/:teacherId/assignments',
  validateTeacherId,
  teacherClassAssignmentController.getTeacherAssignments
);

module.exports = router;