/**
 * Security Middleware
 * Handles CORS, helmet, rate limiting, and other security measures
 */

const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const logger = require('../utils/logger');

// CORS configuration
const corsOptions = {
  origin: config.cors.origin,
  methods: config.cors.methods,
  allowedHeaders: config.cors.allowedHeaders,
  credentials: config.cors.credentials
};

// Rate limiting configuration
const rateLimitOptions = {
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMax,
  message: {
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(config.security.rateLimitWindowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json(rateLimitOptions.message);
  }
};

// Create rate limiter
const limiter = rateLimit(rateLimitOptions);

// Security middleware stack
const securityMiddleware = [
  // Helmet for security headers
  helmet(config.security.helmet),
  
  // CORS
  cors(corsOptions),
  
  // Rate limiting
  limiter,
  
  // Custom security headers
  (req, res, next) => {
    res.setHeader('X-API-Version', '2.0.0');
    res.setHeader('X-Service', 'BlockFinax');
    next();
  }
];

module.exports = securityMiddleware;