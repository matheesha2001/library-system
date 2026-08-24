const request = require('supertest');
const { app } = require('../server');
const User = require('../models/User');
const { connect, closeDatabase, clearDatabase } = require('./setup/testDb');

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

// Regression coverage for the privilege-escalation bug: POST /register used
// to trust a client-supplied "role" field, letting anyone register as admin.
describe('POST /api/auth/register', () => {
  it('always creates a member account, even if the request body asks for a different role', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Eve',
      email: 'eve@example.com',
      password: 'password123',
      role: 'admin',
    });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('member');

    const stored = await User.findById(res.body.id);
    expect(stored.role).toBe('member');
  });

  it('rejects a duplicate email with a clean 400', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Eve',
      email: 'eve@example.com',
      password: 'password123',
    });

    const res = await request(app).post('/api/auth/register').send({
      name: 'Eve Again',
      email: 'eve@example.com',
      password: 'anotherPassword1',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already registered/i);
  });

  it('rejects a password under 8 characters', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Eve',
      email: 'eve@example.com',
      password: 'short1',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/8 characters/i);

    const stored = await User.findOne({ email: 'eve@example.com' });
    expect(stored).toBeNull();
  });

  it('lets a newly registered user log in and use the resulting JWT on a protected route', async () => {
    // Registration itself doesn't return a token (this app always requires a
    // separate login step), so log in right after to get one.
    const registerRes = await request(app).post('/api/auth/register').send({
      name: 'Eve',
      email: 'eve@example.com',
      password: 'password123',
    });
    expect(registerRes.status).toBe(201);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'eve@example.com',
      password: 'password123',
    });
    expect(loginRes.status).toBe(200);
    expect(typeof loginRes.body.token).toBe('string');

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe('eve@example.com');
    expect(meRes.body.role).toBe('member');
  });
});
