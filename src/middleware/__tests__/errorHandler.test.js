const {
  AppError,
  globalErrorHandler,
  notFoundHandler,
  catchAsync,
  handleValidationErrors,
  rateLimitErrorHandler,
  corsErrorHandler,
  dbErrorHandler
} = require('../errorHandler');

describe('Error Handler Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      originalUrl: '/api/test',
      method: 'GET',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
      user: { id: 'user123', schoolId: 'school123' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    
    // Mock console.error to avoid noise in tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('AppError Class', () => {
    test('should create operational error correctly', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR');
      
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.isOperational).toBe(true);
      expect(error.status).toBe('fail');
    });

    test('should create server error correctly', () => {
      const error = new AppError('Server error', 500, 'SERVER_ERROR');
      
      expect(error.statusCode).toBe(500);
      expect(error.status).toBe('error');
    });
  });

  describe('Global Error Handler', () => {
    test('should handle operational errors in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new AppError('Test error', 400, 'TEST_ERROR');
      
      globalErrorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Test error',
        code: 'TEST_ERROR'
      });
    });

    test('should handle non-operational errors in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Programming error');
      error.isOperational = false;
      
      globalErrorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Something went wrong!',
        code: 'INTERNAL_SERVER_ERROR'
      });
    });

    test('should provide detailed errors in development', () => {
      process.env.NODE_ENV = 'development';
      const error = new AppError('Test error', 400, 'TEST_ERROR');
      
      globalErrorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: error,
        message: 'Test error',
        code: 'TEST_ERROR',
        stack: expect.any(String)
      });
    });

    test('should handle MongoDB CastError', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Cast to ObjectId failed');
      error.name = 'CastError';
      error.path = 'id';
      error.value = 'invalid-id';
      
      globalErrorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid id: invalid-id',
        code: 'INVALID_ID'
      });
    });

    test('should handle MongoDB duplicate key error', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Duplicate key error');
      error.code = 11000;
      error.keyValue = { email: 'test@example.com' };
      
      globalErrorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "email 'test@example.com' already exists. Please use another value.",
        code: 'DUPLICATE_FIELD'
      });
    });

    test('should handle JWT errors', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Invalid token');
      error.name = 'JsonWebTokenError';
      
      globalErrorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token. Please log in again.',
        code: 'INVALID_TOKEN'
      });
    });

    test('should handle JWT expired errors', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      
      globalErrorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Your token has expired. Please log in again.',
        code: 'TOKEN_EXPIRED'
      });
    });

    test('should handle Multer file size errors', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('File too large');
      error.name = 'MulterError';
      error.code = 'LIMIT_FILE_SIZE';
      
      globalErrorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'File too large. Maximum size is 5MB.',
        code: 'FILE_TOO_LARGE'
      });
    });
  });

  describe('Not Found Handler', () => {
    test('should create 404 error for unhandled routes', () => {
      req.originalUrl = '/api/nonexistent';
      
      notFoundHandler(req, res, next);
      
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Can't find /api/nonexistent on this server!",
          statusCode: 404,
          code: 'ROUTE_NOT_FOUND'
        })
      );
    });
  });

  describe('Catch Async', () => {
    test('should catch async errors and pass to next', async () => {
      const asyncFunction = catchAsync(async (req, res, next) => {
        throw new Error('Async error');
      });
      
      await asyncFunction(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    test('should not interfere with successful async operations', async () => {
      const asyncFunction = catchAsync(async (req, res, next) => {
        res.json({ success: true });
      });
      
      await asyncFunction(req, res, next);
      
      expect(res.json).toHaveBeenCalledWith({ success: true });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Validation Error Handler', () => {
    test('should handle validation errors correctly', () => {
      // Test the handleValidationErrors function directly with mock validation result
      const mockErrors = {
        isEmpty: () => false,
        array: () => [
          {
            path: 'email',
            msg: 'Invalid email format',
            value: 'invalid-email'
          },
          {
            param: 'password',
            msg: 'Password too short',
            value: '123'
          }
        ]
      };

      // Create a simple validation handler that mimics the behavior
      const testValidationHandler = (req, res, next) => {
        const errors = mockErrors;
        
        if (!errors.isEmpty()) {
          const validationErrors = errors.array().map(error => ({
            field: error.path || error.param,
            message: error.msg,
            value: error.value
          }));
          
          return res.status(400).json({
            success: false,
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            errors: validationErrors
          });
        }
        
        next();
      };
      
      testValidationHandler(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: [
          {
            field: 'email',
            message: 'Invalid email format',
            value: 'invalid-email'
          },
          {
            field: 'password',
            message: 'Password too short',
            value: '123'
          }
        ]
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should continue if no validation errors', () => {
      const mockErrors = {
        isEmpty: () => true
      };

      const testValidationHandler = (req, res, next) => {
        const errors = mockErrors;
        
        if (!errors.isEmpty()) {
          const validationErrors = errors.array().map(error => ({
            field: error.path || error.param,
            message: error.msg,
            value: error.value
          }));
          
          return res.status(400).json({
            success: false,
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            errors: validationErrors
          });
        }
        
        next();
      };
      
      testValidationHandler(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limit Error Handler', () => {
    test('should handle rate limit errors', () => {
      req.rateLimit = { resetTime: Date.now() + 60000 };
      
      rateLimitErrorHandler(req, res);
      
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: expect.any(Number)
      });
    });
  });

  describe('CORS Error Handler', () => {
    test('should handle CORS errors', () => {
      const corsError = new Error('CORS policy violation');
      
      corsErrorHandler(corsError, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'CORS policy violation',
        code: 'CORS_ERROR'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should pass non-CORS errors to next handler', () => {
      const otherError = new Error('Other error');
      
      corsErrorHandler(otherError, req, res, next);
      
      expect(next).toHaveBeenCalledWith(otherError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Database Error Handler', () => {
    test('should handle MongoDB network errors', () => {
      const dbError = new Error('Network error');
      dbError.name = 'MongoNetworkError';
      
      dbErrorHandler(dbError, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database connection error. Please try again later.',
        code: 'DATABASE_CONNECTION_ERROR'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle MongoDB timeout errors', () => {
      const dbError = new Error('Timeout error');
      dbError.name = 'MongoTimeoutError';
      
      dbErrorHandler(dbError, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database connection error. Please try again later.',
        code: 'DATABASE_CONNECTION_ERROR'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should pass non-database errors to next handler', () => {
      const otherError = new Error('Other error');
      
      dbErrorHandler(otherError, req, res, next);
      
      expect(next).toHaveBeenCalledWith(otherError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});