const { validationResult } = require('express-validator');
const config = require('../config');
const logger = require('../utils/logger');
const {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError
} = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

/**
 * Handle different types of errors
 */
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  if (err.keyValue) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    const message = `${field} '${value}' already exists. Please use another value.`;
    return new AppError(message, 400);
  }
  const value = err.errmsg ? err.errmsg.match(/(["'])(\\?.)*?\1/)[0] : 'duplicate value';
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new ValidationError(message, errors);
};

const handleJWTError = () =>
  new AuthenticationError('Invalid token. Please log in again.');

const handleJWTExpiredError = () =>
  new AuthenticationError('Your token has expired. Please log in again.');

const handleMulterError = (err) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new AppError('File too large. Maximum size is 5MB.', 400);
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return new AppError('Too many files', 400);
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError('Unexpected file field', 400);
  }
  return new AppError('File upload error', 400);
};

/**
 * Send error response in development
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    error: err,
    message: err.message,
    code: err.code,
    stack: err.stack,
    ...(err.errors && { errors: err.errors })
  });
};

/**
 * Send error response in production
 */
const sendErrorProd = (err, req, res) => {
  // Generate unique error ID for tracking
  const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  
  // Enhanced error logging for production debugging
  const errorDetails = {
    errorId,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get ? req.get('User-Agent') : req.headers?.['user-agent'],
    ip: req.ip || req.connection?.remoteAddress,
    body: req.body ? JSON.stringify(req.body) : 'No body',
    query: req.query ? JSON.stringify(req.query) : 'No query',
    params: req.params ? JSON.stringify(req.params) : 'No params',
    headers: {
      authorization: req.headers?.authorization ? 'Bearer [REDACTED]' : 'None',
      'content-type': req.headers?.['content-type'] || 'None',
      'x-forwarded-for': req.headers?.['x-forwarded-for'] || 'None'
    },
    error: {
      name: err.name,
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      stack: err.stack,
      isOperational: err.isOperational
    }
  };

  if (err.isOperational) {
    // Log operational errors with context
    console.warn(`🚨 OPERATIONAL ERROR [${errorId}]:`, JSON.stringify(errorDetails, null, 2));
    logger.warn('Operational Error', errorDetails);
    
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
      errorId: errorId,
      ...(err.errors && { errors: err.errors })
    });
  } else {
    // Log non-operational errors with full details
    console.error(`💥 CRITICAL ERROR [${errorId}]:`, JSON.stringify(errorDetails, null, 2));
    logger.error('Critical Error', errorDetails);

    res.status(500).json({
      success: false,
      message: 'Something went wrong!',
      code: 'INTERNAL_SERVER_ERROR',
      errorId: errorId
    });
  }
};

/**
 * Global error handling middleware
 */
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;
    error.name = err.name;
    error.code = err.code;

    if (error.name === 'CastError') {
      error = handleCastErrorDB(error);
      error.code = 'INVALID_ID';
    }
    if (error.code === 11000) {
      error = handleDuplicateFieldsDB(error);
      error.code = 'DUPLICATE_FIELD';
    }
    if (error.name === 'ValidationError') {
      error = handleValidationErrorDB(error);
      error.code = 'VALIDATION_ERROR';
    }
    if (error.name === 'JsonWebTokenError') {
      error = handleJWTError();
      error.code = 'INVALID_TOKEN';
    }
    if (error.name === 'TokenExpiredError') {
      error = handleJWTExpiredError();
      error.code = 'TOKEN_EXPIRED';
    }
    if (error.name === 'MulterError') {
      error = handleMulterError(error);
      if (error.message.includes('File too large')) error.code = 'FILE_TOO_LARGE';
    }

    sendErrorProd(error, req, res);
  }
};

const handleNotFound = (req, res, next) => {
  const err = new NotFoundError(`Can't find ${req.originalUrl} on this server!`);
  err.code = 'ROUTE_NOT_FOUND';
  next(err);
};

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
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

const rateLimitErrorHandler = (req, res, next) => {
  if (req.rateLimit) {
    return res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
    });
  }
  next();
};

const corsErrorHandler = (err, req, res, next) => {
  if (err.message === 'CORS policy violation') {
    return res.status(403).json({
      success: false,
      message: 'CORS policy violation',
      code: 'CORS_ERROR'
    });
  }
  next(err);
};

const dbErrorHandler = (err, req, res, next) => {
  if (err.name === 'MongoNetworkError' || err.name === 'MongoTimeoutError') {
    return res.status(503).json({
      success: false,
      message: 'Database connection error. Please try again later.',
      code: 'DATABASE_CONNECTION_ERROR'
    });
  }
  next(err);
};

const logError = (err, req) => {
  logger.error('Application Error', {
    method: req.method,
    url: req.originalUrl,
    error: err
  });
};

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  catchAsync,
  globalErrorHandler,
  handleNotFound,
  notFoundHandler: handleNotFound,
  handleValidationErrors,
  rateLimitErrorHandler,
  corsErrorHandler,
  dbErrorHandler,
  logError
};