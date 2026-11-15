const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const { initTestDB, closeTestDB } = require('./setup');

describe('Health and Readiness Endpoints', () => {
  beforeAll(async () => {
    await initTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  it('GET /health returns 200 with service metadata', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('service', 'hospital-management-platform');
  });

  it('GET /ready returns 200 when database ping succeeds', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ready');
    expect(res.body).toHaveProperty('database', 'connected');
  });

  it('GET /ready returns 503 when database ping fails', async () => {
    const spy = jest.spyOn(db, 'checkReadiness').mockResolvedValue(false);

    try {
      const res = await request(app).get('/ready');
      expect(res.status).toBe(503);
      expect(res.body).toHaveProperty('status', 'degraded');
      expect(res.body).toHaveProperty('database', 'disconnected');
    } finally {
      spy.mockRestore();
    }
  });

  it('GET /metrics returns Prometheus metric payload', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('hospital_');
  });

  it('Returns X-Request-Id header on all responses', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(typeof res.headers['x-request-id']).toBe('string');
  });

  it('Propagates incoming X-Request-Id header', async () => {
    const customId = 'custom-trace-id-12345';
    const res = await request(app).get('/health').set('X-Request-Id', customId);
    expect(res.headers['x-request-id']).toBe(customId);
  });
});
