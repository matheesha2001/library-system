const request = require('supertest');
const { app } = require('../server');
const Book = require('../models/Book');
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

describe('GET /api/books', () => {
  it('returns 200 with a paginated shape when pagination params are used', async () => {
    const { user } = await createUser();
    const token = signToken(user);
    await Promise.all([createBook(), createBook(), createBook()]);

    const res = await request(app)
      .get('/api/books?page=1&limit=2')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(Array.isArray(res.body.books)).toBe(true);
    expect(res.body.books.length).toBe(2);
  });
});

// Regression coverage for the crash bug: routes that call Book.findById()
// used to have no defense against a malformed :id, which surfaced as an
// unhandled rejection. Locked in here as a clean 400 plus proof the app
// keeps serving requests afterwards.
describe('GET /api/books/:id with a malformed id', () => {
  it('returns a clean 400 instead of crashing, and the app stays responsive', async () => {
    const { user } = await createUser();
    const token = signToken(user);
    const book = await createBook();

    const badRes = await request(app)
      .get('/api/books/not-a-valid-object-id')
      .set('Authorization', `Bearer ${token}`);

    expect(badRes.status).toBe(400);

    // A second, unrelated request right after proves the process/app is
    // still alive and serving normally, not stuck in a crashed state.
    const followUpRes = await request(app)
      .get(`/api/books/${book._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(followUpRes.status).toBe(200);
    expect(followUpRes.body._id).toBe(String(book._id));
  });
});

describe('POST /api/books', () => {
  it('rejects a duplicate ISBN with a clean 400, not a raw 500', async () => {
    const { user } = await createUser({ role: 'staff' });
    const token = signToken(user);
    await createBook({ isbn: 'DUP-ISBN-1' });

    const res = await request(app)
      .post('/api/books')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Second Copy', author: 'Someone', isbn: 'DUP-ISBN-1', totalCopies: 2 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already exists/i);
  });
});

describe('PUT /api/books/:id', () => {
  it('rejects a negative totalCopies', async () => {
    const { user } = await createUser({ role: 'staff' });
    const token = signToken(user);
    const book = await createBook({ totalCopies: 3, availableCopies: 3 });

    const res = await request(app)
      .put(`/api/books/${book._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ totalCopies: -1 });

    expect(res.status).toBe(400);

    const stored = await Book.findById(book._id);
    expect(stored.totalCopies).toBe(3);
  });

  it('rejects availableCopies greater than totalCopies', async () => {
    const { user } = await createUser({ role: 'staff' });
    const token = signToken(user);
    const book = await createBook({ totalCopies: 3, availableCopies: 3 });

    const res = await request(app)
      .put(`/api/books/${book._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ availableCopies: 5 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot exceed totalCopies/i);

    const stored = await Book.findById(book._id);
    expect(stored.availableCopies).toBe(3);
  });
});
