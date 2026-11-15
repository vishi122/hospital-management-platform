const pino = require('pino');
const pinoHttp = require('pino-http');
const crypto = require('crypto');
const config = require('./config');

const pinoOptions = {
  level: config.LOG_LEVEL,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'password', 'token'],
    censor: '[REDACTED]',
  },
};

const logger = pino(pinoOptions);

const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existingId = req.headers['x-request-id'] || crypto.randomUUID();
    // Set X-Request-Id header on response early before response body is sent
    res.setHeader('X-Request-Id', existingId);
    return existingId;
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} completed with status ${res.statusCode}`;
  },
  customErrorMessage: (req, res, error) => {
    return `${req.method} ${req.url} failed with status ${res.statusCode}: ${error.message}`;
  },
  customAttributeKeys: {
    req: 'request',
    res: 'response',
    err: 'error',
    responseTime: 'responseTimeMs',
  },
  customProps: (req) => {
    return {
      requestId: req.id,
      userId: req.user ? req.user.id : undefined,
      userRole: req.user ? req.user.role : undefined,
    };
  },
});

module.exports = {
  logger,
  httpLogger,
};
