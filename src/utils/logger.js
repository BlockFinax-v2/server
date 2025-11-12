/**
 * Logger Utility
 * Centralized logging for the application
 */

const config = require('../config');

class Logger {
  constructor() {
    this.logLevel = config.logging.level;
  }

  /**
   * Log levels in order of severity
   */
  static LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
  };

  /**
   * Check if log level is enabled
   */
  isLevelEnabled(level) {
    const currentLevel = Logger.LEVELS[this.logLevel] || 2;
    const messageLevel = Logger.LEVELS[level] || 2;
    return messageLevel <= currentLevel;
  }

  /**
   * Format log message
   */
  formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (typeof message === 'string') {
      return `${prefix} ${message}`;
    }
    
    return `${prefix} ${JSON.stringify(message)}`;
  }

  /**
   * Error logging
   */
  error(message, ...args) {
    if (this.isLevelEnabled('error')) {
      console.error(this.formatMessage('error', message), ...args);
    }
  }

  /**
   * Warning logging
   */
  warn(message, ...args) {
    if (this.isLevelEnabled('warn')) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  /**
   * Info logging
   */
  info(message, ...args) {
    if (this.isLevelEnabled('info')) {
      console.log(this.formatMessage('info', message), ...args);
    }
  }

  /**
   * Debug logging
   */
  debug(message, ...args) {
    if (this.isLevelEnabled('debug')) {
      console.log(this.formatMessage('debug', message), ...args);
    }
  }

  /**
   * HTTP request logging
   */
  request(req, res, responseTime) {
    const { method, url, ip } = req;
    const { statusCode } = res;
    const userAgent = req.get('User-Agent') || 'Unknown';
    
    this.info(`${method} ${url} - ${statusCode} - ${responseTime}ms - ${ip} - ${userAgent}`);
  }
}

// Export singleton instance
module.exports = new Logger();