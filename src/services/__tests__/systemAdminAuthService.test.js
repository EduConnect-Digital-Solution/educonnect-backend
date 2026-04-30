/**
 * SystemAdminAuthService Tests
 * Tests for system admin authentication service
 */

// Mock all dependencies BEFORE importing
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn()
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

// Import service after mocks
const {
  validateSystemAdminCredentials,
  generateSystemAdminToken,
  verifySystemAdminToken,
  refreshSystemAdminToken,
  isSystemAdminConfigured
} = require('../systemAdminAuthService');

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

describe('SystemAdminAuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set environment variables for each test
    process.env.SYSTEM_ADMIN_EMAIL = 'admin@test.com';
    process.env.SYSTEM_ADMIN_PASSWORD_HASH = 'hashed_password';
    process.env.SYSTEM_ADMIN_JWT_SECRET = 'test-secret';
  });

  afterEach(() => {
    delete process.env.SYSTEM_ADMIN_EMAIL;
    delete process.env.SYSTEM_ADMIN_PASSWORD_HASH;
    delete process.env.SYSTEM_ADMIN_JWT_SECRET;
  });

  describe('validateSystemAdminCredentials', () => {
    it('should return true for valid credentials', async () => {
      bcrypt.compare.mockResolvedValue(true);
      
      const result = await validateSystemAdminCredentials('admin@test.com', 'password123');
      
      expect(result).toBe(true);
    });

    it('should return false for incorrect email', async () => {
      const result = await validateSystemAdminCredentials('wrong@test.com', 'password123');
      
      expect(result).toBe(false);
    });

    it('should return false for incorrect password', async () => {
      bcrypt.compare.mockResolvedValue(false);
      
      const result = await validateSystemAdminCredentials('admin@test.com', 'wrongpassword');
      
      expect(result).toBe(false);
    });

    it('should return false when credentials not configured', async () => {
      delete process.env.SYSTEM_ADMIN_EMAIL;
      delete process.env.SYSTEM_ADMIN_PASSWORD_HASH;
      
      const result = await validateSystemAdminCredentials('admin@test.com', 'password123');
      
      expect(result).toBe(false);
    });
  });

  describe('generateSystemAdminToken', () => {
    it('should generate token with correct payload', () => {
      jwt.sign.mockReturnValue('mock-jwt-token');
      
      const token = generateSystemAdminToken('admin@test.com');
      
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'admin@test.com',
          role: 'system_admin',
          crossSchoolAccess: true
        }),
        expect.any(String),
        expect.any(Object)
      );
      expect(token).toBe('mock-jwt-token');
    });

    it('should use fallback JWT secret if system admin secret not set', () => {
      delete process.env.SYSTEM_ADMIN_JWT_SECRET;
      process.env.JWT_SECRET = 'fallback-secret';
      
      jwt.sign.mockReturnValue('mock-jwt-token');
      
      generateSystemAdminToken('admin@test.com');
      
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.anything(),
        'fallback-secret',
        expect.any(Object)
      );
    });
  });

  describe('verifySystemAdminToken', () => {
    it('should verify valid token', () => {
      jwt.verify.mockReturnValue({
        email: 'admin@test.com',
        role: 'system_admin',
        type: 'system_admin'
      });
      
      const result = verifySystemAdminToken('valid-token');
      
      expect(result).toBeDefined();
      expect(result.email).toBe('admin@test.com');
    });

    it('should return null for invalid token', () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      const result = verifySystemAdminToken('invalid-token');
      
      expect(result).toBeNull();
    });

    it('should return null for non-system-admin token', () => {
      jwt.verify.mockReturnValue({
        email: 'user@test.com',
        role: 'teacher'
      });
      
      const result = verifySystemAdminToken('teacher-token');
      
      expect(result).toBeNull();
    });
  });

  describe('refreshSystemAdminToken', () => {
    it('should refresh valid token', async () => {
      jwt.verify.mockReturnValue({
        email: 'admin@test.com',
        role: 'system_admin',
        type: 'system_admin',
        systemAdminLevel: 'super',
        crossSchoolAccess: true
      });
      jwt.sign.mockReturnValue('new-jwt-token');
      
      const result = await refreshSystemAdminToken('valid-token');
      
      expect(result.success).toBe(true);
      expect(result.token).toBe('new-jwt-token');
    });

    it('should throw error for invalid token', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      await expect(refreshSystemAdminToken('invalid-token'))
        .rejects.toThrow('Invalid or expired token');
    });
  });

  describe('isSystemAdminConfigured', () => {
    it('should return true when configured', () => {
      const result = isSystemAdminConfigured();
      
      expect(result).toBe(true);
    });

    it('should return false when not configured', () => {
      delete process.env.SYSTEM_ADMIN_EMAIL;
      delete process.env.SYSTEM_ADMIN_PASSWORD_HASH;
      
      const result = isSystemAdminConfigured();
      
      expect(result).toBe(false);
    });
  });
});
