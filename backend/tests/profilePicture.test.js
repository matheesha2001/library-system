const path = require('path');
const fs = require('fs/promises');
const request = require('supertest');
const { app } = require('../server');
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

// Only the leading bytes matter to detectImageExtension(), so these don't
// need to be real, fully-decodable images - just the correct magic number.
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const NOT_AN_IMAGE_BYTES = Buffer.from('<script>alert(1)</script>');

// Uploaded files are written to backend/uploads/profiles - clean up whatever
// a test actually wrote so repeated test runs don't accumulate fixtures.
const writtenFiles = [];
afterEach(async () => {
  await Promise.all(
    writtenFiles.splice(0).map((filename) =>
      fs.unlink(path.join(__dirname, '..', 'uploads', 'profiles', filename)).catch(() => {})
    )
  );
});

function trackUpload(res) {
  if (res.body?.profilePicture) {
    writtenFiles.push(path.basename(res.body.profilePicture));
  }
  return res;
}

describe('POST /api/profile/picture - magic-byte validation', () => {
  it('rejects a file whose real content does not match any accepted image signature, even with an image Content-Type', async () => {
    const { user } = await createUser();
    const token = signToken(user);

    const res = await request(app)
      .post('/api/profile/picture')
      .set('Authorization', `Bearer ${token}`)
      .attach('profilePicture', NOT_AN_IMAGE_BYTES, { filename: 'fake.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not a valid/i);
  });

  it('accepts a real PNG and stores it with a .png extension', async () => {
    const { user } = await createUser();
    const token = signToken(user);

    const res = trackUpload(
      await request(app)
        .post('/api/profile/picture')
        .set('Authorization', `Bearer ${token}`)
        .attach('profilePicture', PNG_BYTES, { filename: 'photo.png', contentType: 'image/png' })
    );

    expect(res.status).toBe(200);
    expect(res.body.profilePicture).toMatch(/\.png$/);
  });

  it('derives the stored extension from the real content, not a spoofed Content-Type', async () => {
    const { user } = await createUser();
    const token = signToken(user);

    // Real JPEG bytes, but declares itself as image/png - the exact "labeled
    // as image/png but isn't" scenario this validation exists to catch.
    const res = trackUpload(
      await request(app)
        .post('/api/profile/picture')
        .set('Authorization', `Bearer ${token}`)
        .attach('profilePicture', JPEG_BYTES, { filename: 'fake.png', contentType: 'image/png' })
    );

    expect(res.status).toBe(200);
    expect(res.body.profilePicture).toMatch(/\.jpg$/);
  });
});
