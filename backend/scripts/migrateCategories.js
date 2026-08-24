// One-time migration: Book.category used to be a free-text string.
// This finds every distinct string value currently in use, creates a
// matching Category document for each (or reuses one if it already
// exists), then repoints every Book's category field from the string to
// that Category's ObjectId.
//
// Uses the native MongoDB driver (not the Mongoose Book model) to read/write
// the raw field, so it works correctly regardless of whether Book.js has
// already been switched to the ObjectId schema when this runs.
//
// Usage: node scripts/migrateCategories.js

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Category = require('../models/Category');

async function main() {
  await connectDB();
  const books = mongoose.connection.db.collection('books');

  const distinctValues = await books.distinct('category');
  const stringValues = distinctValues.filter((v) => typeof v === 'string' && v.trim());

  if (stringValues.length === 0) {
    console.log('No free-text category values found - nothing to migrate.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${stringValues.length} distinct category value(s): ${stringValues.join(', ')}`);

  for (const name of stringValues) {
    let category = await Category.findOne({ name });
    if (!category) {
      category = await Category.create({ name });
      console.log(`Created category "${name}"`);
    } else {
      console.log(`Reusing existing category "${name}"`);
    }

    const result = await books.updateMany(
      { category: name },
      { $set: { category: category._id } }
    );
    console.log(`  -> repointed ${result.modifiedCount} book(s) to "${name}" (${category._id})`);
  }

  // Anything left with a non-ObjectId, non-empty category is worth flagging
  const remaining = await books.countDocuments({
    category: { $type: 'string' },
  });
  if (remaining > 0) {
    console.warn(`Warning: ${remaining} book(s) still have a string category after migration.`);
  } else {
    console.log('All books migrated successfully.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
