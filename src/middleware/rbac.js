/**
 * Role-Based Access Control (RBAC) Middleware
 * Implements permission system for different user roles
 */

/**
 * Role hierarchy and permissions
 */
const ROLES = {
  SYSTEM_ADMIN: 'system_admin',  // NEW: Platform-wide access
  ADMIN: 'admin',
  TEACHER: 'teacher', 
  PARENT: 'parent'
};

const ROLE_HIERARCHY = {
  [ROLES.SYSTEM_ADMIN]: 4,       // NEW: Highest privilege level
  [ROLES.ADMIN]: 3,
  [ROLES.TEACHER]: 2,
  [ROLES.PARENT]: 1
};

/**
 * Check if user has required role or higher
 * Can accept either a single role string or an array of allowed roles
 */
const requireRole = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Handle both single role and array of roles
    const allowedRoles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    
    // Check if user's role is in the allowed roles
    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    // For backward compatibility, also check role hierarchy
    const userRoleLevel = ROLE_HIERARCHY[req.user.role];
    const hasAccess = allowedRoles.some(role => {
      const requiredRoleLevel = ROLE_HIERARCHY[role];
      return userRoleLevel && requiredRoleLevel && userRoleLevel >= requiredRoleLevel;
    });

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        required: allowedRoles,
        current: req.user.role
      });
    }

    next();
  };
};

/**
 * Require admin role specifically
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.SYSTEM_ADMIN) {
    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions',
      required: 'admin',
      current: req.user.role
    });
  }

  next();
};

/**
 * Require teacher role or higher
 */
const requireTeacher = requireRole(ROLES.TEACHER);

/**
 * Require system admin role specifically
 */
const requireSystemAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== ROLES.SYSTEM_ADMIN) {
    return res.status(403).json({
      success: false,
      message: 'System administrator access required',
      code: 'SYSTEM_ADMIN_REQUIRED'
    });
  }

  next();
};

/**
 * Require school admin specifically (admin role + isSchoolAdmin flag)
 */
const requireSchoolAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== ROLES.ADMIN || !req.user.isSchoolAdmin) {
    return res.status(403).json({
      success: false,
      message: 'School admin access required'
    });
  }

  next();
};

/**
 * Validate school access - ensures user can only access their school's data
 */
const validateSchoolAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Extract schoolId from various possible locations
  const requestedSchoolId = req.params.schoolId || 
                           req.body.schoolId || 
                           req.query.schoolId;

  // If no schoolId in request, user can only access their own school
  if (!requestedSchoolId) {
    return next();
  }

  // Validate user can access the requested school
  if (req.user.schoolId !== requestedSchoolId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied to this school',
      code: 'CROSS_SCHOOL_ACCESS_DENIED'
    });
  }

  next();
};

/**
 * Resource ownership validation
 * Ensures users can only access resources they own or have permission to access
 */
const validateResourceOwnership = (resourceType, options = {}) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    try {
      const resourceId = req.params.id || 
                        req.params.userId || 
                        req.params.studentId || 
                        req.params.teacherId ||
                        req.params.parentId ||
                        req.body.id ||
                        req.body.userId ||
                        req.body.studentId;
      
      if (!resourceId && !options.requireResourceId) {
        return next(); // No specific resource to validate
      }

      // Admin can access all resources in their school (requirement 6.2)
      if (req.user.role === ROLES.ADMIN) {
        return next();
      }

      // Store resource info for controller validation
      req.resourceValidation = {
        resourceType,
        resourceId,
        userRole: req.user.role,
        userId: req.user.id,
        schoolId: req.user.schoolId
      };

      // For teachers and parents, implement specific validation logic
      switch (resourceType) {
        case 'user':
          // Users can access their own profile
          if (resourceId === req.user.id) {
            return next();
          }
          
          // Teachers can access other users in their school (limited scope)
          if (req.user.role === ROLES.TEACHER) {
            req.teacherAccessValidationRequired = true;
            return next();
          }
          
          // Parents can only access their own profile
          if (req.user.role === ROLES.PARENT) {
            return res.status(403).json({
              success: false,
              message: 'Parents can only access their own profile',
              code: 'RESOURCE_ACCESS_DENIED'
            });
          }
          break;
          
        case 'student':
          // Teachers can access students in their classes (requirement 6.3)
          if (req.user.role === ROLES.TEACHER) {
            req.teacherAccessValidationRequired = true;
            req.requestedStudentId = resourceId;
            return next();
          }
          
          // Parents can access their children (requirement 6.4)
          if (req.user.role === ROLES.PARENT) {
            req.parentAccessValidationRequired = true;
            req.requestedStudentId = resourceId;
            return next();
          }
          break;
          
        case 'teacher':
          // Only admins can manage teachers
          if (req.user.role !== ROLES.ADMIN) {
            return res.status(403).json({
              success: false,
              message: 'Admin access required for teacher management',
              code: 'RESOURCE_ACCESS_DENIED'
            });
          }
          break;
          
        case 'parent':
          // Only admins can manage parents
          if (req.user.role !== ROLES.ADMIN) {
            return res.status(403).json({
              success: false,
              message: 'Admin access required for parent management',
              code: 'RESOURCE_ACCESS_DENIED'
            });
          }
          break;
          
        case 'school':
          // Only school admins can manage school data
          if (req.user.role !== ROLES.ADMIN || !req.user.isSchoolAdmin) {
            return res.status(403).json({
              success: false,
              message: 'School admin access required',
              code: 'RESOURCE_ACCESS_DENIED'
            });
          }
          break;
          
        default:
          // For unknown resource types, deny access unless admin
          if (req.user.role !== ROLES.ADMIN) {
            return res.status(403).json({
              success: false,
              message: 'Access denied to this resource type',
              code: 'RESOURCE_ACCESS_DENIED'
            });
          }
          break;
      }

      next();

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error validating resource access',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
};

/**
 * Parent access validation - ensures parents can only access their children's data (requirement 6.4)
 */
const validateParentAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Admin and teachers have broader access (requirements 6.2, 6.3)
  if (req.user.role === ROLES.ADMIN || req.user.role === ROLES.TEACHER) {
    return next();
  }

  // For parents, validate they can only access their children's data
  if (req.user.role === ROLES.PARENT) {
    const studentId = req.params.studentId || 
                     req.body.studentId || 
                     req.query.studentId ||
                     req.params.id; // In case the student ID is in the main ID param
    
    if (studentId) {
      // Mark for validation in controller where we have access to models
      req.parentAccessValidationRequired = true;
      req.requestedStudentId = studentId;
      req.parentUserId = req.user.id;
    }
    
    // Store parent info for any additional validation needed
    req.parentValidation = {
      parentId: req.user.id,
      schoolId: req.user.schoolId,
      requestedStudentId: studentId
    };
    
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied - invalid role for this operation',
    code: 'INVALID_ROLE_ACCESS'
  });
};

/**
 * Teacher access validation - ensures teachers can only access their assigned students/classes (requirement 6.3)
 */
const validateTeacherAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Admin has full access (requirement 6.2)
  if (req.user.role === ROLES.ADMIN) {
    return next();
  }

  // For teachers, validate they can only access their assigned classes/students
  if (req.user.role === ROLES.TEACHER) {
    const classId = req.params.classId || 
                   req.body.classId || 
                   req.query.classId ||
                   req.body.class;
                   
    const studentId = req.params.studentId || 
                     req.body.studentId || 
                     req.query.studentId ||
                     req.params.id; // In case student ID is in main ID param
    
    // Store teacher validation info for controller
    req.teacherValidation = {
      teacherId: req.user.id,
      schoolId: req.user.schoolId,
      requestedClassId: classId,
      requestedStudentId: studentId,
      teacherClasses: req.user.classes || [], // Will be populated from JWT
      teacherSubjects: req.user.subjects || [] // Will be populated from JWT
    };
    
    if (classId || studentId) {
      // Mark for validation in controller where we have access to models
      req.teacherAccessValidationRequired = true;
      req.requestedClassId = classId;
      req.requestedStudentId = studentId;
    }
    
    return next();
  }

  // Parents cannot access teacher-specific resources
  if (req.user.role === ROLES.PARENT) {
    return res.status(403).json({
      success: false,
      message: 'Teacher access required - parents cannot access this resource',
      code: 'INSUFFICIENT_ROLE_PERMISSIONS'
    });
  }

  return res.status(403).json({
    success: false,
    message: 'Teacher access required',
    code: 'TEACHER_ACCESS_REQUIRED'
  });
};

/**
 * Validate cross-school access prevention (requirement 6.5)
 * Enhanced version that checks multiple possible school ID locations
 * System admins are allowed cross-school access
 */
const preventCrossSchoolAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // System admins have cross-school access
  if (req.user.role === ROLES.SYSTEM_ADMIN) {
    return next();
  }

  // Extract all possible school IDs from request
  const requestSchoolIds = [
    req.params.schoolId,
    req.body.schoolId,
    req.query.schoolId,
    req.headers['x-school-id']
  ].filter(Boolean);

  // If no school ID specified in request, user accesses their own school
  if (requestSchoolIds.length === 0) {
    return next();
  }

  // Check all specified school IDs match user's school
  const userSchoolId = req.user.schoolId;
  const hasInvalidAccess = requestSchoolIds.some(schoolId => schoolId !== userSchoolId);

  if (hasInvalidAccess) {
    return res.status(403).json({
      success: false,
      message: 'Cross-school access denied',
      code: 'CROSS_SCHOOL_ACCESS_DENIED',
      userSchool: userSchoolId,
      requestedSchools: requestSchoolIds
    });
  }

  next();
};

/**
 * Validate cross-school access for system admins
 * Allows system admins to access any school while logging the operation
 */
const validateCrossSchoolAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Only system admins can use this middleware
  if (req.user.role !== ROLES.SYSTEM_ADMIN) {
    return res.status(403).json({
      success: false,
      message: 'System administrator access required for cross-school operations',
      code: 'SYSTEM_ADMIN_REQUIRED'
    });
  }

  // Log cross-school access for audit purposes
  const requestedSchoolIds = [
    req.params.schoolId,
    req.body.schoolId,
    req.query.schoolId,
    req.headers['x-school-id']
  ].filter(Boolean);

  if (requestedSchoolIds.length > 0) {
    req.crossSchoolAccess = {
      systemAdminId: req.user.id,
      requestedSchools: requestedSchoolIds,
      timestamp: new Date(),
      operation: `${req.method} ${req.path}`
    };
  }

  next();
};

/**
 * Validate endpoint permissions based on user role and endpoint type
 */
const validateEndpointPermissions = (endpointType, requiredPermissions = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userRole = req.user.role;
    
    // Define endpoint permissions
    const endpointPermissions = {
      'system-admin-only': [ROLES.SYSTEM_ADMIN],
      'admin-only': [ROLES.SYSTEM_ADMIN, ROLES.ADMIN],
      'teacher-admin': [ROLES.SYSTEM_ADMIN, ROLES.ADMIN, ROLES.TEACHER],
      'all-authenticated': [ROLES.SYSTEM_ADMIN, ROLES.ADMIN, ROLES.TEACHER, ROLES.PARENT],
      'school-admin-only': [], // Special case handled below
      'read-only': [ROLES.SYSTEM_ADMIN, ROLES.ADMIN, ROLES.TEACHER, ROLES.PARENT],
      'write-restricted': [ROLES.SYSTEM_ADMIN, ROLES.ADMIN, ROLES.TEACHER]
    };

    // Special case for school admin
    if (endpointType === 'school-admin-only') {
      if (userRole !== ROLES.ADMIN || !req.user.isSchoolAdmin) {
        return res.status(403).json({
          success: false,
          message: 'School administrator access required',
          code: 'SCHOOL_ADMIN_REQUIRED'
        });
      }
      return next();
    }

    // Check if user role is allowed for this endpoint type
    const allowedRoles = endpointPermissions[endpointType] || requiredPermissions;
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
        code: 'INSUFFICIENT_PERMISSIONS',
        userRole,
        requiredRoles: allowedRoles
      });
    }

    // Store permission info for logging/auditing
    req.permissionValidation = {
      endpointType,
      userRole,
      allowedRoles,
      timestamp: new Date()
    };

    next();
  };
};

/**
 * Create a comprehensive RBAC middleware chain
 */
const createRBACChain = (options = {}) => {
  const {
    requireAuth = true,
    requiredRole = null,
    resourceType = null,
    endpointType = null,
    validateSchool = true,
    validateResource = false
  } = options;

  const middlewares = [];

  // Always validate school access to prevent cross-school data access
  if (validateSchool) {
    middlewares.push(preventCrossSchoolAccess);
  }

  // Add role requirement if specified
  if (requiredRole) {
    middlewares.push(requireRole(requiredRole));
  }

  // Add endpoint permission validation
  if (endpointType) {
    middlewares.push(validateEndpointPermissions(endpointType));
  }

  // Add resource ownership validation
  if (validateResource && resourceType) {
    middlewares.push(validateResourceOwnership(resourceType));
  }

  return combineMiddleware(...middlewares);
};

/**
 * Audit logging middleware for sensitive operations
 */
const auditLog = (operation) => {
  return (req, res, next) => {
    // Store audit info for logging in controller
    req.auditLog = {
      operation,
      userId: req.user?.id,
      userRole: req.user?.role,
      schoolId: req.user?.schoolId,
      timestamp: new Date(),
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      method: req.method,
      path: req.path,
      params: req.params,
      query: req.query
    };
    
    next();
  };
};

/**
 * Enhanced audit logging for system admin operations
 */
const auditSystemOperation = (operation) => {
  return (req, res, next) => {
    // Enhanced audit info for system admin operations
    req.systemAuditLog = {
      operation,
      systemAdminId: req.user?.id,
      userRole: req.user?.role,
      timestamp: new Date(),
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      method: req.method,
      path: req.path,
      params: req.params,
      query: req.query,
      body: req.method !== 'GET' ? req.body : undefined,
      crossSchoolAccess: req.crossSchoolAccess || null,
      severity: 'high' // System admin operations are high severity
    };
    
    next();
  };
};

/**
 * Helper function to check if user has permission for specific action
 */
const hasPermission = (user, action, resource = null) => {
  if (!user || !user.role) {
    return false;
  }

  const permissions = {
    [ROLES.SYSTEM_ADMIN]: {
      canManageUsers: true,
      canManageSchool: true,
      canViewAllData: true,
      canModifyAllData: true,
      canAccessAnalytics: true,
      canManageInvitations: true,
      canAccessCrossSchool: true,
      canManagePlatform: true,
      canViewSystemHealth: true,
      canManageSystemConfig: true,
      canImpersonateUsers: true,
      canAccessAuditLogs: true
    },
    [ROLES.ADMIN]: {
      canManageUsers: true,
      canManageSchool: true,
      canViewAllData: true,
      canModifyAllData: true,
      canAccessAnalytics: true,
      canManageInvitations: true,
      canAccessCrossSchool: false,
      canManagePlatform: false,
      canViewSystemHealth: false,
      canManageSystemConfig: false,
      canImpersonateUsers: false,
      canAccessAuditLogs: false
    },
    [ROLES.TEACHER]: {
      canManageUsers: false,
      canManageSchool: false,
      canViewAllData: false,
      canModifyAllData: false,
      canAccessAnalytics: false,
      canManageInvitations: false,
      canViewOwnClasses: true,
      canModifyOwnClasses: true,
      canViewAssignedStudents: true,
      canAccessCrossSchool: false,
      canManagePlatform: false,
      canViewSystemHealth: false,
      canManageSystemConfig: false,
      canImpersonateUsers: false,
      canAccessAuditLogs: false
    },
    [ROLES.PARENT]: {
      canManageUsers: false,
      canManageSchool: false,
      canViewAllData: false,
      canModifyAllData: false,
      canAccessAnalytics: false,
      canManageInvitations: false,
      canViewOwnChildren: true,
      canModifyOwnProfile: true,
      canAccessCrossSchool: false,
      canManagePlatform: false,
      canViewSystemHealth: false,
      canManageSystemConfig: false,
      canImpersonateUsers: false,
      canAccessAuditLogs: false
    }
  };

  const userPermissions = permissions[user.role] || {};
  return userPermissions[action] || false;
};

/**
 * Middleware to check specific permissions
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({
        success: false,
        message: `Permission denied: ${permission}`,
        code: 'PERMISSION_DENIED',
        userRole: req.user.role,
        requiredPermission: permission
      });
    }

    next();
  };
};

/**
 * Dynamic permission checker for complex scenarios
 */
const checkDynamicPermission = (permissionChecker) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    try {
      const hasAccess = await permissionChecker(req.user, req);
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied based on dynamic permission check',
          code: 'DYNAMIC_PERMISSION_DENIED'
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking permissions',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
};

/**
 * Combine multiple middleware functions
 */
const combineMiddleware = (...middlewares) => {
  return (req, res, next) => {
    const executeMiddleware = (index) => {
      if (index >= middlewares.length) {
        return next();
      }
      
      middlewares[index](req, res, (err) => {
        if (err) {
          return next(err);
        }
        executeMiddleware(index + 1);
      });
    };
    
    executeMiddleware(0);
  };
};

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  requireRole,
  requireAdmin,
  requireTeacher,
  requireSystemAdmin,
  requireSchoolAdmin,
  validateSchoolAccess,
  validateResourceOwnership,
  validateParentAccess,
  validateTeacherAccess,
  preventCrossSchoolAccess,
  validateCrossSchoolAccess,
  validateEndpointPermissions,
  createRBACChain,
  auditLog,
  auditSystemOperation,
  hasPermission,
  requirePermission,
  checkDynamicPermission,
  combineMiddleware
};