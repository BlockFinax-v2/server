/**
 * Error Handler Middleware
 * Centralized error handling for the application
 */

const logger = require('../utils/logger');
const config = require('../config');

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Set default error status
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  // Prepare error response
  const errorResponse = {
    error: true,
    message: message,
    statusCode: statusCode,
    timestamp: new Date().toISOString()
  };

  // Include stack trace in development
  if (config.nodeEnv === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.details = err;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res) => {
  const message = `Route ${req.originalUrl} not found`;
  
  logger.warn(`404 Not Found: ${req.method} ${req.originalUrl} - ${req.ip}`);
  
  res.status(404).json({
    error: true,
    message: message,
    statusCode: 404,
    timestamp: new Date().toISOString()
  });
};

/**
 * Async error handler wrapper
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
};