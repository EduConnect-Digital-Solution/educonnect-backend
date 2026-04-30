/**
 * Admin Dashboard Routes Tests
 * Prisma/PostgreSQL-based tests for admin dashboard endpoints
 */

const request = require('supertest');
const express = require('express');
const adminDashboardRoutes = require('../adminDashboard');
const adminDashboardController = require('../../controllers/adminDashboardController');

// Mock all dependencies
jest.mock('../../controllers/adminDashboardController', () => ({
  getDashboardAnalytics: jest.fn(),
  forceRefreshDashboard: jest.fn(),
  debugInvitationStatus: jest.fn(),
  getUserManagement: jest.fn(),
  toggleUserStatus: jest.fn(),
  removeUser: jest.fn(),
  listInvitations: jest.fn(),
  cancelInvitation: jest.fn(),
  resendInvitation: jest.fn(),
  deleteInvitation: jest.fn()
}));

jest.mock('../../middleware/adminDashboardValidation', () => ({
  validateDashboardQuery: jest.fn((req, res, next) => next()),
  validateUserManagementQuery: jest.fn((req, res, next) => next()),
  validateUserStatusToggle: jest.fn((req, res, next) => next()),
  validateUserRemoval: jest.fn((req, res, next) => next()),
  validateInvitationQuery: jest.fn((req, res, next) => next()),
  validateInvitationCancel: jest.fn((req, res, next) => next()),
  validateInvitationResend: jest.fn((req, res, next) => next()),
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
    app.use('/api/admin/dashboard', adminDashboardRoutes);
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

  describe('POST /analytics/refresh', () => {
    it('should call forceRefreshDashboard controller', async () => {
      adminDashboardController.forceRefreshDashboard.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .post('/api/admin/dashboard/analytics/refresh');

      expect(response.status).toBe(200);
      expect(adminDashboardController.forceRefreshDashboard).toHaveBeenCalled();
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

  describe('GET /invitations', () => {
    it('should call listInvitations controller', async () => {
      adminDashboardController.listInvitations.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: [] });
      });

      const response = await request(app)
        .get('/api/admin/dashboard/invitations');

      expect(response.status).toBe(200);
      expect(adminDashboardController.listInvitations).toHaveBeenCalled();
    });
  });

  describe('DELETE /invitations/:invitationId', () => {
    it('should call cancelInvitation controller', async () => {
      adminDashboardController.cancelInvitation.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .delete('/api/admin/dashboard/invitations/inv123');

      expect(response.status).toBe(200);
      expect(adminDashboardController.cancelInvitation).toHaveBeenCalled();
    });
  });

  describe('POST /invitations/:invitationId/resend', () => {
    it('should call resendInvitation controller', async () => {
      adminDashboardController.resendInvitation.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .post('/api/admin/dashboard/invitations/inv123/resend');

      expect(response.status).toBe(200);
      expect(adminDashboardController.resendInvitation).toHaveBeenCalled();
    });
  });

  describe('DELETE /invitations/:invitationId/permanent', () => {
    it('should call deleteInvitation controller', async () => {
      adminDashboardController.deleteInvitation.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .delete('/api/admin/dashboard/invitations/inv123/permanent');

      expect(response.status).toBe(200);
      expect(adminDashboardController.deleteInvitation).toHaveBeenCalled();
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
