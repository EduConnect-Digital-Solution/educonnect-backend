/**
 * Async Error Handler Utility
 * Wraps async functions to catch errors and pass them to Express error handler
 */

const logger = require('./logger');

const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      // Enhanced error logging for debugging
      const errorContext = {
        functionName: fn.name || 'anonymous',
        method: req.method,
        url: req.originalUrl,
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      };

      console.error(`🔥 ASYNC ERROR CAUGHT [${req.requestId || 'NO_ID'}]:`, JSON.stringify(errorContext, null, 2));
      logger.error('Async Error Caught', errorContext);
      
      next(error);
    });
  };
};

module.exports = catchAsync;