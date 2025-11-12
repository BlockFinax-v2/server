/**
 * API Routes
 * Main API routes for the application
 */

const express = require('express');

const router = express.Router();

// API Info endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'BlockFinax API',
    version: '2.0.0',
    description: 'Real-time messaging and calling API',
    endpoints: {
      health: '/health',
      stats: '/api/stats',
      metrics: '/api/metrics',
      users: '/api/users',
      calls: '/api/calls'
    },
    timestamp: new Date().toISOString()
  });
});

// This will be dynamically populated with socket service instance
let statsController = null;

// Initialize routes with socket service
function initializeRoutes(socketService) {
  const StatsController = require('../controllers/StatsController');
  statsController = new StatsController(socketService);
  
  // Stats routes
  router.get('/stats', (req, res) => statsController.getStats(req, res));
  router.get('/metrics', (req, res) => statsController.getMetrics(req, res));
  router.get('/users', (req, res) => statsController.getOnlineUsers(req, res));
  router.get('/calls', (req, res) => statsController.getActiveCalls(req, res));
}

// Export both router and initialization function
module.exports = router;
module.exports.initializeRoutes = initializeRoutes;