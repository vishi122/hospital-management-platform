const app = require('./app');
const config = require('./config');
const { connectDB, disconnectDB } = require('./db');
const { logger } = require('./logger');

let server;

async function startServer() {
  try {
    logger.info('Initializing Doctor Appointment API service...');

    // Connect to database and ensure indexes are built before accepting traffic
    await connectDB();

    server = app.listen(config.PORT, '0.0.0.0', () => {
      logger.info(
        {
          port: config.PORT,
          env: config.NODE_ENV,
          nodeVersion: process.version,
        },
        `Hospital API Server listening on port ${config.PORT}`
      );
    });

    // Graceful shutdown handling
    const shutdown = async (signal) => {
      logger.info({ signal }, 'Received shutdown signal, terminating gracefully...');
      if (server) {
        server.close(async () => {
          logger.info('HTTP server closed');
          await disconnectDB();
          logger.info('Shutdown complete');
          process.exit(0);
        });

        // Force shutdown after 10 seconds if still hanging
        setTimeout(() => {
          logger.error('Forced shutdown timeout reached (10s), exiting now');
          process.exit(1);
        }, 10000).unref();
      } else {
        process.exit(0);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason, promise) => {
      logger.error({ reason, promise }, 'Unhandled Promise Rejection');
    });

    process.on('uncaughtException', (err) => {
      logger.fatal({ err }, 'Uncaught Exception thrown');
      process.exit(1);
    });
  } catch (err) {
    logger.fatal({ err }, 'Fatal error during server startup');
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
