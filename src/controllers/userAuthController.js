/**
 * User Authentication Controller
 * Handles HTTP requests and delegates business logic to authService
 * Requirements: 2.1, 2.2, 2.3, 3.3, 3.4, 4.2, 4.3
 */

const authService = require('../services/authService');
const catchAsync = require('../utils/catchAsync');
const { validationResult } = require('express-validator');

// Legacy imports for non-auth functions (to be refactored in Phase 3)
const User = require('../models/User');
const School = require('../models/School');
const Student = require('../models/Student');
const Invitation = require('../models/Invitation');
const EmailService = require('../config/email');



/**
 * Complete User Registration
 * Allows users with temporary passwords to complete their registration
 * Requirements: 3.3, 3.4, 4.2, 4.3
 */
const completeRegistration = catchAsync(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  try {
    const result = await authService.completeRegistration(req.body);

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        user: result.user,
        tokens: result.tokens
      }
    });
  } catch (error) {
    // Handle specific business logic errors
    if (error.message === 'User not found or registration already completed') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Invalid current password') {
      return res.status(401).json({
        success: false,
        message: error.message
      });
    }

    // Re-throw for global error handler
    throw error;
  }
});

/**
 * Universal User Login
 * Handles login for teachers, parents, and other users
 * Requirements: 2.1, 2.2, 2.3
 */
const loginUser = catchAsync(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  try {
    const { email, password, schoolId } = req.body;
    const result = await authService.loginUser(email, password, schoolId);

    // Handle temporary password users
    if (result.redirectTo) {
      return res.status(200).json({
        success: true,
        message: 'Login successful. Please complete your registration.',
        data: {
          user: result.user,
          redirectTo: result.redirectTo
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        school: result.school,
        tokens: result.tokens
      }
    });
  } catch (error) {
    // Handle specific business logic errors
    if (error.message === 'Invalid credentials') {
      return res.status(401).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('not verified') || error.message.includes('deactivated') || error.message.includes('contact school administration')) {
      return res.status(401).json({
        success: false,
        message: error.message
      });
    }

    // Re-throw for global error handler
    throw error;
  }
});

module.exports = {
  completeRegistration,
  loginUser
};