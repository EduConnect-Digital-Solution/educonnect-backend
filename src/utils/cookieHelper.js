/**
 * Cookie Helper Utility
 * Centralized cookie management for secure token handling
 */

/**
 * Cookie Configuration
 * Secure settings for HttpOnly cookies
 */
const getCookieConfig = (req) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const origin = req?.headers?.origin;
  const isLocalhost = origin && (
    origin.includes('localhost') || 
    origin.includes('127.0.0.1') ||
    origin.includes(':5173') ||  // Vite dev server
    origin.includes(':3000')     // React dev server
  );
  
  // Check if this is a Vercel production request (cross-origin)
  const isVercelProduction = origin && origin.includes('vercel.app');
  
  let config;
  
  if (isVercelProduction || (isProduction && !isLocalhost)) {
    // Production cross-origin (Vercel -> Render): use cross-origin settings
    config = {
      httpOnly: true,
      secure: true,              // Required for sameSite: 'none'
      sameSite: 'none',          // Required for cross-origin
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
      // Removed partitioned for now - it might be causing issues
    };
  } else if (isProduction && isLocalhost) {
    // Production but localhost (same-origin): use secure settings
    config = {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',           // Same-origin can use lax
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    };
  } else {
    // Development localhost: use less secure but functional settings
    config = {
      httpOnly: true,
      secure: false,             // Can't use secure: true without HTTPS
      sameSite: 'lax',          // Best we can do without HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    };
  }
  
  console.log('🍪 Cookie config:', { 
    ...config, 
    origin,
    isProduction,
    isLocalhost,
    isVercelProduction
  });
  
  return config;
};

/**
 * Set Refresh Token Cookie
 * Sets the refresh token as an HttpOnly cookie
 * @param {Object} res - Express response object
 * @param {string} refreshToken - JWT refresh token
 * @param {Object} req - Express request object (for origin detection)
 */
const setRefreshTokenCookie = (res, refreshToken, req = null) => {
  const cookieConfig = getCookieConfig(req);
  
  res.cookie('refreshToken', refreshToken, cookieConfig);
  
  console.log('🍪 Refresh token cookie set with secure configuration');
};

/**
 * Clear Refresh Token Cookie
 * Removes the refresh token cookie (for logout)
 * @param {Object} res - Express response object
 * @param {Object} req - Express request object (for origin detection)
 */
const clearRefreshTokenCookie = (res, req = null) => {
  const cookieConfig = getCookieConfig(req);
  
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
    cookieConfig: getCookieConfig(req),
    security: validateCookieSecurity(req),
    headers: {
      userAgent: req.headers['user-agent'],
      origin: req.headers.origin,
      referer: req.headers.referer,
      host: req.headers.host,
      'cookie': req.headers.cookie
    },
    environment: process.env.NODE_ENV,
    url: req.url,
    method: req.method
  };
};

module.exports = {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshTokenFromCookie,
  validateCookieSecurity,
  getCookieConfig,
  getCookieDebugInfo
};