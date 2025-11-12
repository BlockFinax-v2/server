/**
 * Stats Controller
 * Handles server statistics and monitoring data
 */

class StatsController {
  constructor(socketService) {
    this.socketService = socketService;
  }

  /**
   * Get server statistics
   */
  getStats(req, res) {
    try {
      const stats = this.socketService.getStats();
      
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve stats',
        message: error.message
      });
    }
  }

  /**
   * Get basic server metrics
   */
  getMetrics(req, res) {
    try {
      const stats = this.socketService.getStats();
      
      res.status(200).json({
        success: true,
        data: {
          totalConnections: stats.totalConnections,
          onlineUsers: stats.onlineUsers,
          activeCalls: stats.totalActiveCalls,
          timestamp: stats.timestamp
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve metrics',
        message: error.message
      });
    }
  }

  /**
   * Get online users (admin only)
   */
  getOnlineUsers(req, res) {
    try {
      const stats = this.socketService.getStats();
      
      res.status(200).json({
        success: true,
        data: {
          users: stats.connectedUsers,
          count: stats.onlineUsers,
          timestamp: stats.timestamp
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve online users',
        message: error.message
      });
    }
  }

  /**
   * Get active calls (admin only)
   */
  getActiveCalls(req, res) {
    try {
      const stats = this.socketService.getStats();
      
      res.status(200).json({
        success: true,
        data: {
          calls: stats.activeCalls,
          count: stats.totalActiveCalls,
          timestamp: stats.timestamp
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve active calls',
        message: error.message
      });
    }
  }
}

module.exports = StatsController;