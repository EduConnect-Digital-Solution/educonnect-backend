/**
 * Async Error Handler Utility
 * Wraps async functions to catch errors and pass them to Express error handler
 */

const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = catchAsync;