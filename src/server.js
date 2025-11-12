/**
 * BlockFinax Server Application
 * Main server entry point with proper structure and error handling
 */

const express = require('express');
const { createServer } = require('http');
const path = require('path');

// Configuration and utilities
const config = require('./config');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler').errorHandler;

// Services
const SocketService = require('./services/SocketService');

// Routes
const healthRoutes = require('./routes/health');
const apiRoutes = require('./routes/api');

// Middleware
const securityMiddleware = require('./middleware/security');
const requestLogger = require('./middleware/requestLogger');

class BlockFinaxServer {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.socketService = new SocketService(this.server);
  }

  /**
   * Initialize middleware
   */
  initializeMiddleware() {
    // Security middleware
    this.app.use(securityMiddleware);
    
    // Request logging
    this.app.use(requestLogger);
    
    // Body parsing
    this.app.use(express.json({ limit: config.security.maxRequestSize }));
    this.app.use(express.urlencoded({ extended: true, limit: config.security.maxRequestSize }));
  }

  /**
   * Initialize routes
   */
  initializeRoutes() {
    // Health check routes
    this.app.use('/health', healthRoutes);
    
    // Initialize API routes with socket service
    apiRoutes.initializeRoutes(this.socketService);
    this.app.use('/api', apiRoutes);
    
    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'BlockFinax Server',
        version: '2.0.0',
        status: 'running',
        environment: config.nodeEnv,
        timestamp: new Date().toISOString()
      });
    });
    
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Initialize error handling
   */
  initializeErrorHandling() {
    this.app.use(errorHandler);
  }

  /**
   * Initialize Socket.IO service
   */
  initializeSocketService() {
    this.socketService.initialize();
  }

  /**
   * Start the server
   */
  async start() {
    try {
      // Initialize components
      this.initializeMiddleware();
      this.initializeRoutes();
      this.initializeSocketService();
      this.initializeErrorHandling();

      // Start listening
      this.server.listen(config.port, () => {
        logger.info(`🚀 BlockFinax server started successfully!`);
        logger.info(`📍 Server running on port ${config.port}`);
        logger.info(`🌍 Environment: ${config.nodeEnv}`);
        logger.info(`🔗 Socket.IO initialized and ready`);
        
        if (config.nodeEnv === 'development') {
          logger.info(`🏥 Health check: http://localhost:${config.port}/health`);
          logger.info(`📊 Stats endpoint: http://localhost:${config.port}/api/stats`);
        }
      });

      // Graceful shutdown handling
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * Setup graceful shutdown
   */
  setupGracefulShutdown() {
    const shutdown = (signal) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      
      this.server.close(() => {
        logger.info('HTTP server closed.');
        
        // Close socket connections
        this.socketService.cleanup();
        
        logger.info('Application shut down gracefully.');
        process.exit(0);
      });
      
      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after 10 seconds');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Create and start server
const server = new BlockFinaxServer();
server.start();

module.exports = server;