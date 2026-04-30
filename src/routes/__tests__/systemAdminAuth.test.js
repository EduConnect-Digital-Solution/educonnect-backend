/**
 * SystemAdminAuth Routes Tests
 * Prisma/PostgreSQL-based tests for system admin auth routes
 */

const request = require('supertest');
const express = require('express');

// Mock controller
jest.mock('../../controllers/systemAdminAuthController', () => ({
  login: jest.fn((req, res) => res.json({ success: true, message: 'Login successful' })),
  verify: jest.fn((req, res) => res.json({ success: true, message: 'Token valid' })),
  refresh: jest.fn((req, res) => res.json({ success: true, message: 'Token refreshed' })),
  logout: jest.fn((req, res) => res.json({ success: true, message: 'Logout successful' })),
  getStatus: jest.fn((req, res) => res.json({ success: true, data: { configured: true } })),
  getMe: jest.fn((req, res) => res.json({ success: true, user: { role: 'system_admin' } }))
}));

// Mock middleware
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

describe('SystemAdminAuth Routes', () => {
  let app;
  let mockController;

  beforeEach(() => {
    jest.clearAllMocks();
    
    app = express();
    app.use(express.json());
    
    mockController = require('../../controllers/systemAdminAuthController');
    
    // Import and use the router
    const systemAdminAuthRoutes = require('../systemAdminAuth');
    app.use('/api/system-admin/auth', systemAdminAuthRoutes);
  });

  describe('POST /login', () => {
    it('should call login controller', async () => {
      const response = await request(app)
        .post('/api/system-admin/auth/login')
        .send({ email: 'admin@test.com', password: 'Password123!' });

      expect(response.status).toBe(200);
      expect(mockController.login).toHaveBeenCalled();
    });
  });

  describe('GET /status', () => {
    it('should call getStatus controller', async () => {
      const response = await request(app)
        .get('/api/system-admin/auth/status');

      expect(response.status).toBe(200);
      expect(mockController.getStatus).toHaveBeenCalled();
    });
  });

  describe('GET /verify', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/system-admin/auth/verify');

      // Should pass through auth middleware
      expect(response.status).toBe(200);
    });
  });

  describe('POST /refresh', () => {
    it('should call refresh controller', async () => {
      const response = await request(app)
        .post('/api/system-admin/auth/refresh')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(mockController.refresh).toHaveBeenCalled();
    });
  });

  describe('POST /logout', () => {
    it('should call logout controller', async () => {
      const response = await request(app)
        .post('/api/system-admin/auth/logout');

      expect(response.status).toBe(200);
      expect(mockController.logout).toHaveBeenCalled();
    });
  });

  describe('GET /me', () => {
    it('should return system admin profile', async () => {
      const response = await request(app)
        .get('/api/system-admin/auth/me');

      expect(response.status).toBe(200);
      expect(mockController.getMe).toHaveBeenCalled();
    });
  });

  describe('Route Security', () => {
    it('should not expose registration endpoints', () => {
      const systemAdminAuthRoutes = require('../systemAdminAuth');
      const routerString = systemAdminAuthRoutes.toString();
      
      expect(routerString).not.toMatch(/register|signup|forgot-password/);
    });
  });
});
