const request = require('supertest');
const app = require('../src/app');
const AuditEvent = require('../src/models/AuditEvent');
const { initTestDB, clearTestDB, closeTestDB } = require('./setup');

describe('Authentication & User Endpoints', () => {
  beforeAll(async () => {
    await initTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  it('POST /auth/register creates a new user successfully', async () => {
    const res = await request(app).post('/auth/register').send({
      name: 'Alice Patient',
      email: 'alice@hospital.local',
      password: 'SecurePassword123!',
      role: 'patient',
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user).toHaveProperty('email', 'alice@hospital.local');
    expect(res.body.user).toHaveProperty('role', 'patient');
    expect(res.body.user.password).toBeUndefined();
  });

  it('POST /auth/register prevents duplicate email registration (409)', async () => {
    await request(app).post('/auth/register').send({
      name: 'First Alice',
      email: 'alice@hospital.local',
      password: 'SecurePassword123!',
      role: 'patient',
    });

    const res = await request(app).post('/auth/register').send({
      name: 'Second Alice',
      email: 'alice@hospital.local',
      password: 'AnotherPassword123!',
      role: 'patient',
    });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error', 'Conflict');
  });

  it('POST /auth/login returns JWT token and records audit event', async () => {
    await request(app).post('/auth/register').send({
      name: 'Bob Doctor',
      email: 'bob@hospital.local',
      password: 'SecurePassword123!',
      role: 'doctor',
    });

    const res = await request(app).post('/auth/login').send({
      email: 'bob@hospital.local',
      password: 'SecurePassword123!',
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('email', 'bob@hospital.local');
    expect(res.body.user).toHaveProperty('role', 'doctor');

    // Verify audit event recorded
    const audit = await AuditEvent.findOne({
      who: 'bob@hospital.local',
      action: 'LOGIN',
    });
    expect(audit).not.toBeNull();
    expect(audit.entity).toBe('User');
  });

  it('POST /auth/login returns 401 on incorrect password', async () => {
    await request(app).post('/auth/register').send({
      name: 'Charlie Patient',
      email: 'charlie@hospital.local',
      password: 'CorrectPassword123!',
    });

    const res = await request(app).post('/auth/login').send({
      email: 'charlie@hospital.local',
      password: 'WrongPassword999!',
    });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Unauthorized');
  });

  it('GET /auth/me returns current user profile when authenticated', async () => {
    await request(app).post('/auth/register').send({
      name: 'Me User',
      email: 'me@hospital.local',
      password: 'Password123!',
      role: 'patient',
    });

    const login = await request(app).post('/auth/login').send({
      email: 'me@hospital.local',
      password: 'Password123!',
    });

    const token = login.body.token;

    const meRes = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('me@hospital.local');
  });

  it('GET /auth/me returns 401 when token is missing', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Unauthorized');
  });
});
