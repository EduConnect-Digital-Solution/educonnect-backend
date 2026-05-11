/**
 * Class Management Routes
 * Admin routes for managing school classes
 */

const express = require('express');
const router = express.Router();

// Import controllers and middleware
const classManagementController = require('../controllers/classManagementController');
const { 
  validateBulkClassCreation, 
  validateClassId 
} = require('../middleware/classValidation');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// Apply authentication to all routes
router.use(authenticateToken);

// Apply admin role requirement to all routes (only admins can manage classes)
router.use(requireRole(['admin']));

/**
 * @route   GET /api/academic/classes
 * @desc    Get all classes for the school
 * @access  Admin
 */
router.get('/', 
  classManagementController.getSchoolClasses
);

/**
 * @route   POST /api/academic/classes
 * @desc    Create classes for the school
 * @access  Admin
 */
router.post('/',
  validateBulkClassCreation,
  classManagementController.bulkCreateClasses
);

/**
 * @route   GET /api/academic/classes/:classId
 * @desc    Get class by ID
 * @access  Admin
 */
router.get('/:classId',
  validateClassId,
  classManagementController.getClassById
);

/**
 * @route   DELETE /api/academic/classes/:classId
 * @desc    Delete class by ID
 * @access  Admin
 */
router.delete('/:classId',
  validateClassId,
  classManagementController.deleteClass
);

module.exports = router;
