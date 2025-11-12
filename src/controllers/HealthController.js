/**
 * Health Controller
 * Handles health check and monitoring endpoints
 */

class HealthController {
  /**
   * Basic health check
   */
  static healthCheck(req, res) {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  }

  /**
   * Detailed health check with dependencies
   */
  static detailedHealthCheck(req, res) {
    const memoryUsage = process.memoryUsage();
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      system: {
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
          rss: Math.round(memoryUsage.rss / 1024 / 1024)
        },
        cpu: {
          loadAverage: require('os').loadavg(),
          cpuCount: require('os').cpus().length
        },
        platform: process.platform,
        nodeVersion: process.version
      }
    });
  }

  /**
   * Readiness probe for Kubernetes
   */
  static readiness(req, res) {
    // Add any readiness checks here (database connections, etc.)
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Liveness probe for Kubernetes
   */
  static liveness(req, res) {
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = HealthController;