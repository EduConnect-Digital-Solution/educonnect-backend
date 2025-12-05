/**
 * School Profile Management Routes
 * Routes for school profile viewing and updating
 */

const express = require('express');
const router = express.Router();
const schoolProfileController = require('../controllers/schoolProfileController');
const {
  validateSchoolProfileQuery,
  validateSchoolProfileUpdate,
  validateAdminProfileUpdate,
  validateSchoolStatusChange,
  sanitizeSchoolProfileData
} = require('../middleware/schoolProfileValidation');
const rateLimiter = require('../middleware/rateLimiter');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// Apply authentication to all routes
router.use(authenticateToken);
router.use(requireRole(['admin']));

/**
 * @route   GET /api/school/profile
 * @desc    Get school profile information (Admin only)
 * @access  Private (Admin)
 * @query   {schoolId?}
 */
router.get('/',
  rateLimiter.generalLimiter,
  validateSchoolProfileQuery,
  schoolProfileController.getSchoolProfile
);

/**
 * @route   PUT /api/school/profile
 * @desc    Update school profile information (Admin only)
 * @access  Private (Admin)
 * @body    {schoolId?, schoolName?, phone?, address?, website?, description?}
 */
router.put('/',
  rateLimiter.authLimiter,
  sanitizeSchoolProfileData,
  validateSchoolProfileUpdate,
  schoolProfileController.updateSchoolProfile
);

/**
 * @route   PUT /api/school/profile/admin
 * @desc    Update admin profile information (Admin only)
 * @access  Private (Admin)
 * @body    {schoolId?, firstName?, lastName?, phone?}
 */
router.put('/admin',
  rateLimiter.authLimiter,
  sanitizeSchoolProfileData,
  validateAdminProfileUpdate,
  schoolProfileController.updateAdminProfile
);

/**
 * @route   POST /api/school/profile/status
 * @desc    Change school status - activate/deactivate (System Admin only)
 * @access  Private (System Admin)
 * @body    {schoolId, isActive, reason?}
 */
router.post('/status',
  rateLimiter.authLimiter,
  sanitizeSchoolProfileData,
  validateSchoolStatusChange,
  schoolProfileController.changeSchoolStatus
);

module.exports = router;