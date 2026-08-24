const request = require('supertest');
const crypto = require('crypto');
const { app } = require('../server');
const User = require('../models/User');
const { connect, closeDatabase, clearDatabase } = require('./setup/testDb');
const { createUser } = require('./helpers/factories');

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

// Regression coverage for the email-enumeration fix: the raw reset token is
// no longer returned in the API response at all (see the console.log in
// backend/routes/authRoutes.js), so this captures it the same way a
// developer would in the interim - from the server console - rather than
// reading it off the response body.
async function requestPasswordReset(email) {
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const res = await request(app).post('/api/auth/forgot-password').send({ email });
  const loggedLine = logSpy.mock.calls.flat().find((line) => typeof line === 'string' && line.includes('Password reset link for'));
  logSpy.mockRestore();

  const token = loggedLine ? new URL(loggedLine.split(': ').slice(1).join(': ').trim()).searchParams.get('token') : null;
  return { res, token };
}

describe('POST /api/auth/forgot-password', () => {
  it('generates a hashed token with an expiry for a valid, registered email, without exposing it in the response', async () => {
    const { user } = await createUser();

    const { res, token } = await requestPasswordReset(user.email);

    expect(res.status).toBe(200);
    expect(token).toEqual(expect.any(String));

    const updated = await User.findById(user._id).select('+resetPasswordTokenHash +resetPasswordExpires');
    const expectedHash = crypto.createHash('sha256').update(token).digest('hex');

    expect(updated.resetPasswordTokenHash).toBe(expectedHash);
    expect(updated.resetPasswordTokenHash).not.toBe(token);

    const minutesFromNow = (updated.resetPasswordExpires.getTime() - Date.now()) / (60 * 1000);
    expect(minutesFromNow).toBeGreaterThan(25);
    expect(minutesFromNow).toBeLessThan(35);
  });

  // Regression coverage for the enumeration-leak fix: this used to return an
  // identical message for both cases but include resetToken/resetLink only
  // when the account existed, so a client could tell registered emails apart
  // from unregistered ones just by checking whether that field was present -
  // the generic message text was providing no real protection. The response
  // body must now be byte-for-byte identical either way.
  it('returns an identical response body for a registered and an unregistered email', async () => {
    const { user } = await createUser();

    const { res: validRes } = await requestPasswordReset(user.email);
    const { res: invalidRes } = await requestPasswordReset('never-registered@example.com');

    expect(validRes.status).toBe(200);
    expect(invalidRes.status).toBe(200);
    expect(invalidRes.body).toEqual(validRes.body);
    expect(Object.keys(invalidRes.body)).toEqual(['message']);
  });
});

describe('POST /api/auth/reset-password', () => {
  it('resets the password with a valid token, and the new password (not the old one) works for login', async () => {
    const { user, rawPassword } = await createUser();

    const { token: resetToken } = await requestPasswordReset(user.email);

    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, password: 'newPassword123' });

    expect(resetRes.status).toBe(200);

    const loginWithNew = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'newPassword123' });
    expect(loginWithNew.status).toBe(200);
    expect(loginWithNew.body.token).toBeDefined();

    const loginWithOld = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: rawPassword });
    expect(loginWithOld.status).toBe(400);
  });

  it('rejects a token that was never issued', async () => {
    const garbageToken = crypto.randomBytes(32).toString('hex');

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: garbageToken, password: 'newPassword123' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid or (has )?expired/i);
  });

  it('rejects an expired token', async () => {
    const { user } = await createUser();
    const knownToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(knownToken).digest('hex');

    await User.findByIdAndUpdate(user._id, {
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpires: new Date(Date.now() - 1000),
    });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: knownToken, password: 'newPassword123' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid or (has )?expired/i);
  });

  it('rejects reuse of a token that has already been used for a successful reset', async () => {
    const { user } = await createUser();

    const { token: resetToken } = await requestPasswordReset(user.email);

    const firstReset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, password: 'newPassword123' });
    expect(firstReset.status).toBe(200);

    const secondReset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, password: 'anotherPassword456' });
    expect(secondReset.status).toBe(400);
  });
});
