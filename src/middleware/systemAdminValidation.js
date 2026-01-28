/**
 * System Admin Validation Middleware
 * Comprehensive validation for system admin operations
 * Includes input validation, permission validation, and audit logging
 */

const { body, param, query, validationResult } = require('express-validator');
const { ROLES } = require('./rbac');
const { logSystemAdminActivity } = require('../services/authService');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Log validation failure for system admin operations
    if (req.user && req.user.role === ROLES.SYSTEM_ADMIN) {
      logSystemAdminActivity(req.user.email, 'validation_failed', {
        errors: errors.array(),
        endpoint: req.path,
        method: req.method,
        severity: 'low'
      });
    }

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value,
        location: error.location
      }))
    });
  }
  
  next();
};

/**
 * Validate Cross-School Operations
 * Ensures proper validation for operations that span multiple schools
 */
const validateCrossSchoolOperation = [
  // School ID validation (can be array or single value)
  body('schoolIds')
    .optional()
    .custom((value) => {
      if (Array.isArray(value)) {
        // Validate array of school IDs
        if (value.length === 0) {
          throw new Error('School IDs array cannot be empty');
        }
        value.forEach(id => {
          if (typeof id !== 'string' || !/^[A-Z]{3}\d{3}$/.test(id)) {
            throw new Error('Each school ID must follow format: ABC123');
          }
        });
      } else if (typeof value === 'string') {
        // Single school ID
        if (!/^[A-Z]{3}\d{3}$/.test(value)) {
          throw new Error('School ID must follow format: ABC123');
        }
      } else {
        throw new Error('School IDs must be string or array of strings');
      }
      return true;
    }),

  // Date range validation for analytics
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be valid ISO 8601 format'),
  
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be valid ISO 8601 format')
    .custom((endDate, { req }) => {
      if (req.body.startDate && endDate) {
        const start = new Date(req.body.startDate);
        const end = new Date(endDate);
        if (end <= start) {
          throw new Error('End date must be after start date');
        }
      }
      return true;
    }),

  // Metric type validation
  body('metrics')
    .optional()
    .isArray()
    .withMessage('Metrics must be an array')
    .custom((metrics) => {
      const validMetrics = ['users', 'students', 'activity', 'performance', 'overview'];
      const invalidMetrics = metrics.filter(m => !validMetrics.includes(m));
      if (invalidMetrics.length > 0) {
        throw new Error(`Invalid metrics: ${invalidMetrics.join(', ')}`);
      }
      return true;
    }),

  handleValidationErrors
];

/**
 * Validate System Admin Actions
 * Validates specific system admin operations
 */
const validateSystemAdminAction = (actionType) => {
  const validators = [];

  switch (actionType) {
    case 'school_config_update':
      validators.push(
        param('schoolId')
          .notEmpty()
          .withMessage('School ID is required')
          .matches(/^[A-Z]{3}\d{3}$/)
          .withMessage('School ID must follow format: ABC123'),
        
        body('subscriptionTier')
          .optional()
          .isIn(['basic', 'standard', 'premium', 'enterprise'])
          .withMessage('Invalid subscription tier'),
        
        body('subscriptionStatus')
          .optional()
          .isIn(['active', 'inactive', 'suspended', 'trial'])
          .withMessage('Invalid subscription status'),
        
        body('features')
          .optional()
          .isArray()
          .withMessage('Features must be an array')
          .custom((features) => {
            if (features && features.length > 0) {
              for (const feature of features) {
                if (!feature.featureName || typeof feature.featureName !== 'string') {
                  throw new Error('Each feature must have a featureName string');
                }
                if (typeof feature.isEnabled !== 'boolean') {
                  throw new Error('Each feature must have an isEnabled boolean');
                }
              }
            }
            return true;
          }),
        
        body('limits')
          .optional()
          .isObject()
          .withMessage('Limits must be an object'),
        
        body('limits.maxUsers')
          .optional()
          .isInt({ min: 1, max: 10000 })
          .withMessage('maxUsers must be between 1 and 10000'),
        
        body('limits.maxStudents')
          .optional()
          .isInt({ min: 1, max: 50000 })
          .withMessage('maxStudents must be between 1 and 50000'),
        
        body('limits.maxTeachers')
          .optional()
          .isInt({ min: 1, max: 1000 })
          .withMessage('maxTeachers must be between 1 and 1000'),
        
        body('limits.maxParents')
          .optional()
          .isInt({ min: 1, max: 20000 })
          .withMessage('maxParents must be between 1 and 20000'),
        
        body('systemNote')
          .optional()
          .isLength({ min: 1, max: 500 })
          .withMessage('System note must be between 1 and 500 characters')
          .trim(),
        
        body('isActive')
          .optional()
          .isBoolean()
          .withMessage('isActive must be boolean'),
        
        body('customSettings')
          .optional()
          .isObject()
          .withMessage('Custom settings must be an object')
      );
      break;

    case 'school_management':
      validators.push(
        body('schoolName')
          .optional()
          .isLength({ min: 2, max: 100 })
          .withMessage('School name must be between 2 and 100 characters')
          .trim(),
        
        body('email')
          .optional()
          .isEmail()
          .withMessage('Valid email address required')
          .normalizeEmail(),
        
        body('isActive')
          .optional()
          .isBoolean()
          .withMessage('isActive must be boolean'),
        
        body('subscriptionTier')
          .optional()
          .isIn(['basic', 'standard', 'premium', 'enterprise'])
          .withMessage('Invalid subscription tier')
      );
      break;

    case 'user_management':
      validators.push(
        body('action')
          .notEmpty()
          .withMessage('Action is required')
          .isIn(['activate', 'deactivate', 'change_role', 'transfer_school'])
          .withMessage('Invalid action. Must be one of: activate, deactivate, change_role, transfer_school'),
        
        body('reason')
          .notEmpty()
          .withMessage('Reason is required')
          .isLength({ min: 10, max: 500 })
          .withMessage('Reason must be between 10 and 500 characters')
          .trim(),
        
        body('newRole')
          .if(body('action').equals('change_role'))
          .notEmpty()
          .withMessage('New role is required for role change action')
          .isIn(['admin', 'teacher', 'parent'])
          .withMessage('Invalid user role'),
        
        body('schoolTransfer')
          .optional()
          .isObject()
          .withMessage('School transfer must be an object'),
        
        body('schoolTransfer.targetSchoolId')
          .if(body('action').equals('transfer_school'))
          .notEmpty()
          .withMessage('Target school ID is required for transfer action')
          .matches(/^[A-Z]{3}\d{3}$/)
          .withMessage('School ID must follow format: ABC123'),
        
        body('userId')
          .optional()
          .isMongoId()
          .withMessage('Valid user ID required'),
        
        body('isActive')
          .optional()
          .isBoolean()
          .withMessage('isActive must be boolean'),
        
        body('permissions')
          .optional()
          .isArray()
          .withMessage('Permissions must be an array')
      );
      break;

    case 'impersonation':
      validators.push(
        body('targetUserId')
          .notEmpty()
          .withMessage('Target user ID is required')
          .isMongoId()
          .withMessage('Valid user ID required'),
        
        body('reason')
          .notEmpty()
          .withMessage('Impersonation reason is required')
          .isLength({ min: 10, max: 500 })
          .withMessage('Reason must be between 10 and 500 characters')
          .trim(),
        
        body('duration')
          .optional()
          .isInt({ min: 300, max: 7200 }) // 5 minutes to 2 hours
          .withMessage('Duration must be between 300 and 7200 seconds')
      );
      break;

    case 'analytics':
      validators.push(
        query('timeRange')
          .optional()
          .isIn(['1h', '24h', '7d', '30d', '90d', '1y'])
          .withMessage('Invalid time range'),
        
        query('format')
          .optional()
          .isIn(['json', 'csv', 'pdf'])
          .withMessage('Invalid export format'),
        
        query('includeInactive')
          .optional()
          .isBoolean()
          .withMessage('includeInactive must be boolean')
      );
      break;

    case 'system_config':
      validators.push(
        body('configKey')
          .notEmpty()
          .withMessage('Configuration key is required')
          .matches(/^[a-zA-Z0-9_.-]+$/)
          .withMessage('Config key can only contain alphanumeric characters, dots, hyphens, and underscores'),
        
        body('configValue')
          .notEmpty()
          .withMessage('Configuration value is required'),
        
        body('scope')
          .optional()
          .isIn(['global', 'school', 'user'])
          .withMessage('Invalid configuration scope')
      );
      break;

    default:
      // Generic validation for unknown action types
      validators.push(
        body().custom((body) => {
          // Prevent dangerous operations
          const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
          const hasDangerousKeys = dangerousKeys.some(key => 
            JSON.stringify(body).includes(key)
          );
          if (hasDangerousKeys) {
            throw new Error('Request contains potentially dangerous content');
          }
          return true;
        })
      );
  }

  validators.push(handleValidationErrors);
  return validators;
};

/**
 * Validate Permission for System Admin Actions
 * Checks if system admin has permission for specific operations
 */
const validateSystemAdminPermission = (requiredPermission, options = {}) => {
  return async (req, res, next) => {
    try {
      // Ensure user is system admin
      if (!req.user || req.user.role !== ROLES.SYSTEM_ADMIN) {
        return res.status(403).json({
          success: false,
          message: 'System administrator access required',
          code: 'SYSTEM_ADMIN_REQUIRED'
        });
      }

      // Define permission hierarchy
      const permissions = {
        'read_schools': { level: 1, description: 'View school information' },
        'manage_schools': { level: 2, description: 'Create, update, deactivate schools' },
        'read_users': { level: 1, description: 'View user information across schools' },
        'manage_users': { level: 3, description: 'Manage users across schools' },
        'impersonate_users': { level: 4, description: 'Impersonate users for support' },
        'view_analytics': { level: 2, description: 'View platform analytics' },
        'view_security': { level: 2, description: 'View security alerts and monitoring' },
        'export_data': { level: 3, description: 'Export platform data' },
        'manage_system_config': { level: 5, description: 'Modify system configuration' },
        'view_audit_logs': { level: 3, description: 'View audit logs' },
        'manage_security': { level: 5, description: 'Manage security settings' }
      };

      const permission = permissions[requiredPermission];
      
      if (!permission) {
        return res.status(400).json({
          success: false,
          message: `Unknown permission: ${requiredPermission}`,
          code: 'UNKNOWN_PERMISSION'
        });
      }

      // For now, all system admins have all permissions
      // In a more complex system, you could check user-specific permissions
      const userPermissionLevel = 5; // Maximum level for system admins
      
      if (userPermissionLevel < permission.level) {
        await logSystemAdminActivity(req.user.email, 'permission_denied', {
          requiredPermission,
          userLevel: userPermissionLevel,
          requiredLevel: permission.level,
          endpoint: req.path,
          severity: 'medium'
        });

        return res.status(403).json({
          success: false,
          message: `Insufficient permissions for ${permission.description}`,
          code: 'INSUFFICIENT_PERMISSIONS',
          requiredPermission,
          requiredLevel: permission.level
        });
      }

      // Log permission granted
      await logSystemAdminActivity(req.user.email, 'permission_granted', {
        permission: requiredPermission,
        endpoint: req.path,
        method: req.method,
        severity: 'low'
      });

      // Add permission info to request
      req.systemAdminPermission = {
        permission: requiredPermission,
        level: permission.level,
        description: permission.description,
        grantedAt: new Date()
      };

      next();

    } catch (error) {
      console.error('System admin permission validation error:', error);
      return res.status(500).json({
        success: false,
        message: 'Permission validation error',
        code: 'PERMISSION_VALIDATION_ERROR'
      });
    }
  };
};

/**
 * Audit Logging Validation
 * Ensures proper audit logging for system admin operations
 */
const validateAuditLogging = (operationType, options = {}) => {
  return async (req, res, next) => {
    try {
      // Ensure system admin context
      if (!req.user || req.user.role !== ROLES.SYSTEM_ADMIN) {
        return next(); // Skip audit logging for non-system admin users
      }

      // Prepare audit context
      const auditContext = {
        operationType,
        systemAdminEmail: req.user.email,
        endpoint: req.path,
        method: req.method,
        timestamp: new Date(),
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        sessionId: req.sessionID || `sa_${Date.now()}`,
        requestId: req.id || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      // Add sensitive data indicators
      const sensitiveOperations = [
        'user_impersonation',
        'password_reset',
        'account_deactivation',
        'data_export',
        'system_config_change'
      ];

      if (sensitiveOperations.includes(operationType)) {
        auditContext.sensitivity = 'high';
        auditContext.requiresApproval = options.requiresApproval || false;
      }

      // Add cross-school context if applicable
      if (req.body.schoolIds || req.query.schoolIds || req.params.schoolId) {
        auditContext.crossSchoolOperation = true;
        auditContext.affectedSchools = req.body.schoolIds || 
                                      req.query.schoolIds || 
                                      [req.params.schoolId];
      }

      // Store audit context in request
      req.auditContext = auditContext;

      // Log operation start
      await logSystemAdminActivity(req.user.email, `${operationType}_started`, {
        ...auditContext,
        stage: 'validation',
        severity: auditContext.sensitivity === 'high' ? 'high' : 'medium'
      });

      next();

    } catch (error) {
      console.error('Audit logging validation error:', error);
      // Don't fail the request due to audit logging issues, but log the error
      await logSystemAdminActivity(
        req.user?.email || 'unknown',
        'audit_logging_error',
        {
          error: error.message,
          operationType,
          endpoint: req.path,
          severity: 'high'
        }
      );
      next();
    }
  };
};

/**
 * Complete Audit Log
 * Middleware to complete audit logging after operation
 */
const completeAuditLog = async (req, res, next) => {
  // Store original res.json to intercept response
  const originalJson = res.json;
  
  res.json = function(data) {
    // Complete audit logging if context exists
    if (req.auditContext && req.user && req.user.role === ROLES.SYSTEM_ADMIN) {
      const completionData = {
        ...req.auditContext,
        stage: 'completion',
        statusCode: res.statusCode,
        success: res.statusCode < 400,
        completedAt: new Date(),
        duration: Date.now() - req.auditContext.timestamp.getTime(),
        responseSize: JSON.stringify(data).length
      };

      // Log completion (don't await to avoid blocking response)
      logSystemAdminActivity(
        req.user.email,
        `${req.auditContext.operationType}_completed`,
        completionData
      ).catch(error => {
        console.error('Audit completion logging error:', error);
      });
    }

    // Call original json method
    return originalJson.call(this, data);
  };

  next();
};

/**
 * Sanitize System Admin Input
 * Removes potentially dangerous content from requests
 */
const sanitizeSystemAdminInput = (req, res, next) => {
  try {
    // Remove dangerous prototype pollution attempts
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    
    const sanitizeObject = (obj) => {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      for (const key of dangerousKeys) {
        delete obj[key];
      }
      
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          obj[key] = sanitizeObject(value);
        }
      }
      
      return obj;
    };

    // Sanitize request body, query, and params
    if (req.body) req.body = sanitizeObject(req.body);
    if (req.query) req.query = sanitizeObject(req.query);
    if (req.params) req.params = sanitizeObject(req.params);

    next();

  } catch (error) {
    console.error('Input sanitization error:', error);
    return res.status(400).json({
      success: false,
      message: 'Invalid request format',
      code: 'INPUT_SANITIZATION_ERROR'
    });
  }
};

/**
 * Create System Admin Validation Chain
 * Combines multiple validation middlewares
 */
const createSystemAdminValidationChain = (actionType, permission, options = {}) => {
  return [
    sanitizeSystemAdminInput,
    validateAuditLogging(actionType, options),
    validateSystemAdminPermission(permission, options),
    ...validateSystemAdminAction(actionType),
    completeAuditLog
  ];
};

module.exports = {
  handleValidationErrors,
  validateCrossSchoolOperation,
  validateSystemAdminAction,
  validateSystemAdminPermission,
  validateAuditLogging,
  completeAuditLog,
  sanitizeSystemAdminInput,
  createSystemAdminValidationChain
};