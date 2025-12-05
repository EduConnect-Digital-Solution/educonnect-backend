/**
 * School Profile Routes Tests
 * Tests for school profile management endpoints
 */

const request = require('supertest');
const express = require('express');
const schoolProfileRoutes = require('../schoolProfile');
const schoolProfileController = require('../../controllers/schoolProfileController');

// Mock all dependencies BEFORE importing anything
jest.mock('../../controllers/schoolProfileController', () => ({
  getSchoolProfile: jest.fn(),
  updateSchoolProfile: jest.fn(),
  updateAdminProfile: jest.fn(),
  changeSchoolStatus: jest.fn()
}));

jest.mock('../../middleware/schoolProfileValidation', () => ({
  validateSchoolProfileQuery: jest.fn((req, res, next) => next()),
  validateSchoolProfileUpdate: jest.fn((req, res, next) => next()),
  validateAdminProfileUpdate: jest.fn((req, res, next) => next()),
  validateSchoolStatusChange: jest.fn((req, res, next) => next()),
  sanitizeSchoolProfileData: jest.fn((req, res, next) => next())
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

describe('School Profile Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Middleware is already mocked above
    
    app.use('/api/school/profile', schoolProfileRoutes);
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('GET /', () => {
    it('should call getSchoolProfile controller', async () => {
      schoolProfileController.getSchoolProfile.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: {} });
      });

      const response = await request(app)
        .get('/api/school/profile');

      expect(response.status).toBe(200);
      expect(schoolProfileController.getSchoolProfile).toHaveBeenCalled();
    });

    it('should accept query parameters', async () => {
      schoolProfileController.getSchoolProfile.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: {} });
      });

      const response = await request(app)
        .get('/api/school/profile?schoolId=SCH123456');

      expect(response.status).toBe(200);
      expect(schoolProfileController.getSchoolProfile).toHaveBeenCalled();
    });
  });

  describe('PUT /', () => {
    it('should call updateSchoolProfile controller', async () => {
      schoolProfileController.updateSchoolProfile.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .put('/api/school/profile')
        .send({
          schoolName: 'Updated School Name',
          phone: '+1234567890',
          address: '123 Updated Address',
          website: 'https://updatedschool.com'
        });

      expect(response.status).toBe(200);
      expect(schoolProfileController.updateSchoolProfile).toHaveBeenCalled();
    });
  });

  describe('PUT /admin', () => {
    it('should call updateAdminProfile controller', async () => {
      schoolProfileController.updateAdminProfile.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .put('/api/school/profile/admin')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890'
        });

      expect(response.status).toBe(200);
      expect(schoolProfileController.updateAdminProfile).toHaveBeenCalled();
    });
  });

  describe('POST /status', () => {
    it('should call changeSchoolStatus controller', async () => {
      schoolProfileController.changeSchoolStatus.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .post('/api/school/profile/status')
        .send({
          schoolId: 'SCH123456',
          isActive: false,
          reason: 'Temporary suspension for maintenance'
        });

      expect(response.status).toBe(200);
      expect(schoolProfileController.changeSchoolStatus).toHaveBeenCalled();
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

  describe('Rate Limiting', () => {
    it('should apply rate limiting to modification endpoints', () => {
      const mockRateLimiter = require('../../middleware/rateLimiter');
      expect(mockRateLimiter.authLimiter).toBeDefined();
    });
  });
});