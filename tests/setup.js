const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const config = require('../src/config');
const { connectDB, disconnectDB } = require('../src/db');
const User = require('../src/models/User');
const Doctor = require('../src/models/Doctor');
const Appointment = require('../src/models/Appointment');
const AuditEvent = require('../src/models/AuditEvent');

const TEST_MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hospital_test';

async function initTestDB() {
  await connectDB(TEST_MONGO_URI);
}

async function clearTestDB() {
  if (mongoose.connection.readyState === 1) {
    await Promise.all([
      User.deleteMany({}),
      Doctor.deleteMany({}),
      Appointment.deleteMany({}),
      AuditEvent.deleteMany({}),
    ]);
  }
}

async function closeTestDB() {
  await disconnectDB();
}

function generateTestToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    },
    config.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function createTestUser({
  name = 'Test User',
  email = 'test@hospital.local',
  password = 'Password123!',
  role = 'patient',
} = {}) {
  return User.create({ name, email, password, role });
}

async function createTestDoctor({
  name = 'Dr. Test Surgeon',
  specialization = 'Surgery',
  email = 'test.doc@hospital.local',
} = {}) {
  return Doctor.create({
    name,
    specialization,
    email,
    phone: '+1-555-9999',
    department: 'Surgery Dept',
    workingHours: { start: '09:00', end: '17:00' },
    slotDurationMinutes: 30,
  });
}

/**
 * Returns a valid future slot ISO string aligned to 30-min window within 09:00 - 16:30 UTC
 * @param {number} daysAhead
 * @param {number} hour
 * @param {number} minute
 */
function getValidFutureSlot(daysAhead = 2, hour = 11, minute = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute, 0, 0)
  ).toISOString();
}

module.exports = {
  TEST_MONGO_URI,
  initTestDB,
  clearTestDB,
  closeTestDB,
  generateTestToken,
  createTestUser,
  createTestDoctor,
  getValidFutureSlot,
};
