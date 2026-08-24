const request = require('supertest');
const { app } = require('../server');
const Book = require('../models/Book');
const BorrowRecord = require('../models/BorrowRecord');
const Reservation = require('../models/Reservation');
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

describe('creating a reservation when copies are actually available', () => {
  it('is rejected, telling the member to just borrow it directly', async () => {
    const { user } = await createUser();
    const token = signToken(user);
    const book = await createBook({ totalCopies: 2, availableCopies: 2 });

    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookId: book._id });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/available/i);

    const count = await Reservation.countDocuments();
    expect(count).toBe(0);
  });
});

describe('duplicate reservations', () => {
  it('rejects a second active reservation from the same member for the same book', async () => {
    const { user: memberA } = await createUser();
    const tokenA = signToken(memberA);
    const book = await createBook({ totalCopies: 1, availableCopies: 0 });

    const first = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ bookId: book._id });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ bookId: book._id });

    expect(second.status).toBe(400);
    expect(second.body.message).toMatch(/already have an active reservation/i);

    const count = await Reservation.countDocuments({ book: book._id, member: memberA._id });
    expect(count).toBe(1);
  });
});

describe('returning the last copy of a book', () => {
  it('promotes the oldest pending reservation to ready, leaving the next one pending', async () => {
    const { user: memberHolder } = await createUser();
    const { user: memberA } = await createUser();
    const { user: memberB } = await createUser();
    const holderToken = signToken(memberHolder);
    const book = await createBook({ totalCopies: 1, availableCopies: 1 });

    const borrowRes = await request(app)
      .post('/api/borrow')
      .set('Authorization', `Bearer ${holderToken}`)
      .send({ bookId: book._id, dueDate: futureDueDate() });
    expect(borrowRes.status).toBe(201);
    const recordId = borrowRes.body._id;

    const olderReservation = await Reservation.create({
      book: book._id,
      member: memberA._id,
      status: 'pending',
      requestedAt: new Date(Date.now() - 60000),
    });
    const newerReservation = await Reservation.create({
      book: book._id,
      member: memberB._id,
      status: 'pending',
      requestedAt: new Date(),
    });

    const returnRes = await request(app)
      .put(`/api/borrow/${recordId}/return`)
      .set('Authorization', `Bearer ${holderToken}`);
    expect(returnRes.status).toBe(200);

    const refetchedA = await Reservation.findById(olderReservation._id);
    const refetchedB = await Reservation.findById(newerReservation._id);
    const refetchedBook = await Book.findById(book._id);

    expect(refetchedA.status).toBe('ready');
    expect(refetchedB.status).toBe('pending');
    expect(refetchedBook.availableCopies).toBe(1);
  });
});

describe('borrowing a book with an existing reservation', () => {
  it('auto-fulfills the ready reservation for that member and book', async () => {
    const { user: memberA } = await createUser();
    const tokenA = signToken(memberA);
    const book = await createBook({ totalCopies: 1, availableCopies: 1 });

    const reservation = await Reservation.create({
      book: book._id,
      member: memberA._id,
      status: 'ready',
    });

    const res = await request(app)
      .post('/api/borrow')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ bookId: book._id, dueDate: futureDueDate() });

    expect(res.status).toBe(201);

    const refetched = await Reservation.findById(reservation._id);
    expect(refetched.status).toBe('fulfilled');
  });
});

describe('GET /api/reservations/book/:bookId', () => {
  it('lets staff see the active queue oldest-first, excluding cancelled reservations', async () => {
    const { user: staff } = await createUser({ role: 'staff' });
    const { user: memberA } = await createUser();
    const { user: memberB } = await createUser();
    const { user: memberC } = await createUser();
    const staffToken = signToken(staff);
    const book = await createBook({ totalCopies: 1, availableCopies: 0 });

    const older = await Reservation.create({
      book: book._id,
      member: memberA._id,
      status: 'pending',
      requestedAt: new Date(Date.now() - 60000),
    });
    const newer = await Reservation.create({
      book: book._id,
      member: memberB._id,
      status: 'pending',
      requestedAt: new Date(),
    });
    await Reservation.create({
      book: book._id,
      member: memberC._id,
      status: 'cancelled',
      requestedAt: new Date(Date.now() - 120000),
    });

    const res = await request(app)
      .get(`/api/reservations/book/${book._id}`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0]._id).toBe(String(older._id));
    expect(res.body[1]._id).toBe(String(newer._id));
  });

  it('rejects a plain member with 403', async () => {
    const { user: member } = await createUser();
    const memberToken = signToken(member);
    const book = await createBook({ totalCopies: 1, availableCopies: 0 });

    const res = await request(app)
      .get(`/api/reservations/book/${book._id}`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });
});

// Regression coverage for the fix: a "ready" reservation used to be purely
// informational - availableCopies was a shared pool, so any other member
// could still claim the freed-up copy first. isBlockedByReadyReservation()
// in borrowRoutes.js now holds it for the reservation's own owner.
describe('a ready reservation holding a copy for its owner', () => {
  it('blocks a different member from borrowing the copy while it is reserved for someone else', async () => {
    const { user: holder } = await createUser();
    const { user: rando } = await createUser();
    const randoToken = signToken(rando);
    const book = await createBook({ totalCopies: 1, availableCopies: 1 });

    await Reservation.create({ book: book._id, member: holder._id, status: 'ready' });

    const res = await request(app)
      .post('/api/borrow')
      .set('Authorization', `Bearer ${randoToken}`)
      .send({ bookId: book._id, dueDate: futureDueDate() });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/reserved for another member/i);

    const stored = await Book.findById(book._id);
    expect(stored.availableCopies).toBe(1);

    const activeBorrows = await BorrowRecord.countDocuments({ book: book._id, returnDate: null });
    expect(activeBorrows).toBe(0);
  });

  it('still lets the reservation holder borrow their own reserved copy', async () => {
    const { user: holder } = await createUser();
    const holderToken = signToken(holder);
    const book = await createBook({ totalCopies: 1, availableCopies: 1 });

    await Reservation.create({ book: book._id, member: holder._id, status: 'ready' });

    const res = await request(app)
      .post('/api/borrow')
      .set('Authorization', `Bearer ${holderToken}`)
      .send({ bookId: book._id, dueDate: futureDueDate() });

    expect(res.status).toBe(201);
  });

  it('also blocks staff from issuing the copy to someone other than the reservation holder', async () => {
    const { user: holder } = await createUser();
    const { user: rando } = await createUser();
    const { user: staff } = await createUser({ role: 'staff' });
    const staffToken = signToken(staff);
    const book = await createBook({ totalCopies: 1, availableCopies: 1 });

    await Reservation.create({ book: book._id, member: holder._id, status: 'ready' });

    const res = await request(app)
      .post('/api/borrow/issue')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ bookId: book._id, memberId: rando._id, dueDate: futureDueDate() });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/reserved for another member/i);
  });
});

describe('cancelling a reservation', () => {
  it('lets the owning member cancel but rejects a different member, leaving it unchanged', async () => {
    const { user: memberA } = await createUser();
    const { user: memberB } = await createUser();
    const tokenA = signToken(memberA);
    const tokenB = signToken(memberB);
    const book = await createBook({ totalCopies: 1, availableCopies: 0 });

    const createRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ bookId: book._id });
    expect(createRes.status).toBe(201);
    const reservationId = createRes.body._id;

    const forbiddenRes = await request(app)
      .put(`/api/reservations/${reservationId}/cancel`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(forbiddenRes.status).toBe(403);

    const stillPending = await Reservation.findById(reservationId);
    expect(stillPending.status).toBe('pending');

    const ownRes = await request(app)
      .put(`/api/reservations/${reservationId}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(ownRes.status).toBe(200);
    expect(ownRes.body.status).toBe('cancelled');

    const cancelled = await Reservation.findById(reservationId);
    expect(cancelled.status).toBe('cancelled');
  });
});
