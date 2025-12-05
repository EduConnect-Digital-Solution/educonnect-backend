/**
 * User Authentication Routes Tests
 * Tests for user authentication endpoints
 */

const request = require('supertest');
const express = require('express');

// Mock all dependencies BEFORE importing anything
jest.mock('../../controllers/userAuthController', () => ({
  completeRegistration: jest.fn(),
  loginUser: jest.fn()
}));

jest.mock('../../middleware/userAuthValidation', () => ({
  validateParentRegistration: jest.fn((req, res, next) => next()),
  validateUserLogin: jest.fn((req, res, next) => next()),
  validateCompleteRegistration: jest.fn((req, res, next) => next()),
  sanitizeUserData: jest.fn((req, res, next) => next())
}));

jest.mock('../../middleware/rateLimiter', () => ({
  authLimiter: jest.fn((req, res, next) => next())
}));

// Mock express-validator to avoid validation issues
jest.mock('express-validator', () => ({
  validationResult: jest.fn(() => ({
    isEmpty: () => true,
    array: () => []
  }))
}));

const userAuthRoutes = require('../userAuth');
const userAuthController = require('../../controllers/userAuthController');

describe('User Auth Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/user/auth', userAuthRoutes);
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('POST /complete-registration', () => {
    it('should call completeRegistration controller', async () => {
      userAuthController.completeRegistration.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .post('/api/user/auth/complete-registration')
        .send({
          email: 'test@example.com',
          schoolId: 'SCH123456',
          currentPassword: 'temppass',
          newPassword: 'NewPass123!'
        });

      expect(response.status).toBe(200);
      expect(userAuthController.completeRegistration).toHaveBeenCalled();
    });
  });

  describe('POST /login', () => {
    it('should call loginUser controller', async () => {
      userAuthController.loginUser.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .post('/api/user/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
          schoolId: 'SCH123456'
        });

      expect(response.status).toBe(200);
      expect(userAuthController.loginUser).toHaveBeenCalled();
    });
  });

  describe('Route validation', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/user/auth/non-existent');

      expect(response.status).toBe(404);
    });
  });
});