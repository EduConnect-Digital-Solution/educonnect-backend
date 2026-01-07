/**
 * System Admin Authentication Routes
 * Handles authentication endpoints for system administrators
 * No registration, password reset, or user management endpoints
 */

const express = require('express');
const router = express.Router();

// Import controllers
const {
  login,
  verify,
  refresh,
  logout,
  getStatus,
  getMe
} = require('../controllers/systemAdminAuthController');

// Import middleware
const { 
  requireSystemAdmin,
  auditSystemOperation 
} = require('../middleware/systemAdminAuth');
const { createCustomLimiter } = require('../middleware/rateLimiter');
const rateLimiter = require('../middleware/rateLimiter');
const {
  validateLogin,
  validateRefresh,
  createSystemAdminValidationChain
} = require('../middleware/systemAdminAuthValidation');

/**
 * @route   POST /api/system-admin/auth/login
 * @desc    System admin login with pre-configured credentials
 * @access  Public (but requires valid system admin credentials)
 */
router.post('/login', 
  createCustomLimiter({ windowMs: 15 * 60 * 1000, max: 5 }), // 5 attempts per 15 minutes
  ...createSystemAdminValidationChain(validateLogin),
  auditSystemOperation('system_admin_login'),
  login
);

/**
 * @route   GET /api/system-admin/auth/verify
 * @desc    Verify system admin token validity
 * @access  System Admin Only
 */
router.get('/verify',
  requireSystemAdmin,
  auditSystemOperation('system_admin_token_verify'),
  verify
);

/**
 * @route   POST /api/system-admin/auth/refresh
 * @desc    Refresh system admin token
 * @access  System Admin Only (requires valid token)
 */
router.post('/refresh',
  createCustomLimiter({ windowMs: 15 * 60 * 1000, max: 10 }), // 10 refresh attempts per 15 minutes
  ...createSystemAdminValidationChain(validateRefresh),
  auditSystemOperation('system_admin_token_refresh'),
  refresh
);

/**
 * @route   POST /api/system-admin/auth/logout
 * @desc    System admin logout (optional - mainly for client-side cleanup)
 * @access  System Admin Only
 */
router.post('/logout',
  requireSystemAdmin,
  auditSystemOperation('system_admin_logout'),
  logout
);

/**
 * @route   GET /api/system-admin/auth/me
 * @desc    Get current system admin profile from HttpOnly cookie
 * @access  Public (requires refresh token in cookie)
 */
router.get('/me',
  rateLimiter.generalLimiter,
  getMe
);

/**
 * @route   GET /api/system-admin/auth/status
 * @desc    Get system admin configuration status
 * @access  Public (for setup verification)
 */
router.get('/status',
  createCustomLimiter({ windowMs: 5 * 60 * 1000, max: 20 }), // 20 requests per 5 minutes
  getStatus
);

// Explicitly NO registration, password reset, or user management endpoints
// System admin credentials are pre-configured via environment variables

module.exports = router;