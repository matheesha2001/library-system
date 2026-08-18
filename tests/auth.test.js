const bcrypt = require('bcryptjs');

// Simple unit test demonstrating password hashing works correctly.
// This is the kind of "sample unit test with explanation" the report should include.
describe('Password hashing (bcrypt)', () => {
  it('should hash a password and allow correct comparison', async () => {
    const plainPassword = 'mySecret123';
    const hashed = await bcrypt.hash(plainPassword, 10);

    expect(hashed).not.toBe(plainPassword);

    const isMatch = await bcrypt.compare(plainPassword, hashed);
    expect(isMatch).toBe(true);
  });

  it('should fail comparison for a wrong password', async () => {
    const hashed = await bcrypt.hash('correctPassword', 10);
    const isMatch = await bcrypt.compare('wrongPassword', hashed);
    expect(isMatch).toBe(false);
  });
});
