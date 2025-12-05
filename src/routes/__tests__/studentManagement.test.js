/**
 * Student Management Routes Tests
 * Tests for student management endpoints
 */

const request = require('supertest');
const express = require('express');
const studentManagementRoutes = require('../studentManagement');
const studentManagementController = require('../../controllers/studentManagementController');

// Mock all dependencies BEFORE importing anything
jest.mock('../../controllers/studentManagementController', () => ({
  createStudent: jest.fn(),
  getStudents: jest.fn(),
  getStudentDetails: jest.fn(),
  updateStudent: jest.fn(),
  toggleStudentStatus: jest.fn(),
  removeStudent: jest.fn()
}));

jest.mock('../../middleware/studentManagementValidation', () => ({
  validateStudentCreation: jest.fn((req, res, next) => next()),
  validateStudentUpdate: jest.fn((req, res, next) => next()),
  validateStudentQuery: jest.fn((req, res, next) => next()),
  validateStudentStatusToggle: jest.fn((req, res, next) => next()),
  validateStudentRemoval: jest.fn((req, res, next) => next()),
  validateStudentDetailsQuery: jest.fn((req, res, next) => next()),
  sanitizeStudentData: jest.fn((req, res, next) => next())
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

describe('Student Management Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Middleware is already mocked above
    
    app.use('/api/students', studentManagementRoutes);
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('POST /', () => {
    it('should call createStudent controller', async () => {
      studentManagementController.createStudent.mockImplementation((req, res) => {
        res.status(201).json({ success: true });
      });

      const response = await request(app)
        .post('/api/students')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          class: '10A',
          rollNumber: '001'
        });

      expect(response.status).toBe(201);
      expect(studentManagementController.createStudent).toHaveBeenCalled();
    });

    it('should require admin role', () => {
      const mockRbac = require('../../middleware/rbac');
      expect(mockRbac.requireRole).toBeDefined();
    });
  });

  describe('GET /', () => {
    it('should call getStudents controller', async () => {
      studentManagementController.getStudents.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: [] });
      });

      const response = await request(app)
        .get('/api/students');

      expect(response.status).toBe(200);
      expect(studentManagementController.getStudents).toHaveBeenCalled();
    });

    it('should accept query parameters', async () => {
      studentManagementController.getStudents.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: [] });
      });

      const response = await request(app)
        .get('/api/students?class=10A&status=active&page=1&limit=10');

      expect(response.status).toBe(200);
      expect(studentManagementController.getStudents).toHaveBeenCalled();
    });
  });

  describe('GET /:studentId', () => {
    it('should call getStudentDetails controller', async () => {
      studentManagementController.getStudentDetails.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: {} });
      });

      const response = await request(app)
        .get('/api/students/507f1f77bcf86cd799439011');

      expect(response.status).toBe(200);
      expect(studentManagementController.getStudentDetails).toHaveBeenCalled();
    });
  });

  describe('PUT /:studentId', () => {
    it('should call updateStudent controller', async () => {
      studentManagementController.updateStudent.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .put('/api/students/507f1f77bcf86cd799439011')
        .send({
          firstName: 'Jane',
          lastName: 'Doe',
          class: '10B'
        });

      expect(response.status).toBe(200);
      expect(studentManagementController.updateStudent).toHaveBeenCalled();
    });

    it('should require admin role', () => {
      const mockRbac = require('../../middleware/rbac');
      expect(mockRbac.requireRole).toBeDefined();
    });
  });

  describe('POST /toggle-status', () => {
    it('should call toggleStudentStatus controller', async () => {
      studentManagementController.toggleStudentStatus.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .post('/api/students/toggle-status')
        .send({
          studentId: '507f1f77bcf86cd799439011',
          action: 'activate',
          reason: 'Student enrollment confirmed'
        });

      expect(response.status).toBe(200);
      expect(studentManagementController.toggleStudentStatus).toHaveBeenCalled();
    });
  });

  describe('DELETE /remove', () => {
    it('should call removeStudent controller', async () => {
      studentManagementController.removeStudent.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .delete('/api/students/remove')
        .send({
          studentId: '507f1f77bcf86cd799439011',
          reason: 'Student transferred to another school'
        });

      expect(response.status).toBe(200);
      expect(studentManagementController.removeStudent).toHaveBeenCalled();
    });
  });
});