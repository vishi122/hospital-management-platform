const request = require('supertest');
const app = require('../src/app');
const {
  initTestDB,
  clearTestDB,
  closeTestDB,
  createTestUser,
  createTestDoctor,
  generateTestToken,
} = require('./setup');
const Appointment = require('../src/models/Appointment');

describe('Doctor Endpoints', () => {
  beforeAll(async () => {
    await initTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  it('GET /doctors lists all registered doctors', async () => {
    await createTestDoctor({
      name: 'Dr. Alpha',
      specialization: 'Cardiology',
      email: 'alpha@hospital.local',
    });
    await createTestDoctor({
      name: 'Dr. Beta',
      specialization: 'Neurology',
      email: 'beta@hospital.local',
    });

    const res = await request(app).get('/doctors');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.doctors.length).toBe(2);
  });

  it('GET /doctors/:id/slots generates available 30-minute slots and flags booked ones', async () => {
    const doctor = await createTestDoctor({ name: 'Dr. Gamma', email: 'gamma@hospital.local' });
    const patient = await createTestUser({ email: 'pat@hospital.local' });

    // Use a fixed date 3 days in the future
    const futureDate = new Date();
    futureDate.setUTCDate(futureDate.getUTCDate() + 3);
    const dateStr = futureDate.toISOString().split('T')[0];

    const bookedSlotTime = new Date(
      Date.UTC(
        futureDate.getUTCFullYear(),
        futureDate.getUTCMonth(),
        futureDate.getUTCDate(),
        10,
        0,
        0,
        0
      )
    );

    await Appointment.create({
      doctorId: doctor._id,
      patientId: patient._id,
      slotTime: bookedSlotTime,
      status: 'confirmed',
    });

    const res = await request(app).get(`/doctors/${doctor._id}/slots?date=${dateStr}`);
    expect(res.status).toBe(200);
    expect(res.body.date).toBe(dateStr);
    expect(Array.isArray(res.body.slots)).toBe(true);

    // Find the slot that was booked
    const bookedSlot = res.body.slots.find((s) => s.slotTime === bookedSlotTime.toISOString());
    expect(bookedSlot).toBeDefined();
    expect(bookedSlot.available).toBe(false);

    // Other slots should be available
    const availableSlots = res.body.slots.filter((s) => s.available);
    expect(availableSlots.length).toBeGreaterThan(0);
  });

  it('GET /doctors/:id/slots returns 404 for non-existent doctor', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app).get(`/doctors/${fakeId}/slots`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Not Found');
  });

  it('POST /doctors allows admin to create a doctor', async () => {
    const admin = await createTestUser({ email: 'admin@hospital.local', role: 'admin' });
    const token = generateTestToken(admin);

    const res = await request(app).post('/doctors').set('Authorization', `Bearer ${token}`).send({
      name: 'Dr. New Provider',
      specialization: 'Pediatrics',
      email: 'provider@hospital.local',
      department: 'Pediatrics Dept',
    });

    expect(res.status).toBe(201);
    expect(res.body.doctor).toHaveProperty('name', 'Dr. New Provider');
  });

  it('POST /doctors denies non-admin users with 403 Forbidden', async () => {
    const patient = await createTestUser({
      email: 'patient.regular@hospital.local',
      role: 'patient',
    });
    const token = generateTestToken(patient);

    const res = await request(app).post('/doctors').set('Authorization', `Bearer ${token}`).send({
      name: 'Dr. Rogue',
      specialization: 'Fake',
      email: 'rogue@hospital.local',
    });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Forbidden');
  });
});
