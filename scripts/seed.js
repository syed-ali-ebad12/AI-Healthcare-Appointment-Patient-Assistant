require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const passwordHash = await bcrypt.hash('ChangeMe123!', 12);
  const users = [
    ['Jordan Davis', 'admin@carely.local', '+15550000001', 'admin', null],
    ['Dr. Emily Carter', 'doctor@carely.local', '+15550000002', 'doctor', 'Cardiology'],
    ['Sarah Mitchell', 'patient@carely.local', '+15550000003', 'patient', null]
  ];
  try {
    for (const user of users) {
      await pool.query(`INSERT INTO users (name,email,phone,password_hash,role,specialization)
        VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, phone=EXCLUDED.phone, role=EXCLUDED.role, specialization=EXCLUDED.specialization`, [...user.slice(0, 3), passwordHash, ...user.slice(3)]);
    }
    console.log('Seed complete. Password for all demo users: ChangeMe123!');
  } finally { await pool.end(); }
})().catch((error) => { console.error(error); process.exit(1); });
