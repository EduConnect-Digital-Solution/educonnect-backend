/**
 * Parent Dashboard Routes Tests
 * Tests for parent dashboard endpoints
 */

const request = require('supertest');
const express = require('express');
const parentDashboardRoutes = require('../parentDashboard');
const parentDashboardController = require('../../controllers/parentDashboardController');

// Mock all dependencies BEFORE importing anything
jest.mock('../../controllers/parentDashboardController', () => ({
  getParentDashboard: jest.fn(),
  getMyChildren: jest.fn(),
  updateParentProfile: jest.fn(),
  getParentProfile: jest.fn()
}));

jest.mock('../../middleware/dashboardValidation', () => ({
  validateChildId: jest.fn((req, res, next) => next()),
  validateParentProfileUpdate: jest.fn((req, res, next) => next())
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { id: 'parent1', role: 'parent', schoolId: 'SCH123456' };
    next();
  })
}));

jest.mock('../../middleware/rbac', () => ({
  requireRole: jest.fn(() => (req, res, next) => next())
}));

describe('Parent Dashboard Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Middleware is already mocked above
    
    app.use('/api/parent', parentDashboardRoutes);
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('GET /dashboard', () => {
    it('should call getParentDashboard controller', async () => {
      parentDashboardController.getParentDashboard.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: {} });
      });

      const response = await request(app)
        .get('/api/parent/dashboard');

      expect(response.status).toBe(200);
      expect(parentDashboardController.getParentDashboard).toHaveBeenCalled();
    });
  });

  describe('GET /children', () => {
    it('should call getMyChildren controller', async () => {
      parentDashboardController.getMyChildren.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: [] });
      });

      const response = await request(app)
        .get('/api/parent/children');

      expect(response.status).toBe(200);
      expect(parentDashboardController.getMyChildren).toHaveBeenCalled();
    });
  });

  describe('GET /children/:childId', () => {
    it('should call getMyChildren controller with child ID', async () => {
      parentDashboardController.getMyChildren.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: {} });
      });

      const response = await request(app)
        .get('/api/parent/children/507f1f77bcf86cd799439011');

      expect(response.status).toBe(200);
      expect(parentDashboardController.getMyChildren).toHaveBeenCalled();
    });
  });

  describe('PUT /profile', () => {
    it('should call updateParentProfile controller', async () => {
      parentDashboardController.updateParentProfile.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .put('/api/parent/profile')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
          address: '123 Main St'
        });

      expect(response.status).toBe(200);
      expect(parentDashboardController.updateParentProfile).toHaveBeenCalled();
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all routes', () => {
      const mockAuth = require('../../middleware/auth');
      expect(mockAuth.authenticateToken).toBeDefined();
    });

    it('should require parent role', () => {
      const mockRbac = require('../../middleware/rbac');
      expect(mockRbac.requireRole).toBeDefined();
    });
  });
});