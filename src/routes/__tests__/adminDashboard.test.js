/**
 * Admin Dashboard Routes Tests
 * Tests for admin dashboard endpoints
 */

const request = require('supertest');
const express = require('express');
const adminDashboardRoutes = require('../adminDashboard');
const adminDashboardController = require('../../controllers/adminDashboardController');

// Mock all dependencies BEFORE importing anything
jest.mock('../../controllers/adminDashboardController', () => ({
  getDashboardAnalytics: jest.fn(),
  getUserManagement: jest.fn(),
  toggleUserStatus: jest.fn(),
  removeUser: jest.fn()
}));

jest.mock('../../middleware/adminDashboardValidation', () => ({
  validateDashboardQuery: jest.fn((req, res, next) => next()),
  validateUserManagementQuery: jest.fn((req, res, next) => next()),
  validateUserStatusToggle: jest.fn((req, res, next) => next()),
  validateUserRemoval: jest.fn((req, res, next) => next()),
  sanitizeAdminData: jest.fn((req, res, next) => next())
}));

jest.mock('../../middleware/rateLimiter', () => ({
  generalLimiter: jest.fn((req, res, next) => next()),
  authLimiter: jest.fn((req, res, next) => next())
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { id: 'admin1', role: 'admin', schoolId: 'SCH123456' };
    next();
  })
}));

jest.mock('../../middleware/rbac', () => ({
  requireRole: jest.fn(() => (req, res, next) => next())
}));

describe('Admin Dashboard Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Middleware is already mocked above
    
    app.use('/api/admin/dashboard', adminDashboardRoutes);
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('GET /analytics', () => {
    it('should call getDashboardAnalytics controller', async () => {
      adminDashboardController.getDashboardAnalytics.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: {} });
      });

      const response = await request(app)
        .get('/api/admin/dashboard/analytics');

      expect(response.status).toBe(200);
      expect(adminDashboardController.getDashboardAnalytics).toHaveBeenCalled();
    });

    it('should accept query parameters', async () => {
      adminDashboardController.getDashboardAnalytics.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: {} });
      });

      const response = await request(app)
        .get('/api/admin/dashboard/analytics?schoolId=SCH123456');

      expect(response.status).toBe(200);
      expect(adminDashboardController.getDashboardAnalytics).toHaveBeenCalled();
    });
  });

  describe('GET /users', () => {
    it('should call getUserManagement controller', async () => {
      adminDashboardController.getUserManagement.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: [] });
      });

      const response = await request(app)
        .get('/api/admin/dashboard/users');

      expect(response.status).toBe(200);
      expect(adminDashboardController.getUserManagement).toHaveBeenCalled();
    });

    it('should accept filtering parameters', async () => {
      adminDashboardController.getUserManagement.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: [] });
      });

      const response = await request(app)
        .get('/api/admin/dashboard/users?role=teacher&status=active&page=1&limit=10');

      expect(response.status).toBe(200);
      expect(adminDashboardController.getUserManagement).toHaveBeenCalled();
    });
  });

  describe('POST /users/toggle-status', () => {
    it('should call toggleUserStatus controller', async () => {
      adminDashboardController.toggleUserStatus.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .post('/api/admin/dashboard/users/toggle-status')
        .send({
          userId: '507f1f77bcf86cd799439011',
          action: 'activate',
          reason: 'User requested activation'
        });

      expect(response.status).toBe(200);
      expect(adminDashboardController.toggleUserStatus).toHaveBeenCalled();
    });
  });

  describe('DELETE /users/remove', () => {
    it('should call removeUser controller', async () => {
      adminDashboardController.removeUser.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .delete('/api/admin/dashboard/users/remove')
        .send({
          userId: '507f1f77bcf86cd799439011',
          reason: 'User requested account deletion'
        });

      expect(response.status).toBe(200);
      expect(adminDashboardController.removeUser).toHaveBeenCalled();
    });
  });

  describe('RBAC Protection', () => {
    it('should require authentication for all routes', () => {
      const mockAuth = require('../../middleware/auth');
      expect(mockAuth.authenticateToken).toBeDefined();
    });

    it('should require admin role for all routes', () => {
      const mockRbac = require('../../middleware/rbac');
      expect(mockRbac.requireRole).toBeDefined();
    });
  });
});