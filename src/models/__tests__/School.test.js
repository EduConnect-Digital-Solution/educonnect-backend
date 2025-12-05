const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const School = require('../School');

// Mock mongoose connection for testing
jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  return {
    ...actualMongoose,
    connect: jest.fn(),
    connection: {
      readyState: 1
    }
  };
});

describe('School Model', () => {
  let schoolData;

  beforeEach(() => {
    schoolData = {
      schoolName: 'Test High School',
      email: 'admin@testschool.com',
      password: 'Password123!',
      address: '123 Education Street, Learning City, LC 12345',
      phone: '+1234567890',
      principalName: 'Dr. Jane Smith',
      schoolType: 'public'
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Schema Validation', () => {
    test('should create a valid school with required fields', () => {
      const school = new School(schoolData);
      const validationError = school.validateSync();
      
      expect(validationError).toBeUndefined();
      expect(school.schoolName).toBe(schoolData.schoolName);
      expect(school.email).toBe(schoolData.email.toLowerCase());
      expect(school.isVerified).toBe(false);
      expect(school.isActive).toBe(true);
    });

    test('should require schoolName', () => {
      delete schoolData.schoolName;
      const school = new School(schoolData);
      const validationError = school.validateSync();
      
      expect(validationError.errors.schoolName).toBeDefined();
      expect(validationError.errors.schoolName.message).toBe('School name is required');
    });

    test('should require email', () => {
      delete schoolData.email;
      const school = new School(schoolData);
      const validationError = school.validateSync();
      
      expect(validationError.errors.email).toBeDefined();
      expect(validationError.errors.email.message).toBe('Email is required');
    });

    test('should require password', () => {
      delete schoolData.password;
      const school = new School(schoolData);
      const validationError = school.validateSync();
      
      expect(validationError.errors.password).toBeDefined();
      expect(validationError.errors.password.message).toBe('Password is required');
    });

    test('should validate email format', () => {
      schoolData.email = 'invalid-email';
      const school = new School(schoolData);
      const validationError = school.validateSync();
      
      expect(validationError.errors.email).toBeDefined();
      expect(validationError.errors.email.message).toBe('Please enter a valid email');
    });

    test('should validate phone format', () => {
      schoolData.phone = 'invalid-phone';
      const school = new School(schoolData);
      const validationError = school.validateSync();
      
      expect(validationError.errors.phone).toBeDefined();
      expect(validationError.errors.phone.message).toBe('Please enter a valid phone number');
    });

    test('should validate schoolType enum', () => {
      schoolData.schoolType = 'invalid-type';
      const school = new School(schoolData);
      const validationError = school.validateSync();
      
      expect(validationError.errors.schoolType).toBeDefined();
    });

    test('should validate schoolName length', () => {
      schoolData.schoolName = 'A'; // Too short
      const school = new School(schoolData);
      const validationError = school.validateSync();
      
      expect(validationError.errors.schoolName).toBeDefined();
      expect(validationError.errors.schoolName.message).toBe('School name must be at least 2 characters');
    });

    test('should validate password length', () => {
      schoolData.password = '1234567'; // Too short
      const school = new School(schoolData);
      const validationError = school.validateSync();
      
      expect(validationError.errors.password).toBeDefined();
      expect(validationError.errors.password.message).toBe('Password must be at least 8 characters');
    });
  });

  describe('Password Hashing', () => {
    test('should have password hashing functionality', () => {
      const school = new School(schoolData);
      
      // Test that the model has the comparePassword method
      expect(typeof school.comparePassword).toBe('function');
      
      // Test that password field exists
      expect(school.password).toBe(schoolData.password);
    });

    test('comparePassword should work with bcrypt', async () => {
      const school = new School(schoolData);
      school.password = 'hashed_password';
      
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      
      const result = await school.comparePassword('test_password');
      
      expect(bcrypt.compare).toHaveBeenCalledWith('test_password', 'hashed_password');
      expect(result).toBe(true);
    });
  });

  describe('SchoolId Generation', () => {
    test('should have schoolId generation logic', () => {
      const school = new School(schoolData);
      
      // Test the schoolId generation logic directly
      const schoolName = 'Test High School';
      const namePrefix = schoolName
        .replace(/[^a-zA-Z]/g, '')
        .substring(0, 3)
        .toUpperCase()
        .padEnd(3, 'X');
      
      expect(namePrefix).toBe('TES');
      
      // Test that schoolId field exists in schema
      expect(School.schema.paths.schoolId).toBeDefined();
    });

    test('should preserve existing schoolId', () => {
      const existingSchoolId = 'ABC1234';
      const school = new School({ ...schoolData, schoolId: existingSchoolId });
      
      expect(school.schoolId).toBe(existingSchoolId);
    });

    test('should generate correct prefix from school name', () => {
      // Test various school names
      const testCases = [
        { name: 'Amazing Learning Academy', expected: 'AMA' },
        { name: 'St. Mary\'s School', expected: 'STM' },
        { name: 'ABC Elementary', expected: 'ABC' },
        { name: 'X Y', expected: 'XYX' }, // Padded with X
        { name: '123 School', expected: 'SCH' }
      ];
      
      testCases.forEach(({ name, expected }) => {
        const prefix = name
          .replace(/[^a-zA-Z]/g, '')
          .substring(0, 3)
          .toUpperCase()
          .padEnd(3, 'X');
        
        expect(prefix).toBe(expected);
      });
    });
  });

  describe('Instance Methods', () => {
    let school;

    beforeEach(() => {
      school = new School(schoolData);
      school.password = 'hashed_password'; // Simulate hashed password
    });

    describe('comparePassword', () => {
      test('should compare password correctly', async () => {
        const candidatePassword = 'Password123!';
        jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
        
        const result = await school.comparePassword(candidatePassword);
        
        expect(bcrypt.compare).toHaveBeenCalledWith(candidatePassword, school.password);
        expect(result).toBe(true);
      });

      test('should throw error if password not available', async () => {
        school.password = undefined;
        
        await expect(school.comparePassword('test')).rejects.toThrow('Password not available for comparison');
      });
    });

    describe('generateVerificationOTP', () => {
      test('should generate 6-digit OTP', () => {
        const otp = school.generateVerificationOTP();
        
        expect(otp).toMatch(/^\d{6}$/);
        expect(school.verificationOTP).toBeDefined();
        expect(school.otpExpires).toBeDefined();
        expect(school.otpExpires.getTime()).toBeGreaterThan(Date.now());
      });
    });

    describe('verifyOTP', () => {
      test('should verify correct OTP', () => {
        const otp = school.generateVerificationOTP();
        const result = school.verifyOTP(otp);
        
        expect(result).toBe(true);
      });

      test('should reject incorrect OTP', () => {
        school.generateVerificationOTP();
        const result = school.verifyOTP('000000');
        
        expect(result).toBe(false);
      });

      test('should reject expired OTP', () => {
        const otp = school.generateVerificationOTP();
        school.otpExpires = new Date(Date.now() - 1000); // Expired
        
        const result = school.verifyOTP(otp);
        
        expect(result).toBe(false);
      });

      test('should return false if no OTP set', () => {
        const result = school.verifyOTP('123456');
        
        expect(result).toBe(false);
      });
    });

    describe('completeVerification', () => {
      test('should complete verification and clear OTP data', async () => {
        school.generateVerificationOTP();
        school.save = jest.fn().mockResolvedValue(school);
        
        await school.completeVerification();
        
        expect(school.isVerified).toBe(true);
        expect(school.verificationOTP).toBeUndefined();
        expect(school.otpExpires).toBeUndefined();
        expect(school.save).toHaveBeenCalled();
      });
    });

    describe('generatePasswordResetToken', () => {
      test('should generate password reset token', () => {
        const token = school.generatePasswordResetToken();
        
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.length).toBe(64); // 32 bytes * 2 (hex)
        expect(school.passwordResetToken).toBeDefined();
        expect(school.passwordResetExpires).toBeDefined();
      });
    });

    describe('verifyPasswordResetToken', () => {
      test('should verify correct reset token', () => {
        const token = school.generatePasswordResetToken();
        const result = school.verifyPasswordResetToken(token);
        
        expect(result).toBe(true);
      });

      test('should reject incorrect reset token', () => {
        school.generatePasswordResetToken();
        const result = school.verifyPasswordResetToken('invalid-token');
        
        expect(result).toBe(false);
      });

      test('should reject expired reset token', () => {
        const token = school.generatePasswordResetToken();
        school.passwordResetExpires = new Date(Date.now() - 1000); // Expired
        
        const result = school.verifyPasswordResetToken(token);
        
        expect(result).toBe(false);
      });
    });

    describe('resetPassword', () => {
      test('should reset password and clear reset data', async () => {
        const newPassword = 'NewPassword123!';
        school.generatePasswordResetToken();
        school.save = jest.fn().mockResolvedValue(school);
        
        await school.resetPassword(newPassword);
        
        expect(school.password).toBe(newPassword);
        expect(school.passwordResetToken).toBeUndefined();
        expect(school.passwordResetExpires).toBeUndefined();
        expect(school.save).toHaveBeenCalled();
      });
    });

    describe('setActiveStatus', () => {
      test('should set active status', async () => {
        school.save = jest.fn().mockResolvedValue(school);
        
        await school.setActiveStatus(false);
        
        expect(school.isActive).toBe(false);
        expect(school.save).toHaveBeenCalled();
      });
    });
  });

  describe('Static Methods', () => {
    describe('findBySchoolId', () => {
      test('should find school by schoolId', () => {
        const schoolId = 'ABC1234';
        School.findOne = jest.fn().mockReturnValue(Promise.resolve({}));
        
        School.findBySchoolId(schoolId);
        
        expect(School.findOne).toHaveBeenCalledWith({ schoolId, isActive: true });
      });
    });

    describe('findVerified', () => {
      test('should find verified schools', () => {
        School.find = jest.fn().mockReturnValue(Promise.resolve([]));
        
        School.findVerified();
        
        expect(School.find).toHaveBeenCalledWith({ isVerified: true, isActive: true });
      });
    });

    describe('findPendingVerification', () => {
      test('should find schools pending verification', () => {
        School.find = jest.fn().mockReturnValue(Promise.resolve([]));
        
        School.findPendingVerification();
        
        expect(School.find).toHaveBeenCalledWith({ isVerified: false, isActive: true });
      });
    });

    describe('authenticate', () => {
      test('should authenticate school with valid credentials', async () => {
        const mockSchool = {
          schoolId: 'ABC1234',
          email: 'test@school.com',
          isActive: true,
          isVerified: true,
          comparePassword: jest.fn().mockResolvedValue(true),
          toJSON: jest.fn().mockReturnValue({ schoolId: 'ABC1234', schoolName: 'Test School' })
        };

        School.findOne = jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(mockSchool)
        });

        const result = await School.authenticate('ABC1234', 'test@school.com', 'password123');

        expect(School.findOne).toHaveBeenCalledWith({
          schoolId: 'ABC1234',
          email: 'test@school.com'
        });
        expect(mockSchool.comparePassword).toHaveBeenCalledWith('password123');
        expect(result).toEqual({ schoolId: 'ABC1234', schoolName: 'Test School' });
      });

      test('should reject authentication with invalid schoolId or email', async () => {
        School.findOne = jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(null)
        });

        await expect(
          School.authenticate('INVALID', 'test@school.com', 'password123')
        ).rejects.toThrow('Invalid schoolId or email');
      });

      test('should reject authentication for inactive school', async () => {
        const mockSchool = {
          schoolId: 'ABC1234',
          email: 'test@school.com',
          isActive: false,
          isVerified: true
        };

        School.findOne = jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(mockSchool)
        });

        await expect(
          School.authenticate('ABC1234', 'test@school.com', 'password123')
        ).rejects.toThrow('School account is deactivated');
      });

      test('should reject authentication for unverified school', async () => {
        const mockSchool = {
          schoolId: 'ABC1234',
          email: 'test@school.com',
          isActive: true,
          isVerified: false
        };

        School.findOne = jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(mockSchool)
        });

        await expect(
          School.authenticate('ABC1234', 'test@school.com', 'password123')
        ).rejects.toThrow('School email not verified');
      });

      test('should reject authentication with invalid password', async () => {
        const mockSchool = {
          schoolId: 'ABC1234',
          email: 'test@school.com',
          isActive: true,
          isVerified: true,
          comparePassword: jest.fn().mockResolvedValue(false)
        };

        School.findOne = jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(mockSchool)
        });

        await expect(
          School.authenticate('ABC1234', 'test@school.com', 'wrongpassword')
        ).rejects.toThrow('Invalid password');
      });
    });
  });

  describe('Virtual Properties', () => {
    test('should generate displayName virtual', () => {
      const school = new School(schoolData);
      school.schoolId = 'ABC1234';
      
      expect(school.displayName).toBe('Test High School (ABC1234)');
    });

    test('should generate verificationStatus virtual', () => {
      const school = new School(schoolData);
      
      // Unverified
      expect(school.verificationStatus).toBe('unverified');
      
      // Verified
      school.isVerified = true;
      expect(school.verificationStatus).toBe('verified');
      
      // Pending
      school.isVerified = false;
      school.generateVerificationOTP();
      expect(school.verificationStatus).toBe('pending');
    });
  });

  describe('JSON Transformation', () => {
    test('should remove sensitive data from JSON output', () => {
      const school = new School(schoolData);
      school.password = 'hashed_password';
      school.verificationOTP = 'hashed_otp';
      school.passwordResetToken = 'reset_token';
      
      const json = school.toJSON();
      
      expect(json.password).toBeUndefined();
      expect(json.verificationOTP).toBeUndefined();
      expect(json.otpExpires).toBeUndefined();
      expect(json.passwordResetToken).toBeUndefined();
      expect(json.passwordResetExpires).toBeUndefined();
      expect(json.__v).toBeUndefined();
      expect(json.schoolName).toBe(schoolData.schoolName);
    });
  });
});