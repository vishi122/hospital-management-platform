const client = require('prom-client');
const config = require('./config');

const register = new client.Registry();

if (config.ENABLE_METRICS) {
  client.collectDefaultMetrics({
    register,
    prefix: 'hospital_',
  });
}

const httpRequestDuration = new client.Histogram({
  name: 'hospital_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

const appointmentCounter = new client.Counter({
  name: 'hospital_appointments_total',
  help: 'Total count of appointment operations',
  labelNames: ['action', 'status'],
  registers: [register],
});

const metricsMiddleware = (req, res, next) => {
  if (
    !config.ENABLE_METRICS ||
    req.path === '/metrics' ||
    req.path === '/health' ||
    req.path === '/ready'
  ) {
    return next();
  }

  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationSeconds = diff[0] + diff[1] / 1e9;
    const route = req.baseUrl + (req.route ? req.route.path : req.path);
    httpRequestDuration.observe(
      {
        method: req.method,
        route: route || req.path,
        status_code: res.statusCode,
      },
      durationSeconds
    );
  });

  next();
};

module.exports = {
  register,
  metricsMiddleware,
  appointmentCounter,
};
