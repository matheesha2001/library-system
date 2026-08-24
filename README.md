<<<<<<< HEAD
# Library Management System

Full-stack practice project (PUSL3120 style brief) — React frontend, Node.js/Express backend, MongoDB database, real-time updates via Socket.io.

## Features
- Register / Login with JWT authentication (member & admin roles)
- Book catalogue (CRUD, admin-only add/edit/delete)
- Borrow / return books (CRUD on borrow records)
- **Real-time**: when any user borrows or returns a book, every connected browser's "available copies" count updates instantly via WebSockets — no refresh needed
- Admin-only book management

## Project structure
```
library-system/
├── backend/     # Node.js + Express + MongoDB + Socket.io API
└── frontend/    # React (Vite) client
```

## Prerequisites
- Node.js (v18+) installed
- A MongoDB Atlas connection string (free tier)

## Setup

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env
# edit .env: paste your MongoDB Atlas connection string into MONGO_URI,
# and set a random string for JWT_SECRET
npm run dev
```
Backend runs on http://localhost:5000

### 2. Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
Frontend runs on http://localhost:5173

### 3. Try it out
1. Open two browser windows (or one normal + one incognito) at http://localhost:5173
2. Register two accounts — make one an "admin" and one a "member"
3. Log in as admin in one window, add a book
4. Log in as member in the other window — watch the book appear / availability update live when you borrow it, without refreshing

## Running tests
```bash
cd backend
npm test
```

## Deployment (suggested free options)
- Backend: Render.com (Node web service)
- Frontend: Vercel or Netlify
- Database: MongoDB Atlas (already cloud-hosted)

## Tech stack
- Frontend: React 18, Vite, React Router, Axios, Socket.io-client
- Backend: Node.js, Express, Mongoose, Socket.io, JWT, bcrypt
- Database: MongoDB (Atlas)
- Testing: Jest, Supertest
# library-system
=======
# library-system
>>>>>>> 70d8f2670565067a149b5c2763624c387397f248
