const mongoose = require('mongoose');
const config = require('./config');
const { logger } = require('./logger');

let isConnected = false;

async function connectDB(customUri = null) {
  const uri = customUri || config.MONGO_URI;

  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      autoIndex: true, // Build indexes automatically
    });

    isConnected = true;
    logger.info(
      { uri: uri.replace(/:([^:@]{1,})@/, ':****@') },
      'Connected to MongoDB successfully'
    );

    // Ensure models are registered and indexes are created before serving traffic
    const Appointment = require('./models/Appointment');
    const User = require('./models/User');
    const Doctor = require('./models/Doctor');
    const AuditEvent = require('./models/AuditEvent');

    await Promise.all([Appointment.init(), User.init(), Doctor.init(), AuditEvent.init()]);

    logger.info('MongoDB indexes verified and ready');
    return mongoose.connection;
  } catch (err) {
    isConnected = false;
    logger.error({ err }, 'Failed to connect to MongoDB');
    throw err;
  }
}

async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('Disconnected from MongoDB');
  }
}

async function checkReadiness() {
  try {
    if (mongoose.connection.readyState !== 1) {
      return false;
    }
    const result = await mongoose.connection.db.command({ ping: 1 });
    return result && result.ok === 1;
  } catch (err) {
    logger.warn({ err: err.message }, 'MongoDB readiness ping failed');
    return false;
  }
}

module.exports = {
  connectDB,
  disconnectDB,
  checkReadiness,
  mongoose,
};
