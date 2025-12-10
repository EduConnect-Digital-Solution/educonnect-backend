/**
 * System Admin Authentication Middleware Tests
 * Simple tests for system admin authentication middleware
 */

const {
  requireSystemAdmin,
  validateCrossSchoolAccess,
  auditSystemOperation
} = require('../systemAdminAuth');

// Mock dependencies
jest.mock('../../services/systemAdminAuthService');
jest.mock('../rbac', () => ({
  ROLES: {
    SYSTEM_ADMIN: 'system_admin',
    ADMIN: 'admin',
    TEACHER: 'teacher',
    PARENT: 'parent'
  }
}));

describe('SystemAdminAuth Middleware', () => {
  let req, res, next;
  let mockVerifySystemAdminToken;

  beforeEach(() => {
    // Mock request, response, and next
    req = {
      headers: {},
      user: null,
      systemAdmin: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();

    // Get mocked service
    mockVerifySystemAdminToken = require('../../services/systemAdminAuthService').verifySystemAdminToken;
    
    jest.clearAllMocks();
  });

  describe('requireSystemAdmin', () => {
    it('should authenticate valid system admin token', () => {
      // Mock valid token
      req.headers.authorization = 'Bearer valid-token';
      mockVerifySystemAdminToken.mockReturnValue({
        email: 'admin@test.com',
        role: 'system_admin',
        crossSchoolAccess: true,
        systemAdminLevel: 'super',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      });

      requireSystemAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.role).toBe('system_admin');
      expect(req.user.email).toBe('admin@test.com');
      expect(req.systemAdmin).toBeDefined();
    });

    it('should reject request without authorization header', () => {
      requireSystemAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'System admin authentication required',
        code: 'MISSING_AUTH_TOKEN'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid token format', () => {
      req.headers.authorization = 'InvalidFormat token';

      requireSystemAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'System admin authentication required',
        code: 'MISSING_AUTH_TOKEN'
      });
    });

    it('should reject invalid token', () => {
      req.headers.authorization = 'Bearer invalid-token';
      mockVerifySystemAdminToken.mockReturnValue(null);

      requireSystemAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid or expired system admin token',
        code: 'INVALID_AUTH_TOKEN'
      });
    });

    it('should reject non-system-admin role', () => {
      req.headers.authorization = 'Bearer valid-token';
      mockVerifySystemAdminToken.mockReturnValue({
        email: 'user@test.com',
        role: 'admin', // Not system_admin
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      });

      requireSystemAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'System administrator access required',
        code: 'INSUFFICIENT_PRIVILEGES'
      });
    });
  });

  describe('validateCrossSchoolAccess', () => {
    beforeEach(() => {
      req.user = {
        email: 'admin@test.com',
        role: 'system_admin',
        crossSchoolAccess: true,
        systemAdminLevel: 'super'
      };
    });

    it('should allow cross-school access for system admin', () => {
      validateCrossSchoolAccess(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.crossSchoolContext).toBeDefined();
      expect(req.crossSchoolContext.authorized).toBe(true);
    });

    it('should reject non-system-admin users', () => {
      req.user.role = 'admin';

      validateCrossSchoolAccess(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'System administrator access required for cross-school operations',
        code: 'CROSS_SCHOOL_ACCESS_DENIED'
      });
    });

    it('should reject users without cross-school access flag', () => {
      req.user.crossSchoolAccess = false;

      validateCrossSchoolAccess(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Cross-school access not authorized',
        code: 'CROSS_SCHOOL_ACCESS_NOT_AUTHORIZED'
      });
    });

    it('should reject unauthenticated requests', () => {
      req.user = null;

      validateCrossSchoolAccess(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'System administrator access required for cross-school operations',
        code: 'CROSS_SCHOOL_ACCESS_DENIED'
      });
    });
  });

  describe('auditSystemOperation', () => {
    beforeEach(() => {
      req.user = {
        email: 'admin@test.com',
        role: 'system_admin'
      };
      req.method = 'POST';
      req.path = '/api/system-admin/test';
      req.query = { param: 'value' };
      req.body = { data: 'test' };
      req.ip = '127.0.0.1';
      req.get = jest.fn().mockReturnValue('Test User Agent');
    });

    it('should create audit log for system admin operations', async () => {
      const middleware = auditSystemOperation('test_operation');
      
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.auditData).toBeDefined();
      expect(req.auditData.operationType).toBe('test_operation');
      expect(req.auditData.systemAdminEmail).toBe('admin@test.com');
      expect(req.auditData.method).toBe('POST');
      expect(req.auditData.path).toBe('/api/system-admin/test');
    });

    it('should skip audit for non-system-admin users', async () => {
      req.user.role = 'admin';
      const middleware = auditSystemOperation('test_operation');
      
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.auditData).toBeUndefined();
    });

    it('should handle missing user gracefully', async () => {
      req.user = null;
      const middleware = auditSystemOperation('test_operation');
      
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.auditData).toBeUndefined();
    });

    it('should continue on audit logging errors', async () => {
      // Mock console.log to avoid test output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const middleware = auditSystemOperation('test_operation');
      
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
});