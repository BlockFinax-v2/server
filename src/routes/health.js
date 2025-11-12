/**
 * Health Routes
 * Routes for health checks and monitoring
 */

const express = require('express');
const HealthController = require('../controllers/HealthController');

const router = express.Router();

// Basic health check
router.get('/', HealthController.healthCheck);

// Detailed health check
router.get('/detailed', HealthController.detailedHealthCheck);

// Kubernetes probes
router.get('/ready', HealthController.readiness);
router.get('/live', HealthController.liveness);

module.exports = router;