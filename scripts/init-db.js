require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
    console.log('Carely database schema initialized.');
  } finally {
    await pool.end();
  }
})().catch((error) => { console.error(error); process.exit(1); });
