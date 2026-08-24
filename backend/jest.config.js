module.exports = {
  // mongodb-memory-server downloads and boots a real mongod per test file;
  // the default 5s Jest timeout is too tight for that, especially on the
  // first run before the binary is cached.
  testTimeout: 30000,
};
