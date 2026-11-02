# Store Rating Platform

Full-stack coding challenge implementation using **React + Vite**, **Express.js**, and **PostgreSQL**.

## Features
- Shared JWT login and public normal-user registration
- Roles: `ADMIN`, `USER`, `OWNER`
- Admin dashboard counts, user/store creation, listings, filtering and sorting
- User store search, rating submission and rating modification (1–5)
- Store owner dashboard with average rating and rating contributors
- Password update, validation, bcrypt password hashing
- PostgreSQL schema with constraints and one rating per user/store

## Quick start
Requirements: Node.js 20+, PostgreSQL 14+.

1. Create a database:
   ```sql
   CREATE DATABASE store_rating;
   ```
2. Configure backend:
   ```bash
   cd backend
   cp .env.example .env
   # Set DATABASE_URL and JWT_SECRET
   npm install
   npm run db:setup
   npm run seed
   npm run dev
   ```
3. Start frontend in another terminal:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
4. Open the Vite URL (normally http://localhost:5173).

### Seeded logins
- Admin: `admin@example.com` / `Admin@1234`
- Store owner: `owner@example.com` / `Owner@1234`
- Normal user: `user@example.com` / `User@1234`

The seed script is safe to re-run; it inserts demo accounts/store if absent.

## API overview
- `POST /api/auth/register` — public normal-user signup
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PATCH /api/auth/password`
- Admin: `/api/admin/dashboard`, `/api/admin/users`, `/api/admin/stores`
- User: `GET /api/stores`, `PUT /api/stores/:id/rating`
- Owner: `GET /api/owner/dashboard`

## Notes
- Name validation is 20–60 characters; address max 400 characters.
- Password validation: 8–16 characters, at least one uppercase and one special character.
- Email validation is applied on the client and server.
- API authorization is role-based; do not rely on frontend route hiding.
