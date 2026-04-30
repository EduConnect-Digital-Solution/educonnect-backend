/**
 * SystemAdminAuthController Tests
 * Prisma/PostgreSQL-based tests for system admin auth controller
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies BEFORE importing anything
jest.mock('../../services/systemAdminAuthService', () => ({
  loginSystemAdmin: jest.fn(),
  refreshSystemAdminToken: jest.fn(),
  verifySystemAdminToken: jest.fn(),
  verifySystemAdminRefreshToken: jest.fn(),
  isSystemAdminConfigured: jest.fn()
}));

jest.mock('../../middleware/systemAdminAuth', () => ({
  requireSystemAdmin: jest.fn((req, res, next) => next()),
  auditSystemOperation: jest.fn(() => (req, res, next) => next())
}));

jest.mock('../../middleware/systemAdminAuthValidation', () => ({
  validateLogin: [(req, res, next) => next()],
  validateRefresh: [(req, res, next) => next()],
  createSystemAdminValidationChain: jest.fn(() => [(req, res, next) => next()])
}));

jest.mock('../../middleware/rateLimiter', () => ({
  createCustomLimiter: jest.fn(() => (req, res, next) => next())
}));

jest.mock('../../utils/cookieHelper', () => ({
  setRefreshTokenCookie: jest.fn(),
  clearRefreshTokenCookie: jest.fn(),
  getRefreshTokenFromCookie: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// Import after mocks
const systemAdminAuthController = require('../systemAdminAuthController');
const systemAdminAuthService = require('../../services/systemAdminAuthService');

describe('SystemAdminAuthController', () => {
  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      systemAdminAuthService.isSystemAdminConfigured.mockReturnValue(true);
      systemAdminAuthService.loginSystemAdmin.mockResolvedValue({
        success: true,
        token: 'mock-token',
        refreshToken: 'mock-refresh-token',
        user: { email: 'admin@test.com', role: 'system_admin' }
      });

      const app = express();
      app.use(express.json());
      app.post('/api/system-admin/auth/login', systemAdminAuthController.login);

      const response = await request(app)
        .post('/api/system-admin/auth/login')
        .send({ email: 'admin@test.com', password: 'Password123!' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 401 for invalid credentials', async () => {
      systemAdminAuthService.isSystemAdminConfigured.mockReturnValue(true);
      systemAdminAuthService.loginSystemAdmin.mockRejectedValue(
        new Error('Invalid system admin credentials')
      );

      const app = express();
      app.use(express.json());
      app.post('/api/system-admin/auth/login', systemAdminAuthController.login);

      const response = await request(app)
        .post('/api/system-admin/auth/login')
        .send({ email: 'wrong@test.com', password: 'wrong' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 503 when not configured', async () => {
      systemAdminAuthService.isSystemAdminConfigured.mockReturnValue(false);

      const app = express();
      app.use(express.json());
      app.post('/api/system-admin/auth/login', systemAdminAuthController.login);

      const response = await request(app)
        .post('/api/system-admin/auth/login')
        .send({ email: 'admin@test.com', password: 'Password123!' });

      expect(response.status).toBe(503);
    });
  });

  describe('getStatus', () => {
    it('should return configuration status', async () => {
      systemAdminAuthService.isSystemAdminConfigured.mockReturnValue(true);

      const app = express();
      app.get('/api/system-admin/auth/status', systemAdminAuthController.getStatus);

      const response = await request(app)
        .get('/api/system-admin/auth/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.configured).toBe(true);
    });
  });

  describe('verify', () => {
    it('should verify valid token', async () => {
      const app = express();
      app.use(express.json());
      app.use((req, res, next) => {
        req.user = { email: 'admin@test.com', role: 'system_admin' };
        req.systemAdmin = { email: 'admin@test.com' };
        next();
      });
      app.get('/api/system-admin/auth/verify', systemAdminAuthController.verify);

      const response = await request(app)
        .get('/api/system-admin/auth/verify');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
    });
  });

  describe('refresh', () => {
    it('should refresh token successfully', async () => {
      systemAdminAuthService.verifySystemAdminRefreshToken.mockReturnValue({
        email: 'admin@test.com',
        systemAdminLevel: 'super'
      });

      systemAdminAuthService.refreshSystemAdminToken.mockResolvedValue({
        success: true,
        token: 'new-token',
        refreshToken: 'new-refresh-token'
      });

      const app = express();
      app.use(express.json());
      app.post('/api/system-admin/auth/refresh', systemAdminAuthController.refresh);

      const response = await request(app)
        .post('/api/system-admin/auth/refresh')
        .set('Authorization', 'Bearer old-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 401 when no token provided', async () => {
      const app = express();
      app.use(express.json());
      app.post('/api/system-admin/auth/refresh', systemAdminAuthController.refresh);

      const response = await request(app)
        .post('/api/system-admin/auth/refresh');

      expect(response.status).toBe(401);
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      const app = express();
      app.use(express.json());
      app.post('/api/system-admin/auth/logout', systemAdminAuthController.logout);

      const response = await request(app)
        .post('/api/system-admin/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('getMe', () => {
    it('should return system admin profile', async () => {
      const cookieHelper = require('../../utils/cookieHelper');
      cookieHelper.getRefreshTokenFromCookie.mockReturnValue('mock-refresh-token');
      
      systemAdminAuthService.verifySystemAdminRefreshToken.mockReturnValue({
        email: 'admin@test.com',
        systemAdminLevel: 'super',
        crossSchoolAccess: true,
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 3600
      });

      const app = express();
      app.use(express.json());
      app.get('/api/system-admin/auth/me', systemAdminAuthController.getMe);

      const response = await request(app)
        .get('/api/system-admin/auth/me');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
