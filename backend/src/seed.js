
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { pool } = require('./db');

(async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const demos = [
      [
        'System Administrator Demo',
        'admin@example.com',
        'Mumbai',
        'Admin@1234',
        'ADMIN'
      ],
      [
        'Demo Store Owner Account',
        'owner@example.com',
        'Mumbai',
        'Owner@1234',
        'OWNER'
      ],
      [
        'Demo Normal User Account',
        'user@example.com',
        'Mumbai',
        'User@1234',
        'USER'
      ]
    ];

    const ids = {};

    for (const [name, email, address, password, role] of demos) {
      const hash = await bcrypt.hash(password, 10);

      const result = await client.query(
        `INSERT INTO users (name, email, address, password_hash, role)
         VALUES ($1, $2::VARCHAR, $3, $4, $5)
         ON CONFLICT (email)
         DO UPDATE SET
           name = EXCLUDED.name,
           address = EXCLUDED.address,
           password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role
         RETURNING id`,
        [name, email, address, hash, role]
      );

      ids[role] = result.rows[0].id;
    }

    // Insert the demo store if it does not already exist.
    await client.query(
      `INSERT INTO stores (name, email, address, owner_id)
       SELECT $1, $2::VARCHAR, $3, $4
       WHERE NOT EXISTS (
         SELECT 1 FROM stores WHERE email = $2::VARCHAR
       )`,
      [
        'Demo Corner Market',
        'store@example.com',
        '123 Demo Street, Mumbai',
        ids.OWNER
      ]
    );

    await client.query('COMMIT');

    console.log('Demo accounts seeded successfully.');
    console.log('Admin: admin@example.com / Admin@1234');
    console.log('Owner: owner@example.com / Owner@1234');
    console.log('User: user@example.com / User@1234');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
