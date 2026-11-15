const request = require('supertest');
const app = require('../src/app');
const AuditEvent = require('../src/models/AuditEvent');
const {
  initTestDB,
  clearTestDB,
  closeTestDB,
  createTestUser,
  createTestDoctor,
  generateTestToken,
  getValidFutureSlot,
} = require('./setup');

describe('Appointments API Endpoints', () => {
  let doctor;
  let patient1;
  let patient2;
  let token1;
  let token2;

  beforeAll(async () => {
    await initTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    doctor = await createTestDoctor({ name: 'Dr. Jane Heart', email: 'dr.heart@hospital.local' });
    patient1 = await createTestUser({
      name: 'Patient One',
      email: 'pat1@hospital.local',
      role: 'patient',
    });
    patient2 = await createTestUser({
      name: 'Patient Two',
      email: 'pat2@hospital.local',
      role: 'patient',
    });
    token1 = generateTestToken(patient1);
    token2 = generateTestToken(patient2);
  });

  afterAll(async () => {
    await closeTestDB();
  });

  describe('Validation and Access Control', () => {
    it('Requires Bearer authentication (401)', async () => {
      const res = await request(app).post('/appointments').send({});
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Unauthorized');
    });

    it('Fails when doctor does not exist (404)', async () => {
      const fakeDoctorId = '507f1f77bcf86cd799439011';
      const slotTime = getValidFutureSlot(1, 10, 0);

      const res = await request(app)
        .post('/appointments')
        .set('Authorization', `Bearer ${token1}`)
        .send({ doctorId: fakeDoctorId, slotTime });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('does not exist');
    });

    it('Rejects past slot time with 400 Bad Request', async () => {
      const pastTime = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const res = await request(app)
        .post('/appointments')
        .set('Authorization', `Bearer ${token1}`)
        .send({ doctorId: doctor._id, slotTime: pastTime });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('future');
    });

    it('Rejects unaligned slot time (e.g. 10:15) with 400 Bad Request', async () => {
      const unaligned = getValidFutureSlot(1, 10, 0);
      const unalignedDate = new Date(unaligned);
      unalignedDate.setUTCMinutes(15);

      const res = await request(app)
        .post('/appointments')
        .set('Authorization', `Bearer ${token1}`)
        .send({ doctorId: doctor._id, slotTime: unalignedDate.toISOString() });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('aligned to 30-minute');
    });

    it('Rejects slot time outside operating hours (e.g. 07:00 UTC) with 400', async () => {
      const earlySlot = getValidFutureSlot(1, 7, 0);
      const res = await request(app)
        .post('/appointments')
        .set('Authorization', `Bearer ${token1}`)
        .send({ doctorId: doctor._id, slotTime: earlySlot });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('operating hours');
    });

    it('Prevents patient from booking for another patient (403 Forbidden)', async () => {
      const slotTime = getValidFutureSlot(1, 11, 0);
      const res = await request(app)
        .post('/appointments')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          doctorId: doctor._id,
          patientId: patient2._id.toString(),
          slotTime,
        });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error', 'Forbidden');
    });
  });

  describe('Booking and Concurrency Conflict', () => {
    it('Successfully books an appointment and records audit event', async () => {
      const slotTime = getValidFutureSlot(1, 14, 0);

      const res = await request(app)
        .post('/appointments')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          doctorId: doctor._id,
          slotTime,
          reason: 'General consultation',
        });

      expect(res.status).toBe(201);
      expect(res.body.appointment).toHaveProperty('_id');
      expect(res.body.appointment.status).toBe('confirmed');

      // Verify audit event
      const audit = await AuditEvent.findOne({
        action: 'CREATE_APPOINTMENT',
        entityId: res.body.appointment._id,
      });
      expect(audit).not.toBeNull();
      expect(audit.who).toBe(patient1.email);
    });

    it('Rejects duplicate booking for same doctor and slot with 409 Conflict', async () => {
      const slotTime = getValidFutureSlot(1, 14, 30);

      // First booking succeeds
      const firstRes = await request(app)
        .post('/appointments')
        .set('Authorization', `Bearer ${token1}`)
        .send({ doctorId: doctor._id, slotTime });
      expect(firstRes.status).toBe(201);

      // Second booking for same doctor & slot fails with 409
      const secondRes = await request(app)
        .post('/appointments')
        .set('Authorization', `Bearer ${token2}`)
        .send({ doctorId: doctor._id, slotTime });

      expect(secondRes.status).toBe(409);
      expect(secondRes.body).toHaveProperty('error', 'Conflict');
      expect(secondRes.body).toHaveProperty('code', 'SLOT_ALREADY_BOOKED');
    });
  });

  describe('Appointment Retrieval & Ownership', () => {
    it('Patient only sees their own appointments in GET /appointments', async () => {
      const slot1 = getValidFutureSlot(1, 10, 0);
      const slot2 = getValidFutureSlot(1, 11, 0);

      await request(app)
        .post('/appointments')
        .set('Authorization', `Bearer ${token1}`)
        .send({ doctorId: doctor._id, slotTime: slot1 });

      await request(app)
        .post('/appointments')
        .set('Authorization', `Bearer ${token2}`)
        .send({ doctorId: doctor._id, slotTime: slot2 });

      const res = await request(app).get('/appointments').set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.appointments[0].patientId._id).toBe(patient1._id.toString());
    });

    it('Patient cannot view another patient appointment by ID (403 Forbidden)', async () => {
      const slot = getValidFutureSlot(1, 12, 0);
      const bookRes = await request(app)
        .post('/appointments')
        .set('Authorization', `Bearer ${token2}`)
        .send({ doctorId: doctor._id, slotTime: slot });

      const appointmentId = bookRes.body.appointment._id;

      const res = await request(app)
        .get(`/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error', 'Forbidden');
    });
  });

  describe('Reschedule and Cancellation', () => {
    it('Reschedules confirmed appointment to a new slot and audits it', async () => {
      const oldSlot = getValidFutureSlot(1, 13, 0);
      const newSlot = getValidFutureSlot(1, 15, 0);

      const bookRes = await request(app)
        .post('/appointments')
        .set('Authorization', `Bearer ${token1}`)
        .send({ doctorId: doctor._id, slotTime: oldSlot });

      const appointmentId = bookRes.body.appointment._id;

      const res = await request(app)
        .put(`/appointments/${appointmentId}/reschedule`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ slotTime: newSlot });

      expect(res.status).toBe(200);
      expect(new Date(res.body.appointment.slotTime).toISOString()).toBe(newSlot);

      // Verify audit
      const audit = await AuditEvent.findOne({
        action: 'RESCHEDULE_APPOINTMENT',
        entityId: appointmentId,
      });
      expect(audit).not.toBeNull();
    });

    it('Returns 409 Conflict if rescheduled slot is already occupied', async () => {
      const slotA = getValidFutureSlot(1, 9, 0);
      const slotB = getValidFutureSlot(1, 9, 30);

      // Patient 1 books slot A
      const bookA = await request(app)
        .post('/appointments')
        .set('Authorization', `Bearer ${token1}`)
        .send({ doctorId: doctor._id, slotTime: slotA });

      // Patient 2 books slot B
      await request(app)
        .post('/appointments')
        .set('Authorization', `Bearer ${token2}`)
        .send({ doctorId: doctor._id, slotTime: slotB });

      // Patient 1 tries to reschedule to slot B
      const res = await request(app)
        .put(`/appointments/${bookA.body.appointment._id}/reschedule`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ slotTime: slotB });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('error', 'Conflict');
    });

    it('Cancels appointment and allows booking the freed slot afterwards (partial index verification)', async () => {
      const slot = getValidFutureSlot(1, 16, 0);

      // 1. Patient 1 books the slot
      const bookRes = await request(app)
        .post('/appointments')
        .set('Authorization', `Bearer ${token1}`)
        .send({ doctorId: doctor._id, slotTime: slot });

      const appointmentId = bookRes.body.appointment._id;

      // 2. Patient 1 cancels the appointment
      const cancelRes = await request(app)
        .post(`/appointments/${appointmentId}/cancel`)
        .set('Authorization', `Bearer ${token1}`);

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.appointment.status).toBe('cancelled');

      // Verify audit event
      const audit = await AuditEvent.findOne({
        action: 'CANCEL_APPOINTMENT',
        entityId: appointmentId,
      });
      expect(audit).not.toBeNull();

      // 3. Cancelling again returns 400
      const repeatCancel = await request(app)
        .post(`/appointments/${appointmentId}/cancel`)
        .set('Authorization', `Bearer ${token1}`);
      expect(repeatCancel.status).toBe(400);

      // 4. Patient 2 books the EXACT SAME slot now that it is freed!
      // This verifies the partialFilterExpression: { status: 'confirmed' } works!
      const rebookRes = await request(app)
        .post('/appointments')
        .set('Authorization', `Bearer ${token2}`)
        .send({ doctorId: doctor._id, slotTime: slot });

      expect(rebookRes.status).toBe(201);
      expect(rebookRes.body.appointment.status).toBe('confirmed');
    });
  });
});
