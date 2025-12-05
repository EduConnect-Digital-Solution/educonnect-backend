/**
 * Rate Limiting Middleware
 * Provides rate limiting functionality for different endpoints
 * Requirements: 9.4
 */

const rateLimit = require('express-rate-limit');
const { RateLimitError } = require('./errorHandler');

/**
 * Create a custom rate limit handler
 */
const createRateLimitHandler = (message) => {
  return (req, res) => {
    res.status(429).json({
      success: false,
      message: message || 'Too many requests, please try again later.',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000) || 60
    });
  };
};

/**
 * General API rate limiter
 * Applies to all API endpoints
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many requests from this IP, please try again later.')
});

/**
 * Authentication rate limiter
 * Stricter limits for auth endpoints
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 auth requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: createRateLimitHandler('Too many authentication attempts, please try again later.')
});

/**
 * Registration rate limiter
 * Very strict limits for registration
 */
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 registration attempts per hour
  message: 'Too many registration attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many registration attempts, please try again later.')
});

/**
 * Password reset rate limiter
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 password reset requests per hour
  message: 'Too many password reset attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many password reset attempts, please try again later.')
});

/**
 * Email verification rate limiter
 */
const emailVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 verification attempts per 15 minutes
  message: 'Too many email verification attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many email verification attempts, please try again later.')
});

/**
 * OTP request rate limiter
 */
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 OTP requests per 15 minutes
  message: 'Too many OTP requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many OTP requests, please try again later.')
});

/**
 * File upload rate limiter
 */
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 upload requests per 15 minutes
  message: 'Too many file upload attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many file upload attempts, please try again later.')
});

/**
 * Search rate limiter
 */
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 search requests per minute
  message: 'Too many search requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many search requests, please try again later.')
});

/**
 * Admin operations rate limiter
 */
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 admin requests per 15 minutes
  message: 'Too many admin requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many admin requests, please try again later.')
});

/**
 * Create a custom rate limiter with specific options
 */
const createCustomLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: createRateLimitHandler(options.message)
  };

  return rateLimit({ ...defaultOptions, ...options });
};

/**
 * Skip rate limiting for certain conditions
 */
const skipRateLimit = (req) => {
  // Skip rate limiting for health checks
  if (req.path === '/health') return true;
  
  // Skip for localhost in development
  if (process.env.NODE_ENV === 'development' && req.ip === '127.0.0.1') return true;
  
  // Skip for whitelisted IPs (if configured)
  const whitelistedIPs = process.env.RATE_LIMIT_WHITELIST?.split(',') || [];
  if (whitelistedIPs.includes(req.ip)) return true;
  
  return false;
};

/**
 * Dynamic rate limiter based on user role
 */
const dynamicRateLimiter = (req, res, next) => {
  // Skip if conditions are met
  if (skipRateLimit(req)) return next();

  // Different limits based on user role
  let limiter;
  
  if (req.user) {
    switch (req.user.role) {
      case 'admin':
        limiter = adminLimiter;
        break;
      case 'teacher':
        limiter = createCustomLimiter({ max: 300, windowMs: 15 * 60 * 1000 });
        break;
      case 'parent':
        limiter = createCustomLimiter({ max: 150, windowMs: 15 * 60 * 1000 });
        break;
      default:
        limiter = generalLimiter;
    }
  } else {
    // Unauthenticated users get stricter limits
    limiter = createCustomLimiter({ max: 50, windowMs: 15 * 60 * 1000 });
  }

  return limiter(req, res, next);
};

/**
 * Rate limiter for specific endpoints
 */
const endpointLimiters = {
  // Authentication endpoints
  '/api/school/auth/register': registrationLimiter,
  '/api/school/auth/login': authLimiter,
  '/api/school/auth/forgot-password': passwordResetLimiter,
  '/api/school/auth/reset-password': passwordResetLimiter,
  '/api/school/auth/verify-email': emailVerificationLimiter,
  '/api/school/auth/resend-otp': otpLimiter,
  
  '/api/user/auth/login': authLimiter,
  '/api/user/auth/complete-registration': authLimiter,
  
  // Search endpoints
  '/api/students/search': searchLimiter,
  '/api/parent-management/parents': searchLimiter,
  
  // Upload endpoints
  '/api/upload': uploadLimiter
};

/**
 * Apply endpoint-specific rate limiting
 */
const applyEndpointLimiting = (req, res, next) => {
  const limiter = endpointLimiters[req.path];
  if (limiter) {
    return limiter(req, res, next);
  }
  next();
};

// Add missing limiters and functions that tests expect
const invitationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many invitation requests, please try again later.',
  handler: createRateLimitHandler('Too many invitation requests, please try again later.')
});

const schoolRegistrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many school registration attempts, please try again later.',
  handler: createRateLimitHandler('Too many school registration attempts, please try again later.')
});

const createDynamicLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000,
    maxAnonymous: 10,
    maxAuthenticated: 50
  };
  
  const config = { ...defaultOptions, ...options };
  
  return rateLimit({
    windowMs: config.windowMs,
    max: (req) => {
      return req.user ? config.maxAuthenticated : config.maxAnonymous;
    },
    handler: createRateLimitHandler('Rate limit exceeded')
  });
};

const createLoggingLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000,
    max: 100
  };
  
  const config = { ...defaultOptions, ...options };
  
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    handler: (req, res) => {
      console.log(`Rate limit exceeded for IP: ${req.ip}`);
      createRateLimitHandler('Rate limit exceeded')(req, res);
    }
  });
};

module.exports = {
  generalLimiter,
  authLimiter,
  registrationLimiter,
  passwordResetLimiter,
  emailVerificationLimiter,
  otpLimiter,
  uploadLimiter,
  searchLimiter,
  adminLimiter,
  createCustomLimiter,
  dynamicRateLimiter,
  applyEndpointLimiting,
  skipRateLimit,
  // Add missing exports that tests expect
  invitationLimiter,
  schoolRegistrationLimiter,
  createDynamicLimiter,
  createLoggingLimiter
};