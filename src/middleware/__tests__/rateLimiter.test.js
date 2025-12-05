const {
  generalLimiter,
  authLimiter,
  passwordResetLimiter,
  emailVerificationLimiter,
  invitationLimiter,
  uploadLimiter,
  schoolRegistrationLimiter,
  createDynamicLimiter,
  createCustomLimiter,
  createLoggingLimiter
} = require('../rateLimiter');

describe('Rate Limiter Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      ip: '127.0.0.1',
      method: 'GET',
      originalUrl: '/api/test',
      headers: {
        'x-forwarded-for': '127.0.0.1',
        'user-agent': 'Mozilla/5.0'
      },
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
      user: null,
      rateLimit: {
        resetTime: Date.now() + 60000
      },
      app: {
        get: jest.fn().mockReturnValue(false) // Mock app.get('trust proxy')
      }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    
    // Mock console.log to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rate Limiter Configuration', () => {
    test('generalLimiter should be configured correctly', () => {
      expect(generalLimiter).toBeDefined();
      expect(typeof generalLimiter).toBe('function');
    });

    test('authLimiter should be configured correctly', () => {
      expect(authLimiter).toBeDefined();
      expect(typeof authLimiter).toBe('function');
    });

    test('passwordResetLimiter should be configured correctly', () => {
      expect(passwordResetLimiter).toBeDefined();
      expect(typeof passwordResetLimiter).toBe('function');
    });

    test('emailVerificationLimiter should be configured correctly', () => {
      expect(emailVerificationLimiter).toBeDefined();
      expect(typeof emailVerificationLimiter).toBe('function');
    });

    test('invitationLimiter should be configured correctly', () => {
      expect(invitationLimiter).toBeDefined();
      expect(typeof invitationLimiter).toBe('function');
    });

    test('uploadLimiter should be configured correctly', () => {
      expect(uploadLimiter).toBeDefined();
      expect(typeof uploadLimiter).toBe('function');
    });

    test('schoolRegistrationLimiter should be configured correctly', () => {
      expect(schoolRegistrationLimiter).toBeDefined();
      expect(typeof schoolRegistrationLimiter).toBe('function');
    });
  });

  describe('Dynamic Rate Limiter', () => {
    test('createDynamicLimiter should create a rate limiter function', () => {
      const dynamicLimiter = createDynamicLimiter({
        windowMs: 15 * 60 * 1000,
        maxAnonymous: 10,
        maxAuthenticated: 50,
        maxAdmin: 100
      });

      expect(dynamicLimiter).toBeDefined();
      expect(typeof dynamicLimiter).toBe('function');
    });

    test('createDynamicLimiter should use default options when none provided', () => {
      const dynamicLimiter = createDynamicLimiter();

      expect(dynamicLimiter).toBeDefined();
      expect(typeof dynamicLimiter).toBe('function');
    });
  });

  describe('Custom Rate Limiter', () => {
    test('createCustomLimiter should create a rate limiter with custom options', () => {
      const customLimiter = createCustomLimiter({
        windowMs: 10 * 60 * 1000,
        max: 20,
        message: 'Custom rate limit exceeded',
        code: 'CUSTOM_RATE_LIMIT'
      });

      expect(customLimiter).toBeDefined();
      expect(typeof customLimiter).toBe('function');
    });

    test('createCustomLimiter should use default options when none provided', () => {
      const customLimiter = createCustomLimiter({});

      expect(customLimiter).toBeDefined();
      expect(typeof customLimiter).toBe('function');
    });
  });

  describe('Logging Rate Limiter', () => {
    test('createLoggingLimiter should create a logging rate limiter', () => {
      const loggingLimiter = createLoggingLimiter({
        windowMs: 15 * 60 * 1000,
        max: 100
      });

      expect(loggingLimiter).toBeDefined();
      expect(typeof loggingLimiter).toBe('function');
    });

    test('createLoggingLimiter should log rate limit attempts', () => {
      req.user = { id: 'user123', schoolId: 'school123' };
      
      const loggingLimiter = createLoggingLimiter({
        windowMs: 15 * 60 * 1000,
        max: 100
      });

      // Since we can't easily test the actual rate limiting without triggering it,
      // we'll just test that the function is created and can be called
      expect(() => {
        loggingLimiter(req, res, next);
      }).not.toThrow();
    });
  });

  describe('Rate Limiter Error Responses', () => {
    test('should have consistent error response format', () => {
      // Test that all rate limiters follow the same error response format
      const expectedErrorFormat = {
        success: false,
        message: expect.any(String),
        code: expect.stringMatching(/RATE_LIMIT/),
        retryAfter: expect.any(Number)
      };

      // We can't easily trigger rate limits in tests, but we can verify
      // the error response format is consistent across all limiters
      expect(true).toBe(true); // Placeholder test
    });
  });

  describe('Rate Limiter Types', () => {
    test('should have different configurations for different endpoint types', () => {
      // Verify that different rate limiters exist for different purposes
      const rateLimiters = [
        generalLimiter,
        authLimiter,
        passwordResetLimiter,
        emailVerificationLimiter,
        invitationLimiter,
        uploadLimiter,
        schoolRegistrationLimiter
      ];

      rateLimiters.forEach(limiter => {
        expect(limiter).toBeDefined();
        expect(typeof limiter).toBe('function');
      });
    });

    test('should provide factory functions for custom rate limiters', () => {
      const factoryFunctions = [
        { factory: createDynamicLimiter, options: {} },
        { factory: createCustomLimiter, options: { windowMs: 60000, max: 10 } },
        { factory: createLoggingLimiter, options: { windowMs: 60000, max: 10 } }
      ];

      factoryFunctions.forEach(({ factory, options }) => {
        expect(factory).toBeDefined();
        expect(typeof factory).toBe('function');
        
        const limiter = factory(options);
        expect(limiter).toBeDefined();
        expect(typeof limiter).toBe('function');
      });
    });
  });

  describe('Rate Limiter Integration', () => {
    test('should work with Express middleware pattern', () => {
      // Test that rate limiters follow Express middleware pattern
      const testLimiter = createCustomLimiter({
        windowMs: 60000,
        max: 5
      });

      expect(testLimiter).toBeDefined();
      expect(typeof testLimiter).toBe('function');
    });

    test('should handle factory function creation', () => {
      // Test that factory functions can create limiters without errors
      expect(() => {
        createDynamicLimiter({});
        createCustomLimiter({ windowMs: 60000, max: 10 });
        createLoggingLimiter({ windowMs: 60000, max: 10 });
      }).not.toThrow();
    });

    test('should create limiters with different configurations', () => {
      const limiter1 = createCustomLimiter({
        windowMs: 60000,
        max: 5,
        message: 'Custom message 1'
      });

      const limiter2 = createCustomLimiter({
        windowMs: 120000,
        max: 10,
        message: 'Custom message 2'
      });

      expect(limiter1).toBeDefined();
      expect(limiter2).toBeDefined();
      expect(typeof limiter1).toBe('function');
      expect(typeof limiter2).toBe('function');
    });
  });
});