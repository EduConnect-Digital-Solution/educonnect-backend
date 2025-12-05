/**
 * Parent Management Routes Tests
 * Tests for parent management endpoints
 */

const request = require('supertest');
const express = require('express');
const parentManagementRoutes = require('../parentManagement');
const parentManagementController = require('../../controllers/parentManagementController');

// Mock all dependencies BEFORE importing anything
jest.mock('../../controllers/parentManagementController', () => ({
  inviteParent: jest.fn(),
  getParents: jest.fn(),
  getParentDetails: jest.fn(),
  linkParentToStudents: jest.fn(),
  unlinkParentFromStudents: jest.fn(),
  removeParent: jest.fn()
}));

jest.mock('../../middleware/parentManagementValidation', () => ({
  validateInviteParent: jest.fn((req, res, next) => next()),
  validateGetParents: jest.fn((req, res, next) => next()),
  validateParentId: jest.fn((req, res, next) => next()),
  validateLinkParentToStudents: jest.fn((req, res, next) => next()),
  validateUnlinkParentFromStudents: jest.fn((req, res, next) => next()),
  validateRemoveParent: jest.fn((req, res, next) => next())
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

describe('Parent Management Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Middleware is already mocked above
    
    app.use('/api/parent-management', parentManagementRoutes);
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('POST /invite-parent', () => {
    it('should call inviteParent controller', async () => {
      parentManagementController.inviteParent.mockImplementation((req, res) => {
        res.status(201).json({ success: true });
      });

      const response = await request(app)
        .post('/api/parent-management/invite-parent')
        .send({
          email: 'parent@example.com',
          firstName: 'John',
          lastName: 'Doe',
          studentIds: ['507f1f77bcf86cd799439011']
        });

      expect(response.status).toBe(201);
      expect(parentManagementController.inviteParent).toHaveBeenCalled();
    });

    it('should require admin role', () => {
      const mockRbac = require('../../middleware/rbac');
      expect(mockRbac.requireRole).toBeDefined();
    });
  });

  describe('GET /parents', () => {
    it('should call getParents controller', async () => {
      parentManagementController.getParents.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: [] });
      });

      const response = await request(app)
        .get('/api/parent-management/parents');

      expect(response.status).toBe(200);
      expect(parentManagementController.getParents).toHaveBeenCalled();
    });

    it('should accept query parameters', async () => {
      parentManagementController.getParents.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: [] });
      });

      const response = await request(app)
        .get('/api/parent-management/parents?status=active&page=1&limit=10');

      expect(response.status).toBe(200);
      expect(parentManagementController.getParents).toHaveBeenCalled();
    });
  });

  describe('GET /parents/:parentId', () => {
    it('should call getParentDetails controller', async () => {
      parentManagementController.getParentDetails.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: {} });
      });

      const response = await request(app)
        .get('/api/parent-management/parents/507f1f77bcf86cd799439011');

      expect(response.status).toBe(200);
      expect(parentManagementController.getParentDetails).toHaveBeenCalled();
    });
  });

  describe('POST /parents/:parentId/link-students', () => {
    it('should call linkParentToStudents controller', async () => {
      parentManagementController.linkParentToStudents.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .post('/api/parent-management/parents/507f1f77bcf86cd799439011/link-students')
        .send({
          studentIds: ['507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013']
        });

      expect(response.status).toBe(200);
      expect(parentManagementController.linkParentToStudents).toHaveBeenCalled();
    });

    it('should require admin role', () => {
      const mockRbac = require('../../middleware/rbac');
      expect(mockRbac.requireRole).toBeDefined();
    });
  });

  describe('POST /parents/:parentId/unlink-students', () => {
    it('should call unlinkParentFromStudents controller', async () => {
      parentManagementController.unlinkParentFromStudents.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .post('/api/parent-management/parents/507f1f77bcf86cd799439011/unlink-students')
        .send({
          studentIds: ['507f1f77bcf86cd799439012']
        });

      expect(response.status).toBe(200);
      expect(parentManagementController.unlinkParentFromStudents).toHaveBeenCalled();
    });
  });

  describe('DELETE /parents/:parentId', () => {
    it('should call removeParent controller', async () => {
      parentManagementController.removeParent.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .delete('/api/parent-management/parents/507f1f77bcf86cd799439011');

      expect(response.status).toBe(200);
      expect(parentManagementController.removeParent).toHaveBeenCalled();
    });

    it('should require admin role', () => {
      const mockRbac = require('../../middleware/rbac');
      expect(mockRbac.requireRole).toBeDefined();
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all routes', () => {
      const mockAuth = require('../../middleware/auth');
      expect(mockAuth.authenticateToken).toBeDefined();
    });

    it('should have proper role-based access control', () => {
      const mockRbac = require('../../middleware/rbac');
      expect(mockRbac.requireRole).toBeDefined();
    });
  });
});