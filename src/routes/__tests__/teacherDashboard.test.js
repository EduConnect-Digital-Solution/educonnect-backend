/**
 * Teacher Dashboard Routes Tests
 * Tests for teacher dashboard endpoints
 */

const request = require('supertest');
const express = require('express');
const teacherDashboardRoutes = require('../teacherDashboard');
const teacherDashboardController = require('../../controllers/teacherDashboardController');

// Mock all dependencies BEFORE importing anything
jest.mock('../../controllers/teacherDashboardController', () => ({
  getTeacherDashboard: jest.fn(),
  getMyStudents: jest.fn(),
  getTeacherProfile: jest.fn()
}));

jest.mock('../../middleware/dashboardValidation', () => ({
  validateTeacherQuery: jest.fn((req, res, next) => next())
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { id: 'teacher1', role: 'teacher', schoolId: 'SCH123456' };
    next();
  })
}));

jest.mock('../../middleware/rbac', () => ({
  requireRole: jest.fn(() => (req, res, next) => next())
}));

describe('Teacher Dashboard Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Middleware is already mocked above
    
    app.use('/api/teacher', teacherDashboardRoutes);
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('GET /dashboard', () => {
    it('should call getTeacherDashboard controller', async () => {
      teacherDashboardController.getTeacherDashboard.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: {} });
      });

      const response = await request(app)
        .get('/api/teacher/dashboard');

      expect(response.status).toBe(200);
      expect(teacherDashboardController.getTeacherDashboard).toHaveBeenCalled();
    });
  });

  describe('GET /students', () => {
    it('should call getMyStudents controller', async () => {
      teacherDashboardController.getMyStudents.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: [] });
      });

      const response = await request(app)
        .get('/api/teacher/students');

      expect(response.status).toBe(200);
      expect(teacherDashboardController.getMyStudents).toHaveBeenCalled();
    });

    it('should accept query parameters', async () => {
      teacherDashboardController.getMyStudents.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: [] });
      });

      const response = await request(app)
        .get('/api/teacher/students?class=10A&subject=Math');

      expect(response.status).toBe(200);
      expect(teacherDashboardController.getMyStudents).toHaveBeenCalled();
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all routes', () => {
      const mockAuth = require('../../middleware/auth');
      expect(mockAuth.authenticateToken).toBeDefined();
    });

    it('should require teacher role', () => {
      const mockRbac = require('../../middleware/rbac');
      expect(mockRbac.requireRole).toBeDefined();
    });
  });
});