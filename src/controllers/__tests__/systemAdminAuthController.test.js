/**
 * System Admin Authentication Controller Tests
 * Simple tests for system admin authentication functionality
 */

const request = require('supertest');
const express = require('express');
const systemAdminAuthController = require('../systemAdminAuthController');

// Mock dependencies
jest.mock('../../services/systemAdminAuthService');
jest.mock('../../utils/catchAsync', () => (fn) => fn);

describe('SystemAdminAuthController', () => {
  let app;
  let mockSystemAdminAuthService;

  beforeEach(() => {
    // Create express app for testing
    app = express();
    app.use(express.json());
    
    // Get mocked service
    mockSystemAdminAuthService = require('../../services/systemAdminAuthService');
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup routes
    app.post('/login', systemAdminAuthController.login);
    app.get('/verify', (req, res, next) => {
      // Mock authenticated user
      req.user = { email: 'admin@test.com', role: 'system_admin' };
      req.systemAdmin = { email: 'admin@test.com', level: 'super' };
      next();
    }, systemAdminAuthController.verify);
    app.post('/refresh', systemAdminAuthController.refresh);
    app.post('/logout', (req, res, next) => {
      req.user = { email: 'admin@test.com', role: 'system_admin' };
      next();
    }, systemAdminAuthController.logout);
    app.get('/status', systemAdminAuthController.getStatus);
  });

  describe('POST /login', () => {
    it('should login successfully with valid credentials', async () => {
      // Mock successful login
      mockSystemAdminAuthService.loginSystemAdmin.mockResolvedValue({
        token: 'mock-jwt-token',
        user: {
          email: 'admin@test.com',
          role: 'system_admin',
          crossSchoolAccess: true
        }
      });
      
      mockSystemAdminAuthService.isSystemAdminConfigured.mockReturnValue(true);

      const response = await request(app)
        .post('/login')
        .send({
          email: 'admin@test.com',
          password: 'validPassword123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBe('mock-jwt-token');
      expect(response.body.data.user.email).toBe('admin@test.com');
    });

    it('should fail with missing credentials', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: 'admin@test.com'
          // Missing password
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_CREDENTIALS');
    });

    it('should fail when system admin not configured', async () => {
      mockSystemAdminAuthService.isSystemAdminConfigured.mockReturnValue(false);

      const response = await request(app)
        .post('/login')
        .send({
          email: 'admin@test.com',
          password: 'password123'
        });

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('SYSTEM_ADMIN_NOT_CONFIGURED');
    });

    it('should fail with invalid credentials', async () => {
      mockSystemAdminAuthService.isSystemAdminConfigured.mockReturnValue(true);
      mockSystemAdminAuthService.loginSystemAdmin.mockRejectedValue(
        new Error('Invalid credentials')
      );

      const response = await request(app)
        .post('/login')
        .send({
          email: 'admin@test.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /verify', () => {
    it('should verify valid token successfully', async () => {
      const response = await request(app).get('/verify');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.user.email).toBe('admin@test.com');
    });
  });

  describe('POST /refresh', () => {
    it('should refresh token successfully', async () => {
      mockSystemAdminAuthService.refreshSystemAdminToken.mockResolvedValue({
        token: 'new-jwt-token',
        user: {
          email: 'admin@test.com',
          role: 'system_admin'
        }
      });

      const response = await request(app)
        .post('/refresh')
        .set('Authorization', 'Bearer old-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBe('new-jwt-token');
    });

    it('should fail without token', async () => {
      const response = await request(app).post('/refresh');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_TOKEN');
    });
  });

  describe('POST /logout', () => {
    it('should logout successfully', async () => {
      const response = await request(app).post('/logout');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.loggedOut).toBe(true);
    });
  });

  describe('GET /status', () => {
    it('should return system admin status', async () => {
      mockSystemAdminAuthService.isSystemAdminConfigured.mockReturnValue(true);

      const response = await request(app).get('/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.configured).toBe(true);
    });
  });
});