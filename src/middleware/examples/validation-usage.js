/**
 * Validation and Error Handling Middleware Usage Examples
 * This file demonstrates how to use validation, error handling, and rate limiting middleware
 */

const express = require('express');
const { authenticateToken } = require('../auth');
const {
  schoolAuthSchemas,
  userSchemas,
  invitationSchemas,
  validateBody,
  validateParams,
  validateQuery,
  validateRequest,
  sanitizeInput,
  paramSchemas,
  querySchemas
} = require('../validation');
const {
  globalErrorHandler,
  notFoundHandler,
  catchAsync,
  AppError
} = require('../errorHandler');
const {
  authLimiter,
  passwordResetLimiter,
  emailVerificationLimiter,
  generalLimiter
} = require('../rateLimiter');

const router = express.Router();

// Example 1: School registration with validation and rate limiting
router.post('/school/signup',
  authLimiter, // Rate limit authentication attempts
  sanitizeInput, // Sanitize input to prevent XSS
  validateBody(schoolAuthSchemas.signup), // Validate request body
  catchAsync(async (req, res) => {
    // Controller logic here - validation ensures data is clean and valid
    res.json({
      success: true,
      message: 'School registration successful',
      data: req.body // This is now validated and sanitized
    });
  })
);

// Example 2: User login with multiple validation layers (Requirement 2.1)
router.post('/school/login',
  authLimiter,
  sanitizeInput,
  validateBody(schoolAuthSchemas.login),
  catchAsync(async (req, res) => {
    const { schoolId, email, password } = req.body;
    
    // Simulate authentication error
    if (email === 'test@error.com') {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }
    
    res.json({
      success: true,
      message: 'Login successful',
      schoolId,
      email,
      token: 'jwt-token-here'
    });
  })
);

// Example 3: Password reset with strict rate limiting
router.post('/school/forgot-password',
  passwordResetLimiter, // Very strict rate limiting
  sanitizeInput,
  validateBody(schoolAuthSchemas.forgotPassword),
  catchAsync(async (req, res) => {
    res.json({
      success: true,
      message: 'Password reset email sent'
    });
  })
);

// Example 4: Email verification with validation
router.post('/school/verify-email',
  emailVerificationLimiter,
  sanitizeInput,
  validateBody(schoolAuthSchemas.verifyEmail),
  catchAsync(async (req, res) => {
    const { email, otp } = req.body;
    
    // Simulate OTP validation
    if (otp !== '123456') {
      throw new AppError('Invalid OTP', 400, 'INVALID_OTP');
    }
    
    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  })
);

// Example 5: User creation with complex validation
router.post('/users',
  authenticateToken,
  generalLimiter,
  sanitizeInput,
  validateBody(userSchemas.createUser),
  catchAsync(async (req, res) => {
    // The validation middleware ensures:
    // - Required fields are present
    // - Email format is valid
    // - Role-specific fields are correct (e.g., teachers have subjects)
    // - Data is sanitized against XSS
    
    res.json({
      success: true,
      message: 'User created successfully',
      data: req.body
    });
  })
);

// Example 6: User profile update with parameter and body validation
router.put('/users/:id',
  authenticateToken,
  generalLimiter,
  sanitizeInput,
  ...validateRequest({
    params: paramSchemas.id,
    body: userSchemas.updateUser
  }),
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;
    
    res.json({
      success: true,
      message: 'User updated successfully',
      userId: id,
      data: updateData
    });
  })
);

// Example 7: User listing with query parameter validation
router.get('/users',
  authenticateToken,
  generalLimiter,
  sanitizeInput,
  validateQuery(querySchemas.userFilter),
  catchAsync(async (req, res) => {
    const { page, limit, sort, sortBy, role, isActive, search } = req.query;
    
    res.json({
      success: true,
      message: 'Users retrieved successfully',
      pagination: { page, limit, sort, sortBy },
      filters: { role, isActive, search },
      data: []
    });
  })
);

// Example 8: Invitation sending with validation
router.post('/invitations',
  authenticateToken,
  generalLimiter,
  sanitizeInput,
  validateBody(invitationSchemas.sendInvitation),
  catchAsync(async (req, res) => {
    res.json({
      success: true,
      message: 'Invitation sent successfully',
      data: req.body
    });
  })
);

// Example 9: Password change with validation
router.post('/users/:id/change-password',
  authenticateToken,
  generalLimiter,
  sanitizeInput,
  ...validateRequest({
    params: paramSchemas.id,
    body: userSchemas.changePassword
  }),
  catchAsync(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    // Simulate password validation
    if (currentPassword === 'wrong') {
      throw new AppError('Current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD');
    }
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  })
);

// Example 10: Error simulation endpoint for testing
router.get('/test-error/:type',
  generalLimiter,
  validateParams(require('joi').object({
    type: require('joi').string().valid('validation', 'auth', 'server', 'not-found').required()
  })),
  catchAsync(async (req, res) => {
    const { type } = req.params;
    
    switch (type) {
      case 'validation':
        throw new AppError('Validation error example', 400, 'VALIDATION_ERROR');
      case 'auth':
        throw new AppError('Authentication error example', 401, 'AUTH_ERROR');
      case 'server':
        throw new Error('Internal server error example');
      case 'not-found':
        throw new AppError('Resource not found example', 404, 'NOT_FOUND');
      default:
        res.json({ success: true, message: 'No error triggered' });
    }
  })
);

// Apply global error handling middleware
router.use(globalErrorHandler);

// Handle 404 errors for unmatched routes
router.use(notFoundHandler);

module.exports = router;