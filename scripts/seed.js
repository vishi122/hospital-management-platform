const { connectDB, disconnectDB } = require('../src/db');
const User = require('../src/models/User');
const Doctor = require('../src/models/Doctor');
const Appointment = require('../src/models/Appointment');
const AuditEvent = require('../src/models/AuditEvent');
const { logger } = require('../src/logger');

async function seed() {
  try {
    logger.info('Starting database seeding with synthetic test data...');
    await connectDB();

    // Clean existing synthetic records
    await Promise.all([
      User.deleteMany({}),
      Doctor.deleteMany({}),
      Appointment.deleteMany({}),
      AuditEvent.deleteMany({}),
    ]);
    logger.info('Cleaned existing collections.');

    // 1. Create Synthetic Users
    const users = await User.create([
      {
        name: 'System Administrator',
        email: 'admin@hospital.local',
        password: 'AdminPassword123!',
        role: 'admin',
      },
      {
        name: 'Dr. Sarah Smith',
        email: 'doctor.smith@hospital.local',
        password: 'DoctorPassword123!',
        role: 'doctor',
      },
      {
        name: 'Dr. David Jones',
        email: 'doctor.jones@hospital.local',
        password: 'DoctorPassword123!',
        role: 'doctor',
      },
      {
        name: 'Dr. Lisa Chen',
        email: 'doctor.chen@hospital.local',
        password: 'DoctorPassword123!',
        role: 'doctor',
      },
      {
        name: 'John Patient Doe',
        email: 'patient.john@hospital.local',
        password: 'PatientPassword123!',
        role: 'patient',
      },
      {
        name: 'Emma Patient Watson',
        email: 'patient.emma@hospital.local',
        password: 'PatientPassword123!',
        role: 'patient',
      },
      {
        name: 'Alex Patient Taylor',
        email: 'patient.alex@hospital.local',
        password: 'PatientPassword123!',
        role: 'patient',
      },
    ]);

    logger.info(`Seeded ${users.length} synthetic user accounts.`);

    // 2. Create Synthetic Doctors
    const doctorUsers = users.filter((u) => u.role === 'doctor');
    const doctors = await Doctor.create([
      {
        name: 'Dr. Sarah Smith',
        specialization: 'Cardiology',
        email: 'doctor.smith@hospital.local',
        phone: '+1-555-0101',
        department: 'Cardiovascular Medicine',
        workingHours: { start: '09:00', end: '17:00' },
        slotDurationMinutes: 30,
        userId: doctorUsers[0]._id,
      },
      {
        name: 'Dr. David Jones',
        specialization: 'Neurology',
        email: 'doctor.jones@hospital.local',
        phone: '+1-555-0102',
        department: 'Neurosciences',
        workingHours: { start: '09:00', end: '17:00' },
        slotDurationMinutes: 30,
        userId: doctorUsers[1]._id,
      },
      {
        name: 'Dr. Lisa Chen',
        specialization: 'Pediatrics',
        email: 'doctor.chen@hospital.local',
        phone: '+1-555-0103',
        department: 'Children Health',
        workingHours: { start: '09:00', end: '17:00' },
        slotDurationMinutes: 30,
        userId: doctorUsers[2]._id,
      },
      {
        name: 'Dr. Marcus Vance',
        specialization: 'Orthopedics',
        email: 'doctor.vance@hospital.local',
        phone: '+1-555-0104',
        department: 'Surgical Orthopedics',
        workingHours: { start: '09:00', end: '17:00' },
        slotDurationMinutes: 30,
      },
    ]);

    logger.info(`Seeded ${doctors.length} synthetic doctors.`);

    // 3. Create Sample Initial Appointment
    const patientJohn = users.find((u) => u.email === 'patient.john@hospital.local');
    const drSmith = doctors.find((d) => d.email === 'doctor.smith@hospital.local');

    // Create a slot for tomorrow at 10:00 UTC
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const sampleSlot = new Date(
      Date.UTC(
        tomorrow.getUTCFullYear(),
        tomorrow.getUTCMonth(),
        tomorrow.getUTCDate(),
        10,
        0,
        0,
        0
      )
    );

    const initialAppointment = await Appointment.create({
      patientId: patientJohn._id,
      doctorId: drSmith._id,
      slotTime: sampleSlot,
      status: 'confirmed',
      reason: 'Routine annual cardiology review',
      notes: 'Initial checkup seeded for demo purposes',
    });

    await AuditEvent.create({
      who: 'system_seeder',
      role: 'admin',
      action: 'CREATE_APPOINTMENT',
      entity: 'Appointment',
      entityId: initialAppointment._id.toString(),
      details: { seeded: true, slotTime: sampleSlot.toISOString() },
      timestamp: new Date(),
    });

    logger.info('Synthetic data seeding completed successfully!');
    logger.info('====================================================');
    logger.info('Sample Login Accounts (Password for all users):');
    logger.info('  Admin:   admin@hospital.local        / AdminPassword123!');
    logger.info('  Doctor:  doctor.smith@hospital.local  / DoctorPassword123!');
    logger.info('  Doctor:  doctor.jones@hospital.local  / DoctorPassword123!');
    logger.info('  Patient: patient.john@hospital.local  / PatientPassword123!');
    logger.info('  Patient: patient.emma@hospital.local  / PatientPassword123!');
    logger.info('====================================================');

    await disconnectDB();
    process.exit(0);
  } catch (err) {
    logger.fatal({ err }, 'Failed to seed database');
    await disconnectDB();
    process.exit(1);
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
