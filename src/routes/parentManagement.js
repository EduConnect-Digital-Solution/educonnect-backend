/**
 * Parent Management Routes
 * Handles all parent management related endpoints
 */

const express = require('express');
const router = express.Router();

// Import controllers and middleware
const parentManagementController = require('../controllers/parentManagementController');
const {
  validateInviteParent,
  validateGetParents,
  validateParentId,
  validateLinkParentToStudents,
  validateUnlinkParentFromStudents,
  validateRemoveParent
} = require('../middleware/parentManagementValidation');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route   POST /api/parent-management/invite-parent
 * @desc    Invite a parent and link to students
 * @access  Admin
 */
router.post('/invite-parent',
  requireRole(['admin']),
  validateInviteParent,
  parentManagementController.inviteParent
);

/**
 * @route   GET /api/parent-management/parents
 * @desc    Get all parents with pagination and filtering
 * @access  Admin, Teacher
 */
router.get('/parents', 
  requireRole(['admin', 'teacher']),
  validateGetParents,
  parentManagementController.getParents
);

/**
 * @route   GET /api/parent-management/parents/:parentId
 * @desc    Get detailed information about a specific parent
 * @access  Admin, Teacher
 */
router.get('/parents/:parentId',
  requireRole(['admin', 'teacher']),
  validateParentId,
  parentManagementController.getParentDetails
);

/**
 * @route   POST /api/parent-management/parents/:parentId/link-students
 * @desc    Link parent to students
 * @access  Admin
 */
router.post('/parents/:parentId/link-students',
  requireRole(['admin']),
  validateLinkParentToStudents,
  parentManagementController.linkParentToStudents
);

/**
 * @route   POST /api/parent-management/parents/:parentId/unlink-students
 * @desc    Unlink parent from students
 * @access  Admin
 */
router.post('/parents/:parentId/unlink-students',
  requireRole(['admin']),
  validateUnlinkParentFromStudents,
  parentManagementController.unlinkParentFromStudents
);

/**
 * @route   DELETE /api/parent-management/parents/:parentId
 * @desc    Remove parent from system
 * @access  Admin
 */
router.delete('/parents/:parentId',
  requireRole(['admin']),
  validateRemoveParent,
  parentManagementController.removeParent
);

module.exports = router;