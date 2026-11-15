const { logger } = require('../logger');

function errorHandler(err, req, res, _next) {
  const requestId = req.id || req.headers['x-request-id'];

  // Handle MongoDB Duplicate Key Error (E11000)
  if (err.code === 11000 || (err.name === 'MongoServerError' && err.code === 11000)) {
    logger.warn(
      {
        requestId,
        path: req.originalUrl,
        keyPattern: err.keyPattern,
        keyValue: err.keyValue,
      },
      'Duplicate key conflict detected (MongoDB E11000)'
    );

    return res.status(409).json({
      error: 'Conflict',
      code: 'SLOT_ALREADY_BOOKED',
      message: 'The requested doctor already has a confirmed appointment at this slot time.',
      conflictDetails: err.keyValue || undefined,
    });
  }

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Validation failed',
      details: messages,
    });
  }

  // Handle Mongoose CastError (e.g. invalid ObjectId format)
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Bad Request',
      message: `Invalid format for field '${err.path}': ${err.value}`,
    });
  }

  // Handle explicit status codes
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  logger.error(
    {
      requestId,
      err: {
        message: err.message,
        stack: err.stack,
        name: err.name,
      },
      path: req.originalUrl,
      method: req.method,
    },
    'Unhandled server error'
  );

  return res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal Server Error' : err.name || 'Error',
    message:
      statusCode >= 500 && process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : message,
    requestId,
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    requestId: req.id,
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
