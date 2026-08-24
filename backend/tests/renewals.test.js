const request = require('supertest');
const { app } = require('../server');
const BorrowRecord = require('../models/BorrowRecord');
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

describe('a member requesting a renewal', () => {
  it('can request a renewal on their own active borrow record', async () => {
    const { user: member } = await createUser();
    const token = signToken(member);
    const book = await createBook();

    const borrowRes = await request(app)
      .post('/api/borrow')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookId: book._id, dueDate: futureDueDate() });
    expect(borrowRes.status).toBe(201);
    const recordId = borrowRes.body._id;

    const res = await request(app)
      .put(`/api/borrow/${recordId}/request-renewal`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.renewalRequested).toBe(true);
    expect(res.body.renewalRequestedAt).not.toBeNull();
  });
});

describe('a member requesting a renewal they are not entitled to', () => {
  it("can't request a renewal on someone else's record", async () => {
    const { user: memberA } = await createUser();
    const { user: memberB } = await createUser();
    const tokenA = signToken(memberA);
    const tokenB = signToken(memberB);
    const book = await createBook();

    const borrowRes = await request(app)
      .post('/api/borrow')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ bookId: book._id, dueDate: futureDueDate() });
    expect(borrowRes.status).toBe(201);
    const recordId = borrowRes.body._id;

    const res = await request(app)
      .put(`/api/borrow/${recordId}/request-renewal`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
  });

  it("can't request a renewal on an already-returned book", async () => {
    const { user: member } = await createUser();
    const token = signToken(member);
    const book = await createBook();

    const borrowRes = await request(app)
      .post('/api/borrow')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookId: book._id, dueDate: futureDueDate() });
    expect(borrowRes.status).toBe(201);
    const recordId = borrowRes.body._id;

    const returnRes = await request(app)
      .put(`/api/borrow/${recordId}/return`)
      .set('Authorization', `Bearer ${token}`);
    expect(returnRes.status).toBe(200);

    const res = await request(app)
      .put(`/api/borrow/${recordId}/request-renewal`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/returned/i);
  });
});

describe('GET /api/borrow as staff', () => {
  it('shows pending renewal requests among the full record list', async () => {
    const { user: memberA } = await createUser();
    const { user: memberB } = await createUser();
    const { user: staff } = await createUser({ role: 'staff' });
    const tokenA = signToken(memberA);
    const tokenB = signToken(memberB);
    const staffToken = signToken(staff);
    const bookA = await createBook();
    const bookB = await createBook();

    const borrowResA = await request(app)
      .post('/api/borrow')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ bookId: bookA._id, dueDate: futureDueDate() });
    expect(borrowResA.status).toBe(201);
    const recordIdA = borrowResA.body._id;

    const borrowResB = await request(app)
      .post('/api/borrow')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ bookId: bookB._id, dueDate: futureDueDate() });
    expect(borrowResB.status).toBe(201);

    const requestRes = await request(app)
      .put(`/api/borrow/${recordIdA}/request-renewal`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(requestRes.status).toBe(200);

    const res = await request(app).get('/api/borrow').set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    const pending = res.body.filter((r) => r.renewalRequested === true);
    expect(pending.length).toBe(1);
    expect(pending[0]._id).toBe(recordIdA);
  });
});

describe('staff approving a renewal via extend', () => {
  it('clears the renewal-requested flag and extends the due date by the given days', async () => {
    const { user: member } = await createUser();
    const { user: staff } = await createUser({ role: 'staff' });
    const token = signToken(member);
    const staffToken = signToken(staff);
    const book = await createBook();

    const originalDueDate = futureDueDate();
    const borrowRes = await request(app)
      .post('/api/borrow')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookId: book._id, dueDate: originalDueDate });
    expect(borrowRes.status).toBe(201);
    const recordId = borrowRes.body._id;

    const requestRes = await request(app)
      .put(`/api/borrow/${recordId}/request-renewal`)
      .set('Authorization', `Bearer ${token}`);
    expect(requestRes.status).toBe(200);

    const res = await request(app)
      .put(`/api/borrow/${recordId}/extend`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ days: 7 });

    expect(res.status).toBe(200);
    expect(res.body.renewalRequested).toBe(false);

    const expectedDueDate = new Date(originalDueDate);
    expectedDueDate.setDate(expectedDueDate.getDate() + 7);
    expect(new Date(res.body.dueDate).getTime()).toBe(expectedDueDate.getTime());
  });
});

// Regression coverage for the race condition: request-renewal used to
// read-then-write (findById, check the flag, save), so two concurrent
// requests could both pass the "not already pending" check before either
// one wrote. It now uses the same atomic findOneAndUpdate-with-a-guard
// pattern as claimCopy() in borrowRoutes.js.
describe('concurrent renewal requests on the same record', () => {
  it('lets only one of two concurrent request-renewal calls succeed', async () => {
    const { user: member } = await createUser();
    const token = signToken(member);
    const book = await createBook();

    const borrowRes = await request(app)
      .post('/api/borrow')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookId: book._id, dueDate: futureDueDate() });
    expect(borrowRes.status).toBe(201);
    const recordId = borrowRes.body._id;

    const [resA, resB] = await Promise.all([
      request(app).put(`/api/borrow/${recordId}/request-renewal`).set('Authorization', `Bearer ${token}`),
      request(app).put(`/api/borrow/${recordId}/request-renewal`).set('Authorization', `Bearer ${token}`),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 400]);

    const stored = await BorrowRecord.findById(recordId);
    expect(stored.renewalRequested).toBe(true);
  });
});

// Regression coverage for missing validation: `days` used to be passed
// straight into date math with no bounds checking at all.
describe('validating the extend days parameter', () => {
  async function createActiveBorrow(memberToken) {
    const book = await createBook();
    const dueDate = futureDueDate();
    const borrowRes = await request(app)
      .post('/api/borrow')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ bookId: book._id, dueDate });
    expect(borrowRes.status).toBe(201);
    return { recordId: borrowRes.body._id, dueDate };
  }

  it('rejects a negative days value and leaves the due date unchanged', async () => {
    const { user: member } = await createUser();
    const { user: staff } = await createUser({ role: 'staff' });
    const token = signToken(member);
    const staffToken = signToken(staff);
    const { recordId, dueDate } = await createActiveBorrow(token);

    const res = await request(app)
      .put(`/api/borrow/${recordId}/extend`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ days: -5 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/between 1 and 30/i);

    const stored = await BorrowRecord.findById(recordId);
    expect(new Date(stored.dueDate).getTime()).toBe(new Date(dueDate).getTime());
  });

  it('rejects a non-numeric days value', async () => {
    const { user: member } = await createUser();
    const { user: staff } = await createUser({ role: 'staff' });
    const token = signToken(member);
    const staffToken = signToken(staff);
    const { recordId } = await createActiveBorrow(token);

    const res = await request(app)
      .put(`/api/borrow/${recordId}/extend`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ days: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/between 1 and 30/i);
  });

  it('rejects a days value above the 30-day cap', async () => {
    const { user: member } = await createUser();
    const { user: staff } = await createUser({ role: 'staff' });
    const token = signToken(member);
    const staffToken = signToken(staff);
    const { recordId } = await createActiveBorrow(token);

    const res = await request(app)
      .put(`/api/borrow/${recordId}/extend`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ days: 31 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/between 1 and 30/i);
  });
});

describe('staff denying a renewal request', () => {
  it('clears the flag, and denying again with no pending request fails', async () => {
    const { user: member } = await createUser();
    const { user: staff } = await createUser({ role: 'staff' });
    const token = signToken(member);
    const staffToken = signToken(staff);
    const book = await createBook();

    const borrowRes = await request(app)
      .post('/api/borrow')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookId: book._id, dueDate: futureDueDate() });
    expect(borrowRes.status).toBe(201);
    const recordId = borrowRes.body._id;

    const requestRes = await request(app)
      .put(`/api/borrow/${recordId}/request-renewal`)
      .set('Authorization', `Bearer ${token}`);
    expect(requestRes.status).toBe(200);

    const denyRes = await request(app)
      .put(`/api/borrow/${recordId}/deny-renewal`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(denyRes.status).toBe(200);
    expect(denyRes.body.renewalRequested).toBe(false);

    const secondDenyRes = await request(app)
      .put(`/api/borrow/${recordId}/deny-renewal`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(secondDenyRes.status).toBe(400);
    expect(secondDenyRes.body.message).toMatch(/no pending renewal/i);
  });
});
