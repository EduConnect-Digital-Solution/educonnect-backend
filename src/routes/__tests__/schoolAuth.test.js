/**
 * School Authentication Routes Tests
 * Tests for school authentication endpoints
 */

const request = require('supertest');
const express = require('express');

// Mock all dependencies BEFORE importing anything
jest.mock('../../controllers/schoolAuthController', () => ({
  registerSchool: jest.fn(),
  loginSchoolAdmin: jest.fn(),
  verifySchoolEmail: jest.fn(),
  createTeacherInvitation: jest.fn(),
  createParentInvitation: jest.fn(),
  logout: jest.fn(),
  refreshToken: jest.fn(),
  resendOTP: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
  resendInvitation: jest.fn(),
  listInvitations: jest.fn(),
  cancelInvitation: jest.fn()
}));

jest.mock('../../middleware/schoolAuthValidation', () => ({
  validateSchoolRegistration: jest.fn((req, res, next) => next()),
  validateEmailVerification: jest.fn((req, res, next) => next()),
  validateSchoolLogin: jest.fn((req, res, next) => next()),
  validateTokenRefresh: jest.fn((req, res, next) => next()),
  validateOTPResend: jest.fn((req, res, next) => next()),
  validatePasswordResetRequest: jest.fn((req, res, next) => next()),
  validatePasswordReset: jest.fn((req, res, next) => next()),
  validateTeacherInvitation: jest.fn((req, res, next) => next()),
  validateParentInvitation: jest.fn((req, res, next) => next()),
  validateInvitationResend: jest.fn((req, res, next) => next()),
  validateInvitationCancel: jest.fn((req, res, next) => next()),
  sanitizeSchoolData: jest.fn((req, res, next) => next()),
  validateRateLimit: jest.fn((req, res, next) => next())
}));

jest.mock('../../middleware/rateLimiter', () => ({
  authLimiter: jest.fn((req, res, next) => next()),
  generalLimiter: jest.fn((req, res, next) => next())
}));

// Mock express-validator
jest.mock('express-validator', () => ({
  validationResult: jest.fn(() => ({
    isEmpty: () => true,
    array: () => []
  }))
}));

const schoolAuthRoutes = require('../schoolAuth');
const schoolAuthController = require('../../controllers/schoolAuthController');

describe('School Auth Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/school/auth', schoolAuthRoutes);
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('POST /register', () => {
    it('should call registerSchool controller', async () => {
      schoolAuthController.registerSchool.mockImplementation((req, res) => {
        res.status(201).json({ success: true });
      });

      const response = await request(app)
        .post('/api/school/auth/register')
        .send({
          schoolName: 'Test School',
          email: 'admin@testschool.com',
          password: 'Password123!',
          adminFirstName: 'John',
          adminLastName: 'Doe'
        });

      expect(response.status).toBe(201);
      expect(schoolAuthController.registerSchool).toHaveBeenCalled();
    });
  });

  describe('POST /login', () => {
    it('should call loginSchoolAdmin controller', async () => {
      schoolAuthController.loginSchoolAdmin.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .post('/api/school/auth/login')
        .send({
          schoolId: 'SCH123456',
          email: 'admin@testschool.com',
          password: 'Password123!'
        });

      expect(response.status).toBe(200);
      expect(schoolAuthController.loginSchoolAdmin).toHaveBeenCalled();
    });
  });

  describe('POST /logout', () => {
    it('should call logout controller', async () => {
      schoolAuthController.logout.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .post('/api/school/auth/logout');

      expect(response.status).toBe(200);
      expect(schoolAuthController.logout).toHaveBeenCalled();
    });
  });
});