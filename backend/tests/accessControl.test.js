const request = require('supertest');
const { app } = require('../server');
const User = require('../models/User');
const Category = require('../models/Category');
const { connect, closeDatabase, clearDatabase } = require('./setup/testDb');
const { createUser, signToken } = require('./helpers/factories');

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

// Regression coverage for the session-revocation bug: protect() used to
// trust the JWT alone, so a blocked user's still-valid token kept working
// for the rest of its 7-day lifetime. It now re-checks isBlocked on every
// request.
describe('a blocked user\'s existing JWT', () => {
  it('is rejected on a protected route even though the token itself is still valid', async () => {
    const { user } = await createUser();
    const token = signToken(user);

    // Confirm the token works before the block.
    const before = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);

    await User.findByIdAndUpdate(user._id, { isBlocked: true });

    const after = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(403);
    expect(after.body.message).toMatch(/blocked/i);
  });
});

describe('role-gated routes', () => {
  it('rejects a member token on an admin-only route (category delete) with 403', async () => {
    const { user: member } = await createUser();
    const memberToken = signToken(member);
    const category = await Category.create({ name: 'Fiction' });

    const res = await request(app)
      .delete(`/api/categories/${category._id}`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);

    const stillThere = await Category.findById(category._id);
    expect(stillThere).not.toBeNull();
  });

  it('lets a staff token use a staff-permitted route but rejects it on an admin-only route', async () => {
    const { user: staff } = await createUser({ role: 'staff' });
    const staffToken = signToken(staff);

    // Staff-permitted: book management.
    const createBookRes = await request(app)
      .post('/api/books')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ title: 'Staff Can Add This', author: 'Someone', isbn: `STAFF-ISBN-${Date.now()}`, totalCopies: 1 });
    expect(createBookRes.status).toBe(201);

    // Admin-only: provisioning another staff account.
    const createStaffRes = await request(app)
      .post('/api/staff/register')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'New Staffer', email: 'newstaffer@example.com', password: 'password123' });

    expect(createStaffRes.status).toBe(403);

    const shouldNotExist = await User.findOne({ email: 'newstaffer@example.com' });
    expect(shouldNotExist).toBeNull();
  });
});
