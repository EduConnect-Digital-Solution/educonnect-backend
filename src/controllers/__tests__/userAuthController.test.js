/**
 * User Authentication Controller Tests
 * Tests for teacher and parent authentication functionality
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const User = require('../../models/User');
const School = require('../../models/School');
const Student = require('../../models/Student');
const Invitation = require('../../models/Invitation');

// Mock rate limiter for tests
jest.mock('express-rate-limit', () => {
  return jest.fn(() => (req, res, next) => next());
});

jest.mock('../../middleware/rateLimiter', () => ({
  authLimiter: (req, res, next) => next(),
  generalLimiter: (req, res, next) => next(),
  passwordResetLimiter: (req, res, next) => next(),
  emailVerificationLimiter: (req, res, next) => next(),
  invitationLimiter: (req, res, next) => next(),
  uploadLimiter: (req, res, next) => next(),
  schoolRegistrationLimiter: (req, res, next) => next()
}));

// Mock EmailService
jest.mock('../../config/email', () => ({
  sendTemplatedEmail: jest.fn().mockResolvedValue({
    success: true,
    messageId: 'test-message-id'
  })
}));

// Test database setup
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/educonnect-test';

describe('User Authentication Controller', () => {
  let testSchool;
  let testAdmin;
  let testStudents;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(MONGODB_URI);
  });

  beforeEach(async () => {
    // Clean up database
    await User.deleteMany({});
    await School.deleteMany({});
    await Student.deleteMany({});
    await Invitation.deleteMany({});

    // Create test school
    testSchool = new School({
      schoolName: 'Test High School',
      email: 'admin@testschool.com',
      password: 'hashedpassword',
      adminFirstName: 'Admin',
      adminLastName: 'User',
      isVerified: true,
      isActive: true
    });
    await testSchool.save();

    // Create test admin user
    testAdmin = new User({
      schoolId: testSchool.schoolId,
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@testschool.com',
      password: 'hashedpassword',
      role: 'admin',
      isVerified: true,
      isActive: true
    });
    await testAdmin.save();

    // Create test students with unique emails to avoid index conflicts
    testStudents = await Student.create([
      {
        schoolId: testSchool.schoolId,
        firstName: 'John',
        lastName: 'Doe',
        email: `john.doe.${Date.now()}@student.test.com`,
        class: '10A',
        isActive: true
      },
      {
        schoolId: testSchool.schoolId,
        firstName: 'Jane',
        lastName: 'Smith',
        email: `jane.smith.${Date.now() + 1}@student.test.com`,
        class: '10B',
        isActive: true
      }
    ]);
  });

  afterAll(async () => {
    // Clean up and close connection
    await User.deleteMany({});
    await School.deleteMany({});
    await Student.deleteMany({});
    await Invitation.deleteMany({});
    await mongoose.connection.close();
  });

  describe('POST /api/user/auth/complete-registration', () => {
    let testTeacher;
    let tempPassword;

    beforeEach(async () => {
      // Create teacher with temporary password
      tempPassword = 'temppass123';
      testTeacher = new User({
        schoolId: testSchool.schoolId,
        firstName: 'John',
        lastName: 'Teacher',
        email: 'teacher@test.com',
        password: tempPassword,
        role: 'teacher',
        subjects: ['Math'],
        isVerified: true,
        isActive: false,
        isTemporaryPassword: true,
        invitedBy: testAdmin._id
      });
      await testTeacher.save();
    });

    it('should complete teacher registration successfully', async () => {
      const response = await request(app)
        .post('/api/user/auth/complete-registration')
        .send({
          email: 'teacher@test.com',
          schoolId: testSchool.schoolId,
          currentPassword: tempPassword,
          newPassword: 'NewSecurePass123!',
          firstName: 'John',
          lastName: 'Teacher',
          phone: '1234567890',
          subjects: ['Mathematics', 'Physics'],
          qualifications: ['B.Sc Mathematics'],
          experience: 5
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Registration completed successfully');
      expect(response.body.data.user.isActive).toBe(true);
      expect(response.body.data.user.isTemporaryPassword).toBe(false);
      expect(response.body.data.user.subjects).toContain('Mathematics');
    });

    it('should fail with invalid current password', async () => {
      const response = await request(app)
        .post('/api/user/auth/complete-registration')
        .send({
          email: 'teacher@test.com',
          schoolId: testSchool.schoolId,
          currentPassword: 'wrongpassword',
          newPassword: 'NewSecurePass123!',
          firstName: 'John',
          lastName: 'Teacher'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid current password');
    });

    it('should fail for non-existent user', async () => {
      const response = await request(app)
        .post('/api/user/auth/complete-registration')
        .send({
          email: 'nonexistent@test.com',
          schoolId: testSchool.schoolId,
          currentPassword: tempPassword,
          newPassword: 'NewSecurePass123!',
          firstName: 'John',
          lastName: 'Teacher'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User not found or registration already completed');
    });

    it('should validate password requirements', async () => {
      const response = await request(app)
        .post('/api/user/auth/complete-registration')
        .send({
          email: 'teacher@test.com',
          schoolId: testSchool.schoolId,
          currentPassword: tempPassword,
          newPassword: 'weak', // Weak password
          firstName: 'John',
          lastName: 'Teacher'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('POST /api/user/auth/login', () => {
    let testTeacher;

    beforeEach(async () => {
      // Create active teacher
      testTeacher = new User({
        schoolId: testSchool.schoolId,
        firstName: 'John',
        lastName: 'Teacher',
        email: 'teacher@test.com',
        password: 'SecurePass123!',
        role: 'teacher',
        subjects: ['Math'],
        isVerified: true,
        isActive: true,
        isTemporaryPassword: false
      });
      await testTeacher.save();
    });

    it('should login teacher successfully', async () => {
      const response = await request(app)
        .post('/api/user/auth/login')
        .send({
          email: 'teacher@test.com',
          password: 'SecurePass123!',
          schoolId: testSchool.schoolId
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data.user.role).toBe('teacher');
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
    });

    it('should handle temporary password users', async () => {
      // Update teacher to have temporary password but keep verified
      testTeacher.isTemporaryPassword = true;
      testTeacher.isActive = true; // Keep active for login to work
      await testTeacher.save();

      const response = await request(app)
        .post('/api/user/auth/login')
        .send({
          email: 'teacher@test.com',
          password: 'SecurePass123!',
          schoolId: testSchool.schoolId
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.requiresRegistrationCompletion).toBe(true);
      expect(response.body.data.redirectTo).toBe('/complete-registration');
      expect(response.body.data.tokens).toBeUndefined();
    });

    it('should fail with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/user/auth/login')
        .send({
          email: 'teacher@test.com',
          password: 'wrongpassword',
          schoolId: testSchool.schoolId
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should fail for inactive user', async () => {
      testTeacher.isActive = false;
      await testTeacher.save();

      const response = await request(app)
        .post('/api/user/auth/login')
        .send({
          email: 'teacher@test.com',
          password: 'SecurePass123!',
          schoolId: testSchool.schoolId
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User account is deactivated. Please contact school administration.');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/user/auth/login')
        .send({
          email: 'teacher@test.com'
          // Missing password and schoolId
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('Parent Registration Flow', () => {
    let testParent;
    let tempPassword;

    beforeEach(async () => {
      // Create parent with temporary password and linked students
      tempPassword = 'temppass123';
      testParent = new User({
        schoolId: testSchool.schoolId,
        firstName: 'Mary',
        lastName: 'Parent',
        email: 'parent@test.com',
        password: tempPassword,
        role: 'parent',
        studentIds: testStudents.map(s => s._id),
        isVerified: true,
        isActive: false,
        isTemporaryPassword: true,
        invitedBy: testAdmin._id
      });
      await testParent.save();

      // Link students to parent
      await Student.updateMany(
        { _id: { $in: testStudents.map(s => s._id) } },
        { $addToSet: { parentIds: testParent._id } }
      );
    });

    it('should complete parent registration successfully', async () => {
      const response = await request(app)
        .post('/api/user/auth/complete-registration')
        .send({
          email: 'parent@test.com',
          schoolId: testSchool.schoolId,
          currentPassword: tempPassword,
          newPassword: 'NewSecurePass123!',
          firstName: 'Mary',
          lastName: 'Parent',
          phone: '1234567890',
          address: '123 Main St',
          occupation: 'Engineer',
          emergencyContact: 'John Parent',
          emergencyPhone: '0987654321'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe('parent');
      expect(response.body.data.user.isActive).toBe(true);
      expect(response.body.data.user.isTemporaryPassword).toBe(false);
      expect(response.body.data.user.address).toBe('123 Main St');
      expect(response.body.data.user.occupation).toBe('Engineer');
    });

    it('should login parent successfully after registration', async () => {
      // First complete registration
      await request(app)
        .post('/api/user/auth/complete-registration')
        .send({
          email: 'parent@test.com',
          schoolId: testSchool.schoolId,
          currentPassword: tempPassword,
          newPassword: 'NewSecurePass123!',
          firstName: 'Mary',
          lastName: 'Parent'
        });

      // Then login
      const response = await request(app)
        .post('/api/user/auth/login')
        .send({
          email: 'parent@test.com',
          password: 'NewSecurePass123!',
          schoolId: testSchool.schoolId
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe('parent');
      expect(response.body.data.tokens.accessToken).toBeDefined();
    });
  });
});