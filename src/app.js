const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { httpLogger } = require('./logger');
const { metricsMiddleware } = require('./metrics');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Route imports
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const doctorRoutes = require('./routes/doctors');
const appointmentRoutes = require('./routes/appointments');

const app = express();

// Security and utility middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Structured JSON logging with request ID tracking
app.use(httpLogger);

// Prometheus metrics tracking middleware
app.use(metricsMiddleware);

// Mount API routes
app.use('/', healthRoutes);
app.use('/auth', authRoutes);
app.use('/doctors', doctorRoutes);
app.use('/appointments', appointmentRoutes);

// 404 and global error handlers
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
