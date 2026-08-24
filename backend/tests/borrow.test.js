const request = require('supertest');
const { app } = require('../server');
const Book = require('../models/Book');
const BorrowRecord = require('../models/BorrowRecord');
const { connect, closeDatabase, clearDatabase } = require('./setup/testDb');
const { createUser, signToken, createBook } = require('./helpers/factories');

// Must match MAX_BOOKS_PER_MEMBER in backend/routes/borrowRoutes.js.
const MAX_BOOKS_PER_MEMBER = 5;

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

// Regression coverage for the race condition: two members used to be able to
// both read availableCopies=1 and both succeed, driving the count negative.
// claimCopy() now does the check-and-decrement atomically in one query.
describe('borrowing the last available copy', () => {
  it('lets exactly one of two concurrent requests for the last copy succeed', async () => {
    const { user: memberA } = await createUser();
    const { user: memberB } = await createUser();
    const tokenA = signToken(memberA);
    const tokenB = signToken(memberB);
    const book = await createBook({ totalCopies: 1, availableCopies: 1 });
    const dueDate = futureDueDate();

    const [resA, resB] = await Promise.all([
      request(app).post('/api/borrow').set('Authorization', `Bearer ${tokenA}`).send({ bookId: book._id, dueDate }),
      request(app).post('/api/borrow').set('Authorization', `Bearer ${tokenB}`).send({ bookId: book._id, dueDate }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 400]);

    const stored = await Book.findById(book._id);
    expect(stored.availableCopies).toBe(0);

    const activeBorrows = await BorrowRecord.countDocuments({ book: book._id, returnDate: null });
    expect(activeBorrows).toBe(1);
  });

  it('never lets availableCopies go negative across repeated sequential attempts', async () => {
    const book = await createBook({ totalCopies: 1, availableCopies: 1 });
    const dueDate = futureDueDate();

    for (let i = 0; i < 4; i += 1) {
      const { user } = await createUser();
      const token = signToken(user);
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).post('/api/borrow').set('Authorization', `Bearer ${token}`).send({ bookId: book._id, dueDate });
      if (i === 0) {
        expect(res.status).toBe(201);
      } else {
        expect(res.status).toBe(400);
      }
    }

    const stored = await Book.findById(book._id);
    expect(stored.availableCopies).toBe(0);
  });
});

describe('borrow limit per member', () => {
  it(`rejects a ${MAX_BOOKS_PER_MEMBER + 1}th active borrow for the same member`, async () => {
    const { user } = await createUser();
    const token = signToken(user);
    const dueDate = futureDueDate();

    for (let i = 0; i < MAX_BOOKS_PER_MEMBER; i += 1) {
      const book = await createBook();
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).post('/api/borrow').set('Authorization', `Bearer ${token}`).send({ bookId: book._id, dueDate });
      expect(res.status).toBe(201);
    }

    const oneMore = await createBook();
    const res = await request(app).post('/api/borrow').set('Authorization', `Bearer ${token}`).send({ bookId: oneMore._id, dueDate });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(new RegExp(`maximum of ${MAX_BOOKS_PER_MEMBER}`, 'i'));

    const activeCount = await BorrowRecord.countDocuments({ member: user._id, returnDate: null });
    expect(activeCount).toBe(MAX_BOOKS_PER_MEMBER);
  });
});

describe('returning a book late and waiving the fine', () => {
  it('calculates a nonzero fine for an overdue return, and lets staff waive it', async () => {
    const { user: member } = await createUser();
    const { user: staff } = await createUser({ role: 'staff' });
    const memberToken = signToken(member);
    const staffToken = signToken(staff);
    const book = await createBook();

    const pastDueDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const borrowRes = await request(app)
      .post('/api/borrow')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ bookId: book._id, dueDate: pastDueDate });
    expect(borrowRes.status).toBe(201);
    const recordId = borrowRes.body._id;

    const returnRes = await request(app)
      .put(`/api/borrow/${recordId}/return`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(returnRes.status).toBe(200);
    expect(returnRes.body.fineAmount).toBeGreaterThan(0);

    const waiveRes = await request(app)
      .put(`/api/borrow/${recordId}/waive-fine`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(waiveRes.status).toBe(200);
    expect(waiveRes.body.fineWaived).toBe(true);
  });
});

describe('GET /api/borrow as a member', () => {
  it('only returns the requesting member\'s own records', async () => {
    const { user: memberA } = await createUser();
    const { user: memberB } = await createUser();
    const tokenA = signToken(memberA);
    const tokenB = signToken(memberB);
    const bookA = await createBook();
    const bookB = await createBook();
    const dueDate = futureDueDate();

    await request(app).post('/api/borrow').set('Authorization', `Bearer ${tokenA}`).send({ bookId: bookA._id, dueDate });
    await request(app).post('/api/borrow').set('Authorization', `Bearer ${tokenB}`).send({ bookId: bookB._id, dueDate });

    const res = await request(app).get('/api/borrow').set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].member._id).toBe(String(memberA._id));
    expect(res.body[0].book._id).toBe(String(bookA._id));
  });
});
