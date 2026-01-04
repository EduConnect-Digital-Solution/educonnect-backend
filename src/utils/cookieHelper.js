/**
 * Cookie Helper Utility
 * Centralized cookie management for secure token handling
 */

/**
 * Cookie Configuration
 * Secure settings for HttpOnly cookies
 */
const getCookieConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    httpOnly: true,                    // Prevent XSS attacks
    secure: false,                     // Allow HTTP in development (browsers block secure cookies on HTTP)
    sameSite: 'lax',                   // More permissive - works with cross-origin requests
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days in milliseconds
    path: '/'                          // Available to all routes
  };
};

/**
 * Set Refresh Token Cookie
 * Sets the refresh token as an HttpOnly cookie
 * @param {Object} res - Express response object
 * @param {string} refreshToken - JWT refresh token
 */
const setRefreshTokenCookie = (res, refreshToken) => {
  const cookieConfig = getCookieConfig();
  
  res.cookie('refreshToken', refreshToken, cookieConfig);
  
  console.log('🍪 Refresh token cookie set with secure configuration');
};

/**
 * Clear Refresh Token Cookie
 * Removes the refresh token cookie (for logout)
 * @param {Object} res - Express response object
 */
const clearRefreshTokenCookie = (res) => {
  const cookieConfig = getCookieConfig();
  
  // Clear the cookie by setting it with past expiration
  res.cookie('refreshToken', '', {
    ...cookieConfig,
    maxAge: 0
  });
  
  console.log('🍪 Refresh token cookie cleared');
};

/**
 * Get Refresh Token from Cookie
 * Extracts refresh token from request cookies
 * @param {Object} req - Express request object
 * @returns {string|null} Refresh token or null if not found
 */
const getRefreshTokenFromCookie = (req) => {
  const refreshToken = req.cookies?.refreshToken;
  
  if (refreshToken) {
    console.log('🍪 Refresh token found in cookie');
    return refreshToken;
  }
  
  console.log('🍪 No refresh token found in cookies');
  return null;
};

/**
 * Validate Cookie Security
 * Checks if cookies are configured securely
 * @param {Object} req - Express request object
 * @returns {Object} Security validation result
 */
const validateCookieSecurity = (req) => {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const isProduction = process.env.NODE_ENV === 'production';
  
  const validation = {
    isSecure,
    isProduction,
    shouldUseSecureCookies: isProduction,
    warnings: []
  };
  
  if (isProduction && !isSecure) {
    validation.warnings.push('Production environment should use HTTPS for secure cookies');
  }
  
  return validation;
};

/**
 * Cookie Debug Information
 * Returns debug info about cookie configuration (development only)
 * @param {Object} req - Express request object
 * @returns {Object} Debug information
 */
const getCookieDebugInfo = (req) => {
  if (process.env.NODE_ENV === 'production') {
    return { message: 'Debug info not available in production' };
  }
  
  return {
    cookies: req.cookies,
    cookieConfig: getCookieConfig(),
    security: validateCookieSecurity(req),
    headers: {
      userAgent: req.headers['user-agent'],
      origin: req.headers.origin,
      referer: req.headers.referer
    }
  };
};

module.exports = {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshTokenFromCookie,
  validateCookieSecurity,
  getCookieDebugInfo,
  getCookieConfig
};