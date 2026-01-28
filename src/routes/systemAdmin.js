/**
 * System Admin Routes
 * Main routes for system administration functionality
 * Handles platform management, school management, and cross-school operations
 */

const express = require('express');
const router = express.Router();

// Import controllers
const {
  getPlatformOverview,
  getSystemHealth,
  getPlatformKPIs,
  getCrossSchoolMetrics,
  getSchoolManagement,
  createSchool,
  updateSchoolConfig,
  deactivateSchool,
  reactivateSchool,
  getUserManagement,
  manageUserAccess,
  getSecurityAlerts
} = require('../controllers/systemAdminController');

// Import middleware
const {
  requireSystemAdmin,
  validateCrossSchoolAccess,
  auditSystemOperation,
  completeAuditLog
} = require('../middleware/systemAdminAuth');
const {
  validateSystemAdminPermission,
  createSystemAdminValidationChain
} = require('../middleware/systemAdminValidation');
const { createCustomLimiter } = require('../middleware/rateLimiter');

// Apply system admin authentication to all routes
router.use(requireSystemAdmin);
router.use(validateCrossSchoolAccess);
router.use(completeAuditLog);

// ============================================================================
// PLATFORM OVERVIEW ENDPOINTS
// ============================================================================

/**
 * @route   GET /api/system-admin/platform/overview
 * @desc    Get comprehensive platform overview
 * @access  System Admin Only
 * @permission view_analytics
 */
router.get('/platform/overview',
  createCustomLimiter({ windowMs: 1 * 60 * 1000, max: 30 }), // 30 requests per minute
  validateSystemAdminPermission('view_analytics'),
  auditSystemOperation('platform_overview_access'),
  getPlatformOverview
);

/**
 * @route   GET /api/system-admin/system/health
 * @desc    Get detailed system health metrics
 * @access  System Admin Only
 * @permission view_analytics
 */
router.get('/system/health',
  createCustomLimiter({ windowMs: 1 * 60 * 1000, max: 60 }), // 60 requests per minute
  validateSystemAdminPermission('view_analytics'),
  auditSystemOperation('system_health_access'),
  getSystemHealth
);

/**
 * @route   GET /api/system-admin/platform/kpis
 * @desc    Get platform key performance indicators
 * @access  System Admin Only
 * @permission view_analytics
 */
router.get('/platform/kpis',
  createCustomLimiter({ windowMs: 1 * 60 * 1000, max: 30 }), // 30 requests per minute
  validateSystemAdminPermission('view_analytics'),
  auditSystemOperation('platform_kpis_access'),
  getPlatformKPIs
);

/**
 * @route   GET /api/system-admin/metrics/cross-school
 * @desc    Get cross-school aggregated metrics
 * @access  System Admin Only
 * @permission view_analytics
 */
router.get('/metrics/cross-school',
  createCustomLimiter({ windowMs: 1 * 60 * 1000, max: 40 }), // 40 requests per minute
  validateSystemAdminPermission('view_analytics'),
  auditSystemOperation('cross_school_metrics_access'),
  getCrossSchoolMetrics
);

// ============================================================================
// SCHOOL MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * @route   GET /api/system-admin/schools/management
 * @desc    Get school management data with pagination and filtering
 * @access  System Admin Only
 * @permission read_schools
 */
router.get('/schools/management',
  createCustomLimiter({ windowMs: 1 * 60 * 1000, max: 60 }), // 60 requests per minute
  validateSystemAdminPermission('read_schools'),
  auditSystemOperation('school_management_access'),
  getSchoolManagement
);

/**
 * @route   POST /api/system-admin/schools
 * @desc    Create new school
 * @access  System Admin Only
 * @permission manage_schools
 */
router.post('/schools',
  createCustomLimiter({ windowMs: 5 * 60 * 1000, max: 10 }), // 10 creates per 5 minutes
  validateSystemAdminPermission('manage_schools'),
  ...createSystemAdminValidationChain('school_management', 'manage_schools'),
  auditSystemOperation('school_creation'),
  createSchool
);

/**
 * @route   PUT /api/system-admin/schools/:schoolId/config
 * @desc    Update school configuration
 * @access  System Admin Only
 * @permission manage_schools
 */
router.put('/schools/:schoolId/config',
  createCustomLimiter({ windowMs: 5 * 60 * 1000, max: 20 }), // 20 updates per 5 minutes
  validateSystemAdminPermission('manage_schools'),
  ...createSystemAdminValidationChain('school_config_update', 'manage_schools'),
  auditSystemOperation('school_config_update'),
  updateSchoolConfig
);

/**
 * @route   PUT /api/system-admin/schools/:schoolId/deactivate
 * @desc    Deactivate school (soft delete)
 * @access  System Admin Only
 * @permission manage_schools
 */
router.put('/schools/:schoolId/deactivate',
  createCustomLimiter({ windowMs: 10 * 60 * 1000, max: 5 }), // 5 deactivations per 10 minutes
  validateSystemAdminPermission('manage_schools'),
  ...createSystemAdminValidationChain('school_management', 'manage_schools'),
  auditSystemOperation('school_deactivation'),
  deactivateSchool
);

/**
 * @route   PUT /api/system-admin/schools/:schoolId/reactivate
 * @desc    Reactivate previously deactivated school
 * @access  System Admin Only
 * @permission manage_schools
 */
router.put('/schools/:schoolId/reactivate',
  createCustomLimiter({ windowMs: 10 * 60 * 1000, max: 5 }), // 5 reactivations per 10 minutes
  validateSystemAdminPermission('manage_schools'),
  ...createSystemAdminValidationChain('school_management', 'manage_schools'),
  auditSystemOperation('school_reactivation'),
  reactivateSchool
);

// ============================================================================
// USER MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * @route   GET /api/system-admin/users/management
 * @desc    Get cross-school user management data
 * @access  System Admin Only
 * @permission manage_users
 */
router.get('/users/management',
  createCustomLimiter({ windowMs: 1 * 60 * 1000, max: 60 }), // 60 requests per minute
  validateSystemAdminPermission('manage_users'),
  auditSystemOperation('user_management_access'),
  getUserManagement
);

/**
 * @route   PUT /api/system-admin/users/:userId/access
 * @desc    Manage user access permissions across schools
 * @access  System Admin Only
 * @permission manage_users
 */
router.put('/users/:userId/access',
  createCustomLimiter({ windowMs: 5 * 60 * 1000, max: 20 }), // 20 updates per 5 minutes
  validateSystemAdminPermission('manage_users'),
  ...createSystemAdminValidationChain('user_management', 'manage_users'),
  auditSystemOperation('user_access_management'),
  manageUserAccess
);

/**
 * @route   GET /api/system-admin/security/alerts
 * @desc    Get security alerts and monitoring information
 * @access  System Admin Only
 * @permission view_security
 */
router.get('/security/alerts',
  createCustomLimiter({ windowMs: 1 * 60 * 1000, max: 60 }), // 60 requests per minute
  validateSystemAdminPermission('view_security'),
  auditSystemOperation('security_alerts_access'),
  getSecurityAlerts
);

// ============================================================================
// HEALTH CHECK AND STATUS ENDPOINTS
// ============================================================================

/**
 * @route   GET /api/system-admin/health
 * @desc    Health check endpoint for system admin API
 * @access  System Admin Only
 */
router.get('/health',
  createCustomLimiter({ windowMs: 1 * 60 * 1000, max: 60 }), // 60 requests per minute
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'System Admin API is healthy',
      timestamp: new Date(),
      systemAdmin: {
        email: req.user.email,
        accessLevel: req.user.systemAdminLevel
      },
      endpoints: {
        platform: {
          overview: '/api/system-admin/platform/overview',
          kpis: '/api/system-admin/platform/kpis',
          health: '/api/system-admin/system/health'
        },
        schools: {
          management: '/api/system-admin/schools/management',
          create: '/api/system-admin/schools',
          updateConfig: '/api/system-admin/schools/:schoolId/config',
          deactivate: '/api/system-admin/schools/:schoolId/deactivate',
          reactivate: '/api/system-admin/schools/:schoolId/reactivate'
        },
        users: {
          management: '/api/system-admin/users/management',
          manageAccess: '/api/system-admin/users/:userId/access'
        },
        security: {
          alerts: '/api/system-admin/security/alerts'
        },
        metrics: {
          crossSchool: '/api/system-admin/metrics/cross-school'
        }
      }
    });
  }
);

module.exports = router;