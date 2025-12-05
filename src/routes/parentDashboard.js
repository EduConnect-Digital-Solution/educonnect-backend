/**
 * Parent Dashboard Routes
 * Handles all parent dashboard related endpoints
 */

const express = require('express');
const router = express.Router();

// Import controllers and middleware
const parentDashboardController = require('../controllers/parentDashboardController');
const { 
  validateChildId, 
  validateParentProfileUpdate 
} = require('../middleware/dashboardValidation');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// Apply authentication to all routes
router.use(authenticateToken);

// Apply parent role requirement to all routes
router.use(requireRole(['parent']));

/**
 * @route   GET /api/parent/dashboard
 * @desc    Get parent dashboard data
 * @access  Parent
 */
router.get('/dashboard', parentDashboardController.getParentDashboard);

/**
 * @route   GET /api/parent/children
 * @desc    Get all parent's children
 * @access  Parent
 */
router.get('/children', parentDashboardController.getMyChildren);

/**
 * @route   GET /api/parent/children/:childId
 * @desc    Get specific child details
 * @access  Parent
 */
router.get('/children/:childId',
  validateChildId,
  parentDashboardController.getMyChildren
);

/**
 * @route   GET /api/parent/profile
 * @desc    Get parent profile information
 * @access  Parent
 */
router.get('/profile', parentDashboardController.getParentProfile);

/**
 * @route   PUT /api/parent/profile
 * @desc    Update parent profile information
 * @access  Parent
 */
router.put('/profile',
  validateParentProfileUpdate,
  parentDashboardController.updateParentProfile
);

module.exports = router;