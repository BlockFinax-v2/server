/**
 * Request Logger Middleware
 * Logs HTTP requests for monitoring and debugging
 */

const logger = require('../utils/logger');

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Store original end function
  const originalEnd = res.end;
  
  // Override res.end to capture response time
  res.end = function(chunk, encoding) {
    const responseTime = Date.now() - startTime;
    
    // Log the request
    logger.request(req, res, responseTime);
    
    // Call original end function
    originalEnd.call(res, chunk, encoding);
  };
  
  next();
};

module.exports = requestLogger;