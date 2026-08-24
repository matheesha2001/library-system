const request = require('supertest');
const { app } = require('../server');
const { connect, closeDatabase, clearDatabase } = require('./setup/testDb');
const { createUser, signToken, createBook } = require('./helpers/factories');

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

function futureDueDate(daysFromNow = 14) {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
}

describe('DELETE /api/users/:id', () => {
  it('allows deleting a user with no borrow records at all', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const adminToken = signToken(admin);
    const { user: target } = await createUser();

    const res = await request(app)
      .delete(`/api/users/${target._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  it('blocks deletion while the user has an active (unreturned) borrow record', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const adminToken = signToken(admin);
    const { user: target } = await createUser();
    const targetToken = signToken(target);
    const book = await createBook();

    const borrowRes = await request(app)
      .post('/api/borrow')
      .set('Authorization', `Bearer ${targetToken}`)
      .send({ bookId: book._id, dueDate: futureDueDate() });
    expect(borrowRes.status).toBe(201);

    const deleteRes = await request(app)
      .delete(`/api/users/${target._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(400);
    expect(deleteRes.body.message).toMatch(/1 borrow record/);
  });

  it('blocks deletion while the user only has a returned (historical) borrow record - the new case', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const adminToken = signToken(admin);
    const { user: target } = await createUser();
    const targetToken = signToken(target);
    const book = await createBook();

    const borrowRes = await request(app)
      .post('/api/borrow')
      .set('Authorization', `Bearer ${targetToken}`)
      .send({ bookId: book._id, dueDate: futureDueDate() });
    expect(borrowRes.status).toBe(201);
    const recordId = borrowRes.body._id;

    const returnRes = await request(app)
      .put(`/api/borrow/${recordId}/return`)
      .set('Authorization', `Bearer ${targetToken}`);
    expect(returnRes.status).toBe(200);
    expect(returnRes.body.returnDate).not.toBeNull();

    // Old behavior only checked returnDate: null, so a fully-returned record
    // used to slip through here and leave the deleted user's borrow history
    // dangling (BorrowRecord.member pointing at a nonexistent document).
    const deleteRes = await request(app)
      .delete(`/api/users/${target._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(400);
    expect(deleteRes.body.message).toMatch(/1 borrow record/);
    expect(deleteRes.body.message).not.toMatch(/process returns first/i);
  });

  it('counts both active and historical records together in the block message', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const adminToken = signToken(admin);
    const { user: target } = await createUser();
    const targetToken = signToken(target);
    const bookA = await createBook();
    const bookB = await createBook();

    const returnedRes = await request(app)
      .post('/api/borrow')
      .set('Authorization', `Bearer ${targetToken}`)
      .send({ bookId: bookA._id, dueDate: futureDueDate() });
    await request(app)
      .put(`/api/borrow/${returnedRes.body._id}/return`)
      .set('Authorization', `Bearer ${targetToken}`);

    await request(app)
      .post('/api/borrow')
      .set('Authorization', `Bearer ${targetToken}`)
      .send({ bookId: bookB._id, dueDate: futureDueDate() });

    const deleteRes = await request(app)
      .delete(`/api/users/${target._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(400);
    expect(deleteRes.body.message).toMatch(/2 borrow record/);
  });
});
