// One-time CLI script to bootstrap the first admin account.
// There is deliberately no public registration route for admins.
//
// Usage:
//   node scripts/createAdmin.js
//     (prompts for name/email/password interactively)
//
//   ADMIN_NAME="Jane Doe" ADMIN_EMAIL="jane@library.lk" ADMIN_PASSWORD="secret123" node scripts/createAdmin.js
//     (non-interactive - also keeps the password out of shell history if you
//     source it from a file instead of typing it inline)

require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const generateMemberId = require('../utils/memberId');

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const name = process.env.ADMIN_NAME || (await prompt('Admin name: '));
  const emailInput = process.env.ADMIN_EMAIL || (await prompt('Admin email: '));
  const email = emailInput.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || (await prompt('Admin password: '));

  if (!name || !email || !password) {
    console.error('Name, email and password are all required.');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  await connectDB();

  const existing = await User.findOne({ email });
  if (existing) {
    console.error(`A user with email "${email}" already exists (role: ${existing.role}). Aborting.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const memberId = await generateMemberId();

  const admin = await User.create({
    name,
    email,
    password: hashedPassword,
    memberId,
    role: 'admin',
  });

  console.log(`Admin account created: ${admin.email} (memberId: ${admin.memberId})`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to create admin:', err.message);
  process.exit(1);
});
