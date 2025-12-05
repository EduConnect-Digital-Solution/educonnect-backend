const mongoose = require('mongoose');
const crypto = require('crypto');
const OTP = require('../OTP');

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

describe('OTP Model', () => {
  let otpData;

  beforeEach(() => {
    otpData = {
      email: 'test@example.com',
      otp: '123456',
      purpose: 'email-verification',
      schoolId: 'ABC1234',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
      createdFromIP: '127.0.0.1'
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Schema Validation', () => {
    test('should create a valid OTP', () => {
      const otp = new OTP(otpData);
      const validationError = otp.validateSync();
      
      expect(validationError).toBeUndefined();
      expect(otp.email).toBe(otpData.email);
      expect(otp.purpose).toBe(otpData.purpose);
      expect(otp.isUsed).toBe(false);
      expect(otp.attemptCount).toBe(0);
      expect(otp.maxAttempts).toBe(3);
    });

    test('should require email', () => {
      delete otpData.email;
      const otp = new OTP(otpData);
      const validationError = otp.validateSync();
      
      expect(validationError.errors.email).toBeDefined();
      expect(validationError.errors.email.message).toBe('Email is required');
    });

    test('should require otp', () => {
      delete otpData.otp;
      const otp = new OTP(otpData);
      const validationError = otp.validateSync();
      
      expect(validationError.errors.otp).toBeDefined();
      expect(validationError.errors.otp.message).toBe('OTP is required');
    });

    test('should require purpose', () => {
      delete otpData.purpose;
      const otp = new OTP(otpData);
      const validationError = otp.validateSync();
      
      expect(validationError.errors.purpose).toBeDefined();
      expect(validationError.errors.purpose.message).toBe('Purpose is required');
    });

    test('should require expiresAt', () => {
      delete otpData.expiresAt;
      const otp = new OTP(otpData);
      const validationError = otp.validateSync();
      
      expect(validationError.errors.expiresAt).toBeDefined();
      expect(validationError.errors.expiresAt.message).toBe('Expiration date is required');
    });

    test('should validate email format', () => {
      otpData.email = 'invalid-email';
      const otp = new OTP(otpData);
      const validationError = otp.validateSync();
      
      expect(validationError.errors.email).toBeDefined();
      expect(validationError.errors.email.message).toBe('Please enter a valid email');
    });

    test('should validate purpose enum', () => {
      otpData.purpose = 'invalid-purpose';
      const otp = new OTP(otpData);
      const validationError = otp.validateSync();
      
      expect(validationError.errors.purpose).toBeDefined();
      expect(validationError.errors.purpose.message).toBe('Purpose must be school-signup, password-reset, email-verification, or account-activation');
    });

    test('should validate schoolId for school-signup purpose', () => {
      const invalidData = { ...otpData, purpose: 'school-signup' };
      delete invalidData.schoolId;
      const otp = new OTP(invalidData);
      const validationError = otp.validateSync();
      
      expect(validationError).toBeDefined();
      expect(validationError.errors.schoolId).toBeDefined();
      expect(validationError.errors.schoolId.message).toBe('Path `schoolId` is required.');
    });

    test('should validate attemptCount minimum', () => {
      otpData.attemptCount = -1;
      const otp = new OTP(otpData);
      const validationError = otp.validateSync();
      
      expect(validationError.errors.attemptCount).toBeDefined();
      expect(validationError.errors.attemptCount.message).toBe('Attempt count cannot be negative');
    });

    test('should validate maxAttempts minimum', () => {
      otpData.maxAttempts = 0;
      const otp = new OTP(otpData);
      const validationError = otp.validateSync();
      
      expect(validationError.errors.maxAttempts).toBeDefined();
      expect(validationError.errors.maxAttempts.message).toBe('Max attempts must be at least 1');
    });
  });

  describe('OTP Hashing', () => {
    test('should have OTP hashing functionality', () => {
      const otp = new OTP(otpData);
      
      // Test that the model has the verifyOTP method
      expect(typeof otp.verifyOTP).toBe('function');
      
      // Test that OTP field exists
      expect(otp.otp).toBe(otpData.otp);
    });
  });

  describe('Instance Methods', () => {
    let otp;

    beforeEach(() => {
      otp = new OTP(otpData);
      otp.save = jest.fn().mockResolvedValue(otp);
    });

    describe('verifyOTP', () => {
      test('should verify correct OTP', () => {
        otp.otp = crypto.createHash('sha256').update('123456').digest('hex'); // Pre-hashed
        otp.expiresAt = new Date(Date.now() + 60000); // 1 minute from now
        otp.isUsed = false;
        otp.attemptCount = 0;
        otp.maxAttempts = 3;
        
        const result = otp.verifyOTP('123456');
        
        expect(result.success).toBe(true);
        expect(result.message).toBe('OTP verified successfully');
        expect(otp.isUsed).toBe(true);
        expect(otp.usedAt).toBeInstanceOf(Date);
        expect(otp.attemptCount).toBe(1);
      });

      test('should reject incorrect OTP', () => {
        otp.otp = crypto.createHash('sha256').update('123456').digest('hex'); // Pre-hashed
        otp.expiresAt = new Date(Date.now() + 60000); // 1 minute from now
        otp.isUsed = false;
        otp.attemptCount = 0;
        otp.maxAttempts = 3;
        
        const result = otp.verifyOTP('654321');
        
        expect(result.success).toBe(false);
        expect(result.message).toBe('Invalid OTP');
        expect(otp.isUsed).toBe(false);
        expect(otp.attemptCount).toBe(1);
      });

      test('should reject already used OTP', () => {
        otp.isUsed = true;
        
        const result = otp.verifyOTP('123456');
        
        expect(result.success).toBe(false);
        expect(result.message).toBe('OTP has already been used');
      });

      test('should reject expired OTP', () => {
        otp.expiresAt = new Date(Date.now() - 60000); // 1 minute ago
        otp.isUsed = false;
        
        const result = otp.verifyOTP('123456');
        
        expect(result.success).toBe(false);
        expect(result.message).toBe('OTP has expired');
      });

      test('should reject OTP when max attempts exceeded', () => {
        otp.attemptCount = 3;
        otp.maxAttempts = 3;
        otp.isUsed = false;
        otp.expiresAt = new Date(Date.now() + 60000); // 1 minute from now
        
        const result = otp.verifyOTP('123456');
        
        expect(result.success).toBe(false);
        expect(result.message).toBe('Maximum verification attempts exceeded');
      });
    });

    describe('markAsUsed', () => {
      test('should mark OTP as used', async () => {
        const usedFromIP = '192.168.1.1';
        
        await otp.markAsUsed(usedFromIP);
        
        expect(otp.isUsed).toBe(true);
        expect(otp.usedAt).toBeInstanceOf(Date);
        expect(otp.usedFromIP).toBe(usedFromIP);
        expect(otp.save).toHaveBeenCalled();
      });

      test('should mark OTP as used without IP', async () => {
        await otp.markAsUsed();
        
        expect(otp.isUsed).toBe(true);
        expect(otp.usedAt).toBeInstanceOf(Date);
        expect(otp.save).toHaveBeenCalled();
      });
    });

    describe('isExpired', () => {
      test('should return false for non-expired OTP', () => {
        otp.expiresAt = new Date(Date.now() + 60000); // 1 minute from now
        
        expect(otp.isExpired()).toBe(false);
      });

      test('should return true for expired OTP', () => {
        otp.expiresAt = new Date(Date.now() - 60000); // 1 minute ago
        
        expect(otp.isExpired()).toBe(true);
      });
    });

    describe('isValid', () => {
      test('should return true for valid OTP', () => {
        otp.isUsed = false;
        otp.expiresAt = new Date(Date.now() + 60000); // 1 minute from now
        otp.attemptCount = 0;
        otp.maxAttempts = 3;
        
        expect(otp.isValid()).toBe(true);
      });

      test('should return false for used OTP', () => {
        otp.isUsed = true;
        otp.expiresAt = new Date(Date.now() + 60000); // 1 minute from now
        otp.attemptCount = 0;
        otp.maxAttempts = 3;
        
        expect(otp.isValid()).toBe(false);
      });

      test('should return false for expired OTP', () => {
        otp.isUsed = false;
        otp.expiresAt = new Date(Date.now() - 60000); // 1 minute ago
        otp.attemptCount = 0;
        otp.maxAttempts = 3;
        
        expect(otp.isValid()).toBe(false);
      });

      test('should return false for OTP with exceeded attempts', () => {
        otp.isUsed = false;
        otp.expiresAt = new Date(Date.now() + 60000); // 1 minute from now
        otp.attemptCount = 3;
        otp.maxAttempts = 3;
        
        expect(otp.isValid()).toBe(false);
      });
    });
  });

  describe('Static Methods', () => {
    describe('generateOTP', () => {
      test('should generate 6-digit OTP by default', () => {
        const otp = OTP.generateOTP();
        
        expect(typeof otp).toBe('string');
        expect(otp).toHaveLength(6);
        expect(parseInt(otp)).toBeGreaterThanOrEqual(100000);
        expect(parseInt(otp)).toBeLessThanOrEqual(999999);
      });

      test('should generate OTP with custom length', () => {
        const otp = OTP.generateOTP(4);
        
        expect(typeof otp).toBe('string');
        expect(otp).toHaveLength(4);
        expect(parseInt(otp)).toBeGreaterThanOrEqual(1000);
        expect(parseInt(otp)).toBeLessThanOrEqual(9999);
      });
    });

    describe('createOTP', () => {
      test('should create OTP with default settings', async () => {
        OTP.prototype.save = jest.fn().mockResolvedValue();
        
        const result = await OTP.createOTP({
          email: 'test@example.com',
          purpose: 'email-verification'
        });
        
        expect(result.otpDocument).toBeInstanceOf(OTP);
        expect(result.plainOTP).toMatch(/^\d{6}$/);
        expect(result.expiresAt).toBeInstanceOf(Date);
        expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
      });

      test('should create OTP with custom settings', async () => {
        OTP.prototype.save = jest.fn().mockResolvedValue();
        
        const result = await OTP.createOTP({
          email: 'test@example.com',
          purpose: 'password-reset',
          schoolId: 'ABC1234',
          expirationMinutes: 30,
          maxAttempts: 5,
          createdFromIP: '192.168.1.1',
          metadata: { source: 'web' }
        });
        
        expect(result.otpDocument.purpose).toBe('password-reset');
        expect(result.otpDocument.schoolId).toBe('ABC1234');
        expect(result.otpDocument.maxAttempts).toBe(5);
        expect(result.otpDocument.createdFromIP).toBe('192.168.1.1');
        expect(result.otpDocument.metadata.source).toBe('web');
      });
    });

    describe('findValidOTP', () => {
      test('should find valid OTP', () => {
        OTP.findOne = jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue(Promise.resolve({}))
        });
        
        OTP.findValidOTP('test@example.com', 'email-verification', 'ABC1234');
        
        expect(OTP.findOne).toHaveBeenCalledWith({
          email: 'test@example.com',
          purpose: 'email-verification',
          schoolId: 'ABC1234',
          isUsed: false,
          expiresAt: { $gt: expect.any(Date) }
        });
      });

      test('should find valid OTP without schoolId', () => {
        OTP.findOne = jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue(Promise.resolve({}))
        });
        
        OTP.findValidOTP('test@example.com', 'password-reset');
        
        expect(OTP.findOne).toHaveBeenCalledWith({
          email: 'test@example.com',
          purpose: 'password-reset',
          isUsed: false,
          expiresAt: { $gt: expect.any(Date) }
        });
      });
    });

    describe('verifyAndConsumeOTP', () => {
      test('should verify and consume valid OTP', async () => {
        const mockOTP = {
          verifyOTP: jest.fn().mockReturnValue({ success: true, message: 'OTP verified' }),
          save: jest.fn().mockResolvedValue()
        };
        
        OTP.findValidOTP = jest.fn().mockResolvedValue(mockOTP);
        
        const result = await OTP.verifyAndConsumeOTP('test@example.com', '123456', 'email-verification', 'ABC1234', '127.0.0.1');
        
        expect(OTP.findValidOTP).toHaveBeenCalledWith('test@example.com', 'email-verification', 'ABC1234');
        expect(mockOTP.verifyOTP).toHaveBeenCalledWith('123456');
        expect(mockOTP.usedFromIP).toBe('127.0.0.1');
        expect(mockOTP.save).toHaveBeenCalled();
        expect(result).toEqual({ success: true, message: 'OTP verified' });
      });

      test('should return error if no valid OTP found', async () => {
        OTP.findValidOTP = jest.fn().mockResolvedValue(null);
        
        const result = await OTP.verifyAndConsumeOTP('test@example.com', '123456', 'email-verification');
        
        expect(result).toEqual({ success: false, message: 'No valid OTP found' });
      });
    });

    describe('cleanupExpired', () => {
      test('should cleanup expired OTPs', async () => {
        OTP.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 10 });
        
        const result = await OTP.cleanupExpired();
        
        expect(OTP.deleteMany).toHaveBeenCalledWith({
          $or: [
            { expiresAt: { $lt: expect.any(Date) } },
            { isUsed: true, usedAt: { $lt: expect.any(Date) } }
          ]
        });
        expect(result).toBe(10);
      });
    });

    describe('getStatistics', () => {
      test('should return OTP statistics', async () => {
        const mockStats = [
          {
            _id: 'email-verification',
            total: 10,
            used: 7,
            expired: 2
          },
          {
            _id: 'password-reset',
            total: 5,
            used: 3,
            expired: 1
          }
        ];

        OTP.aggregate = jest.fn().mockResolvedValue(mockStats);
        
        const result = await OTP.getStatistics('ABC1234');
        
        expect(OTP.aggregate).toHaveBeenCalled();
        expect(result).toEqual({
          'email-verification': {
            total: 10,
            used: 7,
            expired: 2,
            pending: 1
          },
          'password-reset': {
            total: 5,
            used: 3,
            expired: 1,
            pending: 1
          }
        });
      });
    });

    describe('invalidateOTPs', () => {
      test('should invalidate OTPs for email and purpose', async () => {
        OTP.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 3 });
        
        const result = await OTP.invalidateOTPs('test@example.com', 'email-verification', 'ABC1234');
        
        expect(OTP.updateMany).toHaveBeenCalledWith(
          {
            email: 'test@example.com',
            purpose: 'email-verification',
            schoolId: 'ABC1234',
            isUsed: false
          },
          {
            $set: {
              isUsed: true,
              usedAt: expect.any(Date),
              metadata: { invalidated: true, invalidatedAt: expect.any(Date) }
            }
          }
        );
        expect(result).toBe(3);
      });

      test('should invalidate OTPs without schoolId', async () => {
        OTP.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 2 });
        
        const result = await OTP.invalidateOTPs('test@example.com', 'password-reset');
        
        expect(OTP.updateMany).toHaveBeenCalledWith(
          {
            email: 'test@example.com',
            purpose: 'password-reset',
            isUsed: false
          },
          {
            $set: {
              isUsed: true,
              usedAt: expect.any(Date),
              metadata: { invalidated: true, invalidatedAt: expect.any(Date) }
            }
          }
        );
        expect(result).toBe(2);
      });
    });
  });

  describe('Virtual Properties', () => {
    test('should generate statusDisplay virtual for active OTP', () => {
      const otp = new OTP({
        ...otpData,
        isUsed: false,
        expiresAt: new Date(Date.now() + 60000), // 1 minute from now
        attemptCount: 0,
        maxAttempts: 3
      });
      
      expect(otp.statusDisplay).toBe('Active');
    });

    test('should generate statusDisplay virtual for used OTP', () => {
      const otp = new OTP({
        ...otpData,
        isUsed: true
      });
      
      expect(otp.statusDisplay).toBe('Used');
    });

    test('should generate statusDisplay virtual for expired OTP', () => {
      const otp = new OTP({
        ...otpData,
        isUsed: false,
        expiresAt: new Date(Date.now() - 60000) // 1 minute ago
      });
      
      expect(otp.statusDisplay).toBe('Expired');
    });

    test('should generate statusDisplay virtual for blocked OTP', () => {
      const otp = new OTP({
        ...otpData,
        isUsed: false,
        expiresAt: new Date(Date.now() + 60000), // 1 minute from now
        attemptCount: 3,
        maxAttempts: 3
      });
      
      expect(otp.statusDisplay).toBe('Blocked');
    });

    test('should generate timeRemaining virtual for active OTP', () => {
      const otp = new OTP({
        ...otpData,
        isUsed: false,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now
      });
      
      expect(otp.timeRemaining).toMatch(/^[45]m \d+s$/);
    });

    test('should generate timeRemaining virtual for used OTP', () => {
      const otp = new OTP({
        ...otpData,
        isUsed: true
      });
      
      expect(otp.timeRemaining).toBe('Used');
    });

    test('should generate timeRemaining virtual for expired OTP', () => {
      const otp = new OTP({
        ...otpData,
        isUsed: false,
        expiresAt: new Date(Date.now() - 60000) // 1 minute ago
      });
      
      expect(otp.timeRemaining).toBe('Expired');
    });
  });

  describe('JSON Transformation', () => {
    test('should remove sensitive data from JSON output', () => {
      const otp = new OTP(otpData);
      otp.otp = 'hashed_otp_value';
      otp.__v = 0;
      
      const json = otp.toJSON();
      
      expect(json.otp).toBeUndefined(); // OTP should never be exposed
      expect(json.__v).toBeUndefined();
      expect(json.email).toBe(otpData.email);
      expect(json.purpose).toBe(otpData.purpose);
    });
  });
});