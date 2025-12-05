const {
  ROLES,
  ROLE_HIERARCHY,
  requireRole,
  requireAdmin,
  requireTeacher,
  requireSchoolAdmin,
  validateSchoolAccess,
  validateResourceOwnership,
  validateParentAccess,
  validateTeacherAccess,
  preventCrossSchoolAccess,
  validateEndpointPermissions,
  createRBACChain,
  auditLog,
  combineMiddleware
} = require('../rbac');

describe('RBAC Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: null,
      params: {},
      body: {},
      query: {},
      headers: {},
      method: 'GET',
      path: '/test',
      ip: '127.0.0.1'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
  });

  describe('Role Requirements', () => {
    test('requireAdmin should allow admin users', () => {
      req.user = { role: ROLES.ADMIN, schoolId: 'school1' };
      
      requireAdmin(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('requireAdmin should deny non-admin users', () => {
      req.user = { role: ROLES.TEACHER, schoolId: 'school1' };
      
      requireAdmin(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions',
        required: ROLES.ADMIN,
        current: ROLES.TEACHER
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('requireTeacher should allow teacher and admin users', () => {
      req.user = { role: ROLES.TEACHER, schoolId: 'school1' };
      
      requireTeacher(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('requireTeacher should deny parent users', () => {
      req.user = { role: ROLES.PARENT, schoolId: 'school1' };
      
      requireTeacher(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('School Access Validation', () => {
    test('validateSchoolAccess should allow same school access', () => {
      req.user = { role: ROLES.TEACHER, schoolId: 'school1' };
      req.params.schoolId = 'school1';
      
      validateSchoolAccess(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('validateSchoolAccess should deny cross-school access', () => {
      req.user = { role: ROLES.TEACHER, schoolId: 'school1' };
      req.params.schoolId = 'school2';
      
      validateSchoolAccess(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied to this school',
        code: 'CROSS_SCHOOL_ACCESS_DENIED'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('preventCrossSchoolAccess should allow requests without school ID', () => {
      req.user = { role: ROLES.TEACHER, schoolId: 'school1' };
      
      preventCrossSchoolAccess(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('preventCrossSchoolAccess should deny multiple school access', () => {
      req.user = { role: ROLES.TEACHER, schoolId: 'school1' };
      req.params.schoolId = 'school2';
      req.body.schoolId = 'school3';
      
      preventCrossSchoolAccess(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Cross-school access denied',
        code: 'CROSS_SCHOOL_ACCESS_DENIED',
        userSchool: 'school1',
        requestedSchools: ['school2', 'school3']
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Resource Ownership Validation', () => {
    test('validateResourceOwnership should allow admin access to any resource', () => {
      req.user = { role: ROLES.ADMIN, schoolId: 'school1', id: 'admin1' };
      req.params.id = 'user123';
      
      const middleware = validateResourceOwnership('user');
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('validateResourceOwnership should allow users to access their own profile', () => {
      req.user = { role: ROLES.TEACHER, schoolId: 'school1', id: 'teacher1' };
      req.params.id = 'teacher1';
      
      const middleware = validateResourceOwnership('user');
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('validateResourceOwnership should deny parents access to other users', () => {
      req.user = { role: ROLES.PARENT, schoolId: 'school1', id: 'parent1' };
      req.params.id = 'teacher1';
      
      const middleware = validateResourceOwnership('user');
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Parents can only access their own profile',
        code: 'RESOURCE_ACCESS_DENIED'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('validateResourceOwnership should require admin for teacher management', () => {
      req.user = { role: ROLES.TEACHER, schoolId: 'school1', id: 'teacher1' };
      req.params.id = 'teacher2';
      
      const middleware = validateResourceOwnership('teacher');
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Admin access required for teacher management',
        code: 'RESOURCE_ACCESS_DENIED'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Parent Access Validation', () => {
    test('validateParentAccess should allow admin and teacher access', () => {
      req.user = { role: ROLES.ADMIN, schoolId: 'school1', id: 'admin1' };
      
      validateParentAccess(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('validateParentAccess should set validation flags for parents', () => {
      req.user = { role: ROLES.PARENT, schoolId: 'school1', id: 'parent1' };
      req.params.studentId = 'student1';
      
      validateParentAccess(req, res, next);
      
      expect(req.parentAccessValidationRequired).toBe(true);
      expect(req.requestedStudentId).toBe('student1');
      expect(req.parentValidation).toEqual({
        parentId: 'parent1',
        schoolId: 'school1',
        requestedStudentId: 'student1'
      });
      expect(next).toHaveBeenCalled();
    });

    test('validateParentAccess should deny invalid roles', () => {
      req.user = { role: 'invalid_role', schoolId: 'school1', id: 'user1' };
      
      validateParentAccess(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied - invalid role for this operation',
        code: 'INVALID_ROLE_ACCESS'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Teacher Access Validation', () => {
    test('validateTeacherAccess should allow admin access', () => {
      req.user = { role: ROLES.ADMIN, schoolId: 'school1', id: 'admin1' };
      
      validateTeacherAccess(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('validateTeacherAccess should set validation flags for teachers', () => {
      req.user = { 
        role: ROLES.TEACHER, 
        schoolId: 'school1', 
        id: 'teacher1',
        classes: ['class1', 'class2'],
        subjects: ['math', 'science']
      };
      req.params.classId = 'class1';
      req.params.studentId = 'student1';
      
      validateTeacherAccess(req, res, next);
      
      expect(req.teacherAccessValidationRequired).toBe(true);
      expect(req.teacherValidation).toEqual({
        teacherId: 'teacher1',
        schoolId: 'school1',
        requestedClassId: 'class1',
        requestedStudentId: 'student1',
        teacherClasses: ['class1', 'class2'],
        teacherSubjects: ['math', 'science']
      });
      expect(next).toHaveBeenCalled();
    });

    test('validateTeacherAccess should deny parent access', () => {
      req.user = { role: ROLES.PARENT, schoolId: 'school1', id: 'parent1' };
      
      validateTeacherAccess(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Teacher access required - parents cannot access this resource',
        code: 'INSUFFICIENT_ROLE_PERMISSIONS'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Endpoint Permissions', () => {
    test('validateEndpointPermissions should allow admin-only access for admins', () => {
      req.user = { role: ROLES.ADMIN, schoolId: 'school1', id: 'admin1' };
      
      const middleware = validateEndpointPermissions('admin-only');
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(req.permissionValidation).toEqual({
        endpointType: 'admin-only',
        userRole: ROLES.ADMIN,
        allowedRoles: [ROLES.ADMIN],
        timestamp: expect.any(Date)
      });
    });

    test('validateEndpointPermissions should deny admin-only access for teachers', () => {
      req.user = { role: ROLES.TEACHER, schoolId: 'school1', id: 'teacher1' };
      
      const middleware = validateEndpointPermissions('admin-only');
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: `Access denied. Required roles: ${ROLES.ADMIN}`,
        code: 'INSUFFICIENT_PERMISSIONS',
        userRole: ROLES.TEACHER,
        requiredRoles: [ROLES.ADMIN]
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('validateEndpointPermissions should handle school-admin-only access', () => {
      req.user = { 
        role: ROLES.ADMIN, 
        schoolId: 'school1', 
        id: 'admin1',
        isSchoolAdmin: true
      };
      
      const middleware = validateEndpointPermissions('school-admin-only');
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Audit Logging', () => {
    test('auditLog should set audit information', () => {
      req.user = { role: ROLES.ADMIN, schoolId: 'school1', id: 'admin1' };
      req.method = 'POST';
      req.path = '/api/users';
      req.params = { id: 'user1' };
      req.query = { filter: 'active' };
      req.get = jest.fn().mockReturnValue('Mozilla/5.0');
      
      const middleware = auditLog('CREATE_USER');
      middleware(req, res, next);
      
      expect(req.auditLog).toEqual({
        operation: 'CREATE_USER',
        userId: 'admin1',
        userRole: ROLES.ADMIN,
        schoolId: 'school1',
        timestamp: expect.any(Date),
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        method: 'POST',
        path: '/api/users',
        params: { id: 'user1' },
        query: { filter: 'active' }
      });
      expect(next).toHaveBeenCalled();
    });
  });

  describe('RBAC Chain Creation', () => {
    test('createRBACChain should combine multiple middlewares', () => {
      req.user = { 
        role: ROLES.ADMIN, 
        schoolId: 'school1', 
        id: 'admin1',
        isSchoolAdmin: true
      };
      
      const chain = createRBACChain({
        requiredRole: ROLES.ADMIN,
        endpointType: 'admin-only',
        validateSchool: true,
        validateResource: true,
        resourceType: 'user'
      });
      
      chain(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Authentication Requirements', () => {
    test('should require authentication for all protected endpoints', () => {
      req.user = null;
      
      requireAdmin(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});