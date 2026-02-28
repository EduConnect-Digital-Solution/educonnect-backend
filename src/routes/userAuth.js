/**
 * User Authentication Routes
 * Routes for teacher and parent registration, verification, and login
 */

const express = require('express');
const router = express.Router();
const userAuthController = require('../controllers/userAuthController');
const {
  validateParentRegistration,
  validateUserLogin,
  validateCompleteRegistration,
  sanitizeUserData
} = require('../middleware/userAuthValidation');
const rateLimiter = require('../middleware/rateLimiter');
const { authenticateToken } = require('../middleware/auth');
const { authenticateRefreshToken } = require('../middleware/authenticateRefreshToken');

/**
 * @route   POST /api/user/auth/complete-registration
 * @desc    Complete user registration with temporary password
 * @access  Public
 * @body    {email, schoolId, currentPassword, newPassword, firstName?, lastName?, phone?, ...roleSpecificFields}
 */
router.post('/complete-registration',
  rateLimiter.authLimiter,
  sanitizeUserData,
  validateCompleteRegistration,
  userAuthController.completeRegistration
);



/**
 * @route   POST /api/user/auth/register/parent
 * @desc    Register a new parent with invitation token
 * @access  Public
 * @body    {invitationToken, firstName, lastName, email, password, phone?, address?, occupation?, emergencyContact?, emergencyPhone?}
 */
// router.post('/register/parent', 
//   rateLimiter.authLimiter,
//   sanitizeUserData,
//   validateParentRegistration,
//   userAuthController.registerParent
// );

/**
 * @route   POST /api/user/auth/login
 * @desc    Login user (teacher/parent)
 * @access  Public
 * @body    {email, password, schoolId}
 */
router.post('/login',
  rateLimiter.authLimiter,
  validateUserLogin,
  userAuthController.loginUser
);

/**
 * @route   POST /api/user/auth/refresh-token
 * @desc    Refresh access token using HttpOnly cookie
 * @access  Public (requires refresh token in cookie)
 */
router.post('/refresh-token',
  rateLimiter.authLimiter,
  userAuthController.refreshToken
);

/**
 * @route   POST /api/user/auth/logout
 * @desc    Logout user and clear HttpOnly cookie
 * @access  Public
 */
router.post('/logout',
  userAuthController.logout
);

/**
 * @route   GET /api/user/auth/me
 * @desc    Get current user profile using refresh token cookie (ALL USER TYPES)
 * @access  Private (requires refresh token in HttpOnly cookie)
 * @supports Teachers, Parents, School Admins, System Admins
 */
router.get('/me',
  rateLimiter.generalLimiter,
  authenticateRefreshToken,
  userAuthController.getMe
);

/**
 * @route   GET /api/user/auth/debug-cookies
 * @desc    Debug endpoint to check cookie configuration (development only)
 * @access  Public
 */
router.get('/debug-cookies', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ message: 'Not found' });
  }

  const { getCookieDebugInfo } = require('../utils/cookieHelper');
  const debugInfo = getCookieDebugInfo(req);

  res.json({
    success: true,
    debug: debugInfo,
    message: 'Cookie debug information (development only)'
  });
});

// Test endpoint removed - was causing duplicate cookies in browser

module.exports = router;