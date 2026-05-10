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
 * @route   GET /api/admin/classes
 * @desc    Get all classes for the school
 * @access  Admin
 */
router.get('/', 
  classManagementController.getSchoolClasses
);

/**
 * @route   POST /api/admin/classes/bulk
 * @desc    Bulk create classes
 * @access  Admin
 */
router.post('/bulk',
  validateBulkClassCreation,
  classManagementController.bulkCreateClasses
);

/**
 * @route   GET /api/admin/classes/:id
 * @desc    Get class details by ID
 * @access  Admin
 */
router.get('/:id',
  validateClassId,
  classManagementController.getClassById
);

/**
 * @route   DELETE /api/admin/classes/:id
 * @desc    Delete a class by ID
 * @access  Admin
 */
router.delete('/:id',
  validateClassId,
  classManagementController.deleteClass
);

module.exports = router;
