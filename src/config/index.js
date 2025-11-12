/**
 * Application Configuration
 * Centralized configuration management for BlockFinax server
 */

const config = {
  // Server Configuration
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  },
  
  // Socket.IO Configuration
  socket: {
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6, // 1MB
    allowEIO3: true
  },
  
  // Security Configuration
  security: {
    rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
    rateLimitMax: 100, // requests per window
    maxRequestSize: '10mb',
    helmet: {
      contentSecurityPolicy: false, // Disable for development
      crossOriginEmbedderPolicy: false
    }
  },
  
  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    format: process.env.NODE_ENV === 'production' ? 'combined' : 'dev'
  },
  
  // Application Limits
  limits: {
    maxMessageLength: 1000,
    maxUsernameLength: 50,
    maxConnectedUsers: 1000,
    maxActiveCalls: 100,
    callTimeout: 30 * 1000, // 30 seconds
    messageRetention: 24 * 60 * 60 * 1000 // 24 hours
  }
};

module.exports = config;