require('dotenv').config();
const { pool } = require('./db');

(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(60) NOT NULL CHECK (char_length(name) BETWEEN 20 AND 60),
        email VARCHAR(254) NOT NULL UNIQUE,
        address VARCHAR(400) NOT NULL DEFAULT '',
        password_hash TEXT NOT NULL,
        role VARCHAR(10) NOT NULL CHECK (role IN ('ADMIN','USER','OWNER')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS stores (
        id SERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        email VARCHAR(254) NOT NULL,
        address VARCHAR(400) NOT NULL DEFAULT '',
        owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ratings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, store_id)
      );
      CREATE INDEX IF NOT EXISTS idx_stores_name ON stores(name);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_ratings_store ON ratings(store_id);
    `);
    console.log('Database schema is ready.');
  } catch (e) { console.error(e); process.exitCode = 1; }
  finally { await pool.end(); }
})();
