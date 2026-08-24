const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const axios = require('axios');
const Book = require('../models/Book');
const Category = require('../models/Category');

const TARGET_BOOK_COUNT = 1000;
const BATCH_LIMIT = 50;
const API_DELAY_MS = 150;

const SUBJECTS = [
  'fiction',
  'science',
  'history',
  'romance',
  'fantasy',
  'biography',
  'technology',
  'philosophy',
  'mystery',
  'thrillers',
  'art',
  'business',
  'programming',
  'medicine',
  'music',
  'poetry',
  'psychology',
  'travel',
  'drama',
  'cooking',
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatSubjectName(sub) {
  return sub.charAt(0).toUpperCase() + sub.slice(1);
}

// Generate a valid, clean, unique 13-digit ISBN string for books missing standard ISBN
function generateFallbackIsbn(work, uniqueIdCounter) {
  if (work.availability && work.availability.isbn && typeof work.availability.isbn === 'string') {
    const cleaned = work.availability.isbn.replace(/[^0-9X]/gi, '');
    if (cleaned.length >= 10) return cleaned;
  }
  if (work.cover_edition_key) {
    const nums = work.cover_edition_key.replace(/\D/g, '').padStart(9, '0').slice(-9);
    return `978-${nums.slice(0, 3)}-${nums.slice(3, 8)}-${nums.slice(8)}`;
  }
  const counterStr = String(uniqueIdCounter).padStart(9, '0');
  return `978-0-${counterStr.slice(0, 4)}-${counterStr.slice(4, 8)}-${counterStr.slice(8)}`;
}

async function seedBooks() {
  console.log('--- Starting Library System Book Seeder ---');

  if (!process.env.MONGO_URI) {
    console.error('Error: MONGO_URI is missing in backend/.env file!');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Successfully connected to MongoDB.');

    // Fetch existing books from MongoDB to avoid re-inserting duplicates
    const existingBooks = await Book.find().select('title author isbn');
    const seenTitlesAuthors = new Set();
    const seenIsbns = new Set();

    existingBooks.forEach((b) => {
      seenTitlesAuthors.add(`${b.title.toLowerCase().trim()}|${b.author.toLowerCase().trim()}`);
      if (b.isbn) seenIsbns.add(b.isbn.toLowerCase().trim());
    });

    console.log(`Loaded ${existingBooks.length} existing books from database.`);

    let insertedCount = 0;
    let skippedDuplicatesCount = 0;
    let skippedMissingDataCount = 0;
    let isbnCounter = Date.now();

    subjectLoop: for (const subject of SUBJECTS) {
      if (insertedCount >= TARGET_BOOK_COUNT) break;

      const categoryName = formatSubjectName(subject);
      console.log(`\nFetching books for subject: "${categoryName}"...`);

      // Book.category is an ObjectId reference (see scripts/migrateCategories.js),
      // not a free-text string - look up or create the matching Category
      // document once per subject and use its _id for every book below.
      let category = await Category.findOne({ name: categoryName });
      if (!category) {
        category = await Category.create({ name: categoryName });
        console.log(`Created category "${categoryName}"`);
      }

      let offset = 0;
      let hasMore = true;

      while (hasMore && insertedCount < TARGET_BOOK_COUNT) {
        try {
          const url = `https://openlibrary.org/subjects/${subject}.json?limit=${BATCH_LIMIT}&offset=${offset}`;
          const response = await axios.get(url, {
            headers: { 'User-Agent': 'LibrarySystemSeeder/1.0' },
            timeout: 10000,
          });

          const works = response.data?.works || [];
          if (works.length === 0) {
            hasMore = false;
            break;
          }

          const booksToInsert = [];

          for (const work of works) {
            if (insertedCount + booksToInsert.length >= TARGET_BOOK_COUNT) break;

            const title = work.title?.trim();
            const authorsList = (work.authors || [])
              .map((a) => a.name?.trim())
              .filter(Boolean);
            const author = authorsList.length > 0 ? authorsList.join(', ') : null;

            // Skip books missing title or author
            if (!title || !author) {
              skippedMissingDataCount++;
              continue;
            }

            const dedupeKey = `${title.toLowerCase()}|${author.toLowerCase()}`;
            if (seenTitlesAuthors.has(dedupeKey)) {
              skippedDuplicatesCount++;
              continue;
            }

            // Generate or extract unique ISBN
            isbnCounter++;
            let isbn = generateFallbackIsbn(work, isbnCounter);
            let isbnTry = 0;
            while (seenIsbns.has(isbn.toLowerCase()) && isbnTry < 10) {
              isbnCounter++;
              isbn = `978-${String(isbnCounter).slice(-10)}`;
              isbnTry++;
            }

            if (seenIsbns.has(isbn.toLowerCase())) {
              skippedDuplicatesCount++;
              continue;
            }

            const totalCopies = Math.floor(Math.random() * 5) + 1; // Random integer between 1 and 5
            const coverImage = work.cover_id
              ? `https://covers.openlibrary.org/b/id/${work.cover_id}-L.jpg`
              : null;

            seenTitlesAuthors.add(dedupeKey);
            seenIsbns.add(isbn.toLowerCase());

            booksToInsert.push({
              title,
              author,
              isbn,
              category: category._id,
              coverImage,
              description: work.first_sentence?.value || work.subject?.slice(0, 4).join(', ') || '',
              totalCopies,
              availableCopies: totalCopies,
            });
          }

          if (booksToInsert.length > 0) {
            await Book.insertMany(booksToInsert, { ordered: false });
            insertedCount += booksToInsert.length;

            if (insertedCount % 50 === 0 || insertedCount >= TARGET_BOOK_COUNT) {
              console.log(`Progress: Inserted ${insertedCount}/${TARGET_BOOK_COUNT} books...`);
            }
          }

          offset += BATCH_LIMIT;
          await delay(API_DELAY_MS);
        } catch (apiErr) {
          console.error(`Error fetching subject "${subject}" offset ${offset}:`, apiErr.message);
          await delay(500);
          offset += BATCH_LIMIT;
        }
      }
    }

    console.log('\n==================================================');
    console.log('Done.');
    console.log(`Inserted ${insertedCount} new books into MongoDB.`);
    console.log(`Skipped ${skippedDuplicatesCount} duplicates.`);
    console.log(`Skipped ${skippedMissingDataCount} items missing title or author.`);
    console.log(`Total books in collection: ${await Book.countDocuments()}`);
    console.log('==================================================');
  } catch (err) {
    console.error('Fatal Seeder Error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB connection closed.');
    process.exit(0);
  }
}

seedBooks();
