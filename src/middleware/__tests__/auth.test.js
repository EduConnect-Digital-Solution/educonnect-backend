/**
 * Authentication Middleware Tests
 * Tests for JWT authentication middleware
 */

const jwt = require('jsonwebtoken');
const { authenticateToken, generateTokens, verifyRefreshToken } = require('../auth');

// Mock dependencies
jest.mock('jsonwebtoken');

describe('Authentication Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      user: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token', () => {
      const mockPayload = {
        userId: 'user123',
        schoolId: 'SCH123456',
        role: 'admin',
        email: 'admin@school.com'
      };

      req.headers.authorization = 'Bearer validtoken';
      jwt.verify.mockReturnValue(mockPayload);

      authenticateToken(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('validtoken', process.env.JWT_SECRET);
      expect(req.user).toEqual({
        ...mockPayload,
        id: mockPayload.userId // The auth middleware adds this field
      });
      expect(next).toHaveBeenCalled();
    });

    it('should reject request without token', () => {
      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access token required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token format', () => {
      req.headers.authorization = 'InvalidFormat';

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token format'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with expired token', () => {
      req.headers.authorization = 'Bearer expiredtoken';
      jwt.verify.mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token expired'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token', () => {
      req.headers.authorization = 'Bearer invalidtoken';
      jwt.verify.mockImplementation(() => {
        const error = new Error('Invalid token');
        error.name = 'JsonWebTokenError';
        throw error;
      });

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', () => {
      const payload = {
        userId: 'user123',
        schoolId: 'SCH123456',
        role: 'admin'
      };

      jwt.sign
        .mockReturnValueOnce('access_token')
        .mockReturnValueOnce('refresh_token');

      const tokens = generateTokens(payload);

      expect(jwt.sign).toHaveBeenCalledTimes(2);
      expect(tokens).toEqual({
        accessToken: 'access_token',
        refreshToken: 'refresh_token'
      });
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const mockPayload = {
        userId: 'user123',
        schoolId: 'SCH123456'
      };

      jwt.verify.mockReturnValue(mockPayload);

      const result = verifyRefreshToken('valid_refresh_token');

      expect(jwt.verify).toHaveBeenCalledWith(
        'valid_refresh_token',
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
      );
      expect(result).toEqual(mockPayload);
    });

    it('should throw error for invalid refresh token', () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => {
        verifyRefreshToken('invalid_refresh_token');
      }).toThrow('Invalid token');
    });
  });

  describe('Token extraction', () => {
    it('should extract token from Authorization header', () => {
      req.headers.authorization = 'Bearer mytoken123';
      jwt.verify.mockReturnValue({ userId: 'user123' });

      authenticateToken(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('mytoken123', process.env.JWT_SECRET);
    });

    it('should handle case-insensitive Bearer prefix', () => {
      req.headers.authorization = 'bearer mytoken123';
      jwt.verify.mockReturnValue({ userId: 'user123' });

      authenticateToken(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('mytoken123', process.env.JWT_SECRET);
    });
  });
});