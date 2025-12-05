/**
 * Validation Middleware
 * Provides common validation utilities and middleware functions
 * Requirements: 9.1, 9.2
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Handle validation errors middleware
 * Standardizes validation error responses across the application
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

/**
 * Common validation rules
 */
const commonValidations = {
  // Email validation
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),

  // Password validation
  password: body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  // Name validation
  firstName: body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),

  lastName: body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),

  // Phone validation
  phone: body('phone')
    .optional()
    .matches(/^\+?[\d\s\-\(\)]+$/)
    .withMessage('Phone number format is invalid'),

  // MongoDB ObjectId validation
  mongoId: (field) => param(field)
    .isMongoId()
    .withMessage(`Invalid ${field} format`),

  // School ID validation
  schoolId: body('schoolId')
    .matches(/^SCH[A-Z0-9]{6}$/)
    .withMessage('School ID must be in format SCH followed by 6 alphanumeric characters'),

  // Pagination validation
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ]
};

/**
 * Sanitization middleware
 * Cleans and sanitizes input data
 */
const sanitizeInput = (req, res, next) => {
  // Remove any potential XSS attempts from string fields
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim();
  };

  // Recursively sanitize object properties
  const sanitizeObject = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};

/**
 * File upload validation
 */
const validateFileUpload = (allowedTypes = [], maxSize = 5 * 1024 * 1024) => {
  return (req, res, next) => {
    if (!req.file && !req.files) {
      return next();
    }

    const files = req.files || [req.file];
    
    for (const file of files) {
      // Check file size
      if (file.size > maxSize) {
        return res.status(400).json({
          success: false,
          message: `File size exceeds maximum limit of ${maxSize / (1024 * 1024)}MB`
        });
      }

      // Check file type
      if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: `File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`
        });
      }
    }

    next();
  };
};

/**
 * Custom validation for business rules
 */
const customValidations = {
  // Validate that end date is after start date
  dateRange: (startField, endField) => {
    return body(endField).custom((endDate, { req }) => {
      const startDate = req.body[startField];
      if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
        throw new Error(`${endField} must be after ${startField}`);
      }
      return true;
    });
  },

  // Validate password confirmation
  passwordConfirmation: body('confirmPassword').custom((confirmPassword, { req }) => {
    if (confirmPassword !== req.body.password) {
      throw new Error('Password confirmation does not match password');
    }
    return true;
  }),

  // Validate unique email (requires database check)
  uniqueEmail: (model) => {
    return body('email').custom(async (email, { req }) => {
      const existingUser = await model.findOne({ 
        email: email.toLowerCase(),
        schoolId: req.body.schoolId 
      });
      if (existingUser) {
        throw new Error('Email already exists in this school');
      }
      return true;
    });
  }
};

// Create Joi schemas that the tests expect
const Joi = require('joi');

const commonSchemas = {
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required(),
  objectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  role: Joi.string().valid('admin', 'teacher', 'parent').required(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().valid('asc', 'desc').default('asc')
};

const schoolAuthSchemas = {
  signup: Joi.object({
    schoolName: Joi.string().required(),
    email: commonSchemas.email,
    password: commonSchemas.password,
    confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
      'any.only': 'Passwords do not match'
    }),
    adminFirstName: Joi.string().required(),
    adminLastName: Joi.string().required()
  }),
  login: Joi.object({
    schoolId: Joi.string().required(),
    email: commonSchemas.email,
    password: Joi.string().required()
  }),
  verifyEmail: Joi.object({
    email: commonSchemas.email,
    otp: Joi.string().length(6).pattern(/^\d+$/).required(),
    schoolId: Joi.string().required()
  })
};

const userSchemas = {
  createUser: Joi.object({
    email: commonSchemas.email,
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    role: commonSchemas.role,
    subjects: Joi.when('role', {
      is: 'teacher',
      then: Joi.array().items(Joi.string()).min(1).required(),
      otherwise: Joi.forbidden()
    })
  }),
  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: commonSchemas.password
  })
};

const invitationSchemas = {
  sendInvitation: Joi.object({
    email: commonSchemas.email,
    role: commonSchemas.role,
    firstName: Joi.string().required(),
    lastName: Joi.string().required()
  }),
  acceptInvitation: Joi.object({
    token: Joi.string().required(),
    password: commonSchemas.password
  })
};

// Validation middleware functions
const validateBody = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details
      });
    }
    next();
  };
};

const validateParams = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.params);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid parameters',
        errors: error.details
      });
    }
    next();
  };
};

const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: error.details
      });
    }
    next();
  };
};

const validateRequest = (bodySchema, paramSchema, querySchema) => {
  return (req, res, next) => {
    if (bodySchema) {
      const { error: bodyError } = bodySchema.validate(req.body);
      if (bodyError) {
        return res.status(400).json({
          success: false,
          message: 'Body validation failed',
          errors: bodyError.details
        });
      }
    }
    
    if (paramSchema) {
      const { error: paramError } = paramSchema.validate(req.params);
      if (paramError) {
        return res.status(400).json({
          success: false,
          message: 'Parameter validation failed',
          errors: paramError.details
        });
      }
    }
    
    if (querySchema) {
      const { error: queryError } = querySchema.validate(req.query);
      if (queryError) {
        return res.status(400).json({
          success: false,
          message: 'Query validation failed',
          errors: queryError.details
        });
      }
    }
    
    next();
  };
};

module.exports = {
  handleValidationErrors,
  commonValidations,
  sanitizeInput,
  validateFileUpload,
  customValidations,
  // Add the schemas and functions that tests expect
  commonSchemas,
  schoolAuthSchemas,
  userSchemas,
  invitationSchemas,
  validateBody,
  validateParams,
  validateQuery,
  validateRequest
};