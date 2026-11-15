require('dotenv').config();

const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 3000,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/hospital_db',
  JWT_SECRET: process.env.JWT_SECRET || 'dev_jwt_secret_insecure_please_override_in_env_file',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  ENABLE_METRICS: process.env.ENABLE_METRICS === 'true' || process.env.ENABLE_METRICS === undefined,
};

module.exports = config;
