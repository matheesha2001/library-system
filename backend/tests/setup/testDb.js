const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Spins up a real (in-memory) MongoDB instance per test file, so integration
// tests exercise the actual Mongoose models/queries without ever touching
// the real Atlas database configured in .env.
let mongoServer;

async function connect() {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}

async function closeDatabase() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
}

async function clearDatabase() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

module.exports = { connect, closeDatabase, clearDatabase };
