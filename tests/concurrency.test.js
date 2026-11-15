const request = require('supertest');
const app = require('../src/app');
const Appointment = require('../src/models/Appointment');
const {
  initTestDB,
  clearTestDB,
  closeTestDB,
  createTestUser,
  createTestDoctor,
  generateTestToken,
  getValidFutureSlot,
} = require('./setup');

describe('Concurrency Safety - Doctor Slot Booking Race Condition', () => {
  beforeAll(async () => {
    await initTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  it('Ensures exactly 1 of 10 concurrent requests succeeds (201) while 9 receive 409 Conflict', async () => {
    const N = 10;
    const doctor = await createTestDoctor({
      name: 'Dr. Concurrency Specialist',
      email: 'concurrent.dr@hospital.local',
    });

    const targetSlotTime = getValidFutureSlot(2, 10, 0);

    // Create N distinct patient users with authentication tokens
    const patients = [];
    const tokens = [];

    for (let i = 0; i < N; i++) {
      const patient = await createTestUser({
        name: `Patient ${i + 1}`,
        email: `patient_${i + 1}@hospital.local`,
        role: 'patient',
      });
      patients.push(patient);
      tokens.push(generateTestToken(patient));
    }

    // Launch N simultaneous POST /appointments requests booking the EXACT same doctor and slot
    const concurrentRequests = tokens.map((token, index) =>
      request(app)
        .post('/appointments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          doctorId: doctor._id.toString(),
          slotTime: targetSlotTime,
          reason: `Concurrent booking attempt by patient #${index + 1}`,
        })
    );

    const responses = await Promise.all(concurrentRequests);

    // Collect response status codes
    const statusCodes = responses.map((r) => r.status);
    const successes = responses.filter((r) => r.status === 201);
    const conflicts = responses.filter((r) => r.status === 409);
    const otherErrors = responses.filter((r) => r.status !== 201 && r.status !== 409);

    // Output diagnostics for test logs
    console.log(`Concurrent booking results for N=${N}:`, {
      total: responses.length,
      statusCodes: statusCodes.reduce((acc, code) => {
        acc[code] = (acc[code] || 0) + 1;
        return acc;
      }, {}),
    });

    // Validations
    expect(otherErrors.length).toBe(0);
    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(N - 1);

    // Verify 409 payload format
    conflicts.forEach((conflictRes) => {
      expect(conflictRes.body).toHaveProperty('error', 'Conflict');
      expect(conflictRes.body).toHaveProperty('code', 'SLOT_ALREADY_BOOKED');
    });

    // Verify database state: exactly ONE confirmed appointment exists in MongoDB
    const confirmedCount = await Appointment.countDocuments({
      doctorId: doctor._id,
      slotTime: new Date(targetSlotTime),
      status: 'confirmed',
    });
    expect(confirmedCount).toBe(1);
  });
});
