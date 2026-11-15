const express = require('express');
const router = express.Router();
const db = require('../db');
const { register } = require('../metrics');
const config = require('../config');

// Liveness probe (Kubernetes / Docker HEALTHCHECK)
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'hospital-management-platform',
    version: '1.0.0',
  });
});

// Readiness probe: returns 200 only if MongoDB ping succeeds, otherwise 503
router.get('/ready', async (req, res) => {
  const isReady = await db.checkReadiness();

  if (isReady) {
    return res.status(200).json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  }

  return res.status(503).json({
    status: 'degraded',
    database: 'disconnected',
    message: 'Database connection failed or ping timed out',
    timestamp: new Date().toISOString(),
  });
});

// Prometheus metrics endpoint (Optional stretch)
router.get('/metrics', async (req, res) => {
  if (!config.ENABLE_METRICS) {
    return res.status(404).send('Metrics collection is disabled');
  }

  try {
    res.setHeader('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.send(metrics);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
