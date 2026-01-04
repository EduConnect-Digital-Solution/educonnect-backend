/**
 * System Admin Authentication Controller
 * Handles authentication endpoints for system administrators
 * No registration or user management - only pre-configured authentication
 */

const { 
  loginSystemAdmin, 
  refreshSystemAdminToken, 
  verifySystemAdminToken,
  isSystemAdminConfigured 
} = require('../services/systemAdminAuthService');
const catchAsync = require('../utils/catchAsync');
const { 
  setRefreshTokenCookie, 
  clearRefreshTokenCookie, 
  getRefreshTokenFromCookie 
} = require('../utils/cookieHelper');

/**
 * System Admin Login
 * POST /api/system-admin/auth/login
 * Authenticates system admin using pre-configured credentials
 */
const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required',
      code: 'MISSING_CREDENTIALS'
    });
  }

  // Check if system admin is configured
  if (!isSystemAdminConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'System admin not configured',
      code: 'SYSTEM_ADMIN_NOT_CONFIGURED'
    });
  }

  try {
    // Attempt login
    const result = await loginSystemAdmin(email, password);

    // Set refresh token as HttpOnly cookie (if available)
    if (result.refreshToken) {
      setRefreshTokenCookie(res, result.refreshToken, req);
    }

    // Log successful login
    console.log(`🔐 System admin login successful: ${email} at ${new Date().toISOString()}`);

    res.status(200).json({
      success: true,
      message: 'System admin login successful',
      data: {
        token: result.token,
        user: result.user,
        expiresIn: '8h' // Default session timeout
      }
    });

  } catch (error) {
    // Log failed login attempt
    console.warn(`🚫 System admin login failed: ${email} - ${error.message}`);

    res.status(401).json({
      success: false,
      message: 'Invalid system admin credentials',
      code: 'INVALID_CREDENTIALS'
    });
  }
});

/**
 * Verify System Admin Token
 * GET /api/system-admin/auth/verify
 * Verifies if the current token is valid
 */
const verify = catchAsync(async (req, res) => {
  // Token verification is handled by middleware
  // If we reach here, token is valid
  
  res.status(200).json({
    success: true,
    message: 'Token is valid',
    data: {
      user: req.user,
      systemAdmin: req.systemAdmin,
      valid: true
    }
  });
});

/**
 * Refresh System Admin Token
 * POST /api/system-admin/auth/refresh
 * Refreshes the current system admin token using HttpOnly cookie or Authorization header
 */
const refresh = catchAsync(async (req, res) => {
  // Try to get refresh token from cookie first, then fallback to Authorization header
  let currentToken = getRefreshTokenFromCookie(req);
  let source = 'cookie';
  
  if (!currentToken) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      currentToken = authHeader.substring(7);
      source = 'header';
      console.log('⚠️ Using token from Authorization header for system admin refresh (deprecated)');
    }
  }

  if (!currentToken) {
    return res.status(401).json({
      success: false,
      message: 'Token required for refresh',
      code: 'MISSING_TOKEN'
    });
  }

  try {
    const result = await refreshSystemAdminToken(currentToken);

    // Set new refresh token as HttpOnly cookie (if available)
    if (result.refreshToken) {
      setRefreshTokenCookie(res, result.refreshToken, req);
    }

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: result.token,
        user: result.user,
        expiresIn: '8h'
      }
    });

  } catch (error) {
    // Clear invalid refresh token cookie
    clearRefreshTokenCookie(res, req);
    
    res.status(401).json({
      success: false,
      message: 'Token refresh failed',
      code: 'REFRESH_FAILED',
      error: error.message
    });
  }
});

/**
 * System Admin Logout
 * POST /api/system-admin/auth/logout
 * Logs out system admin and clears HttpOnly cookie
 */
const logout = catchAsync(async (req, res) => {
  try {
    // Clear refresh token cookie
    clearRefreshTokenCookie(res, req);

    // Log the logout for audit purposes
    if (req.user && req.user.role === 'system_admin') {
      console.log(`🔓 System admin logout: ${req.user.email} at ${new Date().toISOString()}`);
    }

    res.status(200).json({
      success: true,
      message: 'Logout successful',
      data: {
        loggedOut: true,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    // Even if there's an error, clear the cookie
    clearRefreshTokenCookie(res, req);
    
    res.status(200).json({
      success: true,
      message: 'Logout successful',
      data: {
        loggedOut: true,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Get System Admin Status
 * GET /api/system-admin/auth/status
 * Returns system admin configuration status (for setup verification)
 */
const getStatus = catchAsync(async (req, res) => {
  const configured = isSystemAdminConfigured();

  res.status(200).json({
    success: true,
    message: 'System admin status retrieved',
    data: {
      configured,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    }
  });
});

module.exports = {
  login,
  verify,
  refresh,
  logout,
  getStatus
};