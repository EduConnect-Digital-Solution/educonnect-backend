/**
 * System Admin Authentication Service Tests
 * Simple tests for system admin authentication service
 */

// Mock dependencies first
jest.mock('bcrypt');
jest.mock('jsonwebtoken');
jest.mock('../../utils/catchAsync', () => (fn) => fn);

const {
  validateSystemAdminCredentials,
  generateSystemAdminToken,
  verifySystemAdminToken,
  loginSystemAdmin,
  isSystemAdminConfigured
} = require('../systemAdminAuthService');

describe('SystemAdminAuthService', () => {
  let mockBcrypt, mockJwt;

  beforeEach(() => {
    mockBcrypt = require('bcrypt');
    mockJwt = require('jsonwebtoken');
    
    jest.clearAllMocks();
    
    // Set up environment variables
    process.env.SYSTEM_ADMIN_EMAIL = 'admin@test.com';
    process.env.SYSTEM_ADMIN_PASSWORD_HASH = '$2b$12$hashedpassword';
    process.env.JWT_SECRET = 'test-secret';
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.SYSTEM_ADMIN_EMAIL;
    delete process.env.SYSTEM_ADMIN_PASSWORD_HASH;
    delete process.env.JWT_SECRET;
  });

  describe('validateSystemAdminCredentials', () => {
    it('should validate correct credentials', async () => {
      mockBcrypt.compare.mockResolvedValue(true);

      const result = await validateSystemAdminCredentials('admin@test.com', 'correctpassword');

      expect(result).toBe(true);
      expect(mockBcrypt.compare).toHaveBeenCalledWith('correctpassword', '$2b$12$hashedpassword');
    });

    it('should reject incorrect email', async () => {
      const result = await validateSystemAdminCredentials('wrong@test.com', 'password');

      expect(result).toBe(false);
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should reject incorrect password', async () => {
      mockBcrypt.compare.mockResolvedValue(false);

      const result = await validateSystemAdminCredentials('admin@test.com', 'wrongpassword');

      expect(result).toBe(false);
      expect(mockBcrypt.compare).toHaveBeenCalledWith('wrongpassword', '$2b$12$hashedpassword');
    });

    it('should return false when credentials not configured', async () => {
      delete process.env.SYSTEM_ADMIN_EMAIL;
      delete process.env.SYSTEM_ADMIN_PASSWORD_HASH;

      const result = await validateSystemAdminCredentials('admin@test.com', 'password');

      expect(result).toBe(false);
    });

    it('should handle bcrypt errors gracefully', async () => {
      mockBcrypt.compare.mockRejectedValue(new Error('Bcrypt error'));

      const result = await validateSystemAdminCredentials('admin@test.com', 'password');

      expect(result).toBe(false);
    });
  });

  describe('generateSystemAdminToken', () => {
    it('should generate valid JWT token', () => {
      mockJwt.sign.mockReturnValue('mock-jwt-token');

      const token = generateSystemAdminToken('admin@test.com');

      expect(token).toBe('mock-jwt-token');
      expect(mockJwt.sign).toHaveBeenCalledWith(
        {
          email: 'admin@test.com',
          role: 'system_admin',
          crossSchoolAccess: true,
          systemAdminLevel: 'super',
          type: 'system_admin'
        },
        'test-secret',
        { expiresIn: '8h' }
      );
    });

    it('should use custom JWT secret if provided', () => {
      process.env.SYSTEM_ADMIN_JWT_SECRET = 'custom-secret';
      mockJwt.sign.mockReturnValue('mock-jwt-token');

      generateSystemAdminToken('admin@test.com');

      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.any(Object),
        'custom-secret',
        expect.any(Object)
      );
    });

    it('should use custom session timeout if provided', () => {
      process.env.SYSTEM_ADMIN_SESSION_TIMEOUT = '3600';
      mockJwt.sign.mockReturnValue('mock-jwt-token');

      generateSystemAdminToken('admin@test.com');

      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        { expiresIn: '3600s' }
      );
    });
  });

  describe('verifySystemAdminToken', () => {
    it('should verify valid system admin token', () => {
      // Clean up any custom secrets from previous tests
      delete process.env.SYSTEM_ADMIN_JWT_SECRET;
      
      const mockDecoded = {
        email: 'admin@test.com',
        role: 'system_admin',
        type: 'system_admin'
      };
      mockJwt.verify.mockReturnValue(mockDecoded);

      const result = verifySystemAdminToken('valid-token');

      expect(result).toEqual(mockDecoded);
      expect(mockJwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
    });

    it('should reject invalid token', () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = verifySystemAdminToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should reject non-system-admin token', () => {
      const mockDecoded = {
        email: 'user@test.com',
        role: 'admin', // Not system_admin
        type: 'access'
      };
      mockJwt.verify.mockReturnValue(mockDecoded);

      const result = verifySystemAdminToken('user-token');

      expect(result).toBeNull();
    });

    it('should reject token with wrong type', () => {
      const mockDecoded = {
        email: 'admin@test.com',
        role: 'system_admin',
        type: 'access' // Not system_admin type
      };
      mockJwt.verify.mockReturnValue(mockDecoded);

      const result = verifySystemAdminToken('wrong-type-token');

      expect(result).toBeNull();
    });
  });

  describe('loginSystemAdmin', () => {
    it('should login successfully with valid credentials', async () => {
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockReturnValue('mock-jwt-token');

      const result = await loginSystemAdmin('admin@test.com', 'correctpassword');

      expect(result.success).toBe(true);
      expect(result.token).toBe('mock-jwt-token');
      expect(result.user.email).toBe('admin@test.com');
      expect(result.user.role).toBe('system_admin');
    });

    it('should fail with invalid credentials', async () => {
      mockBcrypt.compare.mockResolvedValue(false);

      await expect(loginSystemAdmin('admin@test.com', 'wrongpassword'))
        .rejects.toThrow('Invalid system admin credentials');
    });

    it('should fail when credentials not configured', async () => {
      delete process.env.SYSTEM_ADMIN_EMAIL;

      await expect(loginSystemAdmin('admin@test.com', 'password'))
        .rejects.toThrow('Invalid system admin credentials');
    });
  });

  describe('isSystemAdminConfigured', () => {
    it('should return true when credentials are configured', () => {
      const result = isSystemAdminConfigured();
      expect(result).toBe(true);
    });

    it('should return false when email not configured', () => {
      delete process.env.SYSTEM_ADMIN_EMAIL;
      
      const result = isSystemAdminConfigured();
      expect(result).toBe(false);
    });

    it('should return false when password hash not configured', () => {
      delete process.env.SYSTEM_ADMIN_PASSWORD_HASH;
      
      const result = isSystemAdminConfigured();
      expect(result).toBe(false);
    });

    it('should return false when neither configured', () => {
      delete process.env.SYSTEM_ADMIN_EMAIL;
      delete process.env.SYSTEM_ADMIN_PASSWORD_HASH;
      
      const result = isSystemAdminConfigured();
      expect(result).toBe(false);
    });
  });
});