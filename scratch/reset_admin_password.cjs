require('dotenv').config({path: './apps/backend/.env'});
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const email = 'admin@trstprep.com';
    const rawPassword = 'Admin@12345';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(rawPassword, salt);

    console.log("Checking if admin user exists in users table...");
    const checkRes = await pool.query("SELECT id, email, role, is_active FROM users WHERE email = $1", [email]);

    if (checkRes.rows.length > 0) {
      console.log("Admin user exists. Updating password...");
      await pool.query("UPDATE users SET password = $1, is_active = true, role = 'admin' WHERE email = $2", [hashedPassword, email]);
      console.log("Admin password updated successfully!");
    } else {
      console.log("Admin user does not exist. Creating admin user...");
      await pool.query(
        "INSERT INTO users (email, password, role, is_active, name, created_at, updated_at) VALUES ($1, $2, 'admin', true, 'System Admin', NOW(), NOW())",
        [email, hashedPassword]
      );
      console.log("Admin user created and password set successfully!");
    }

    process.exit(0);
  } catch (err) {
    console.error("Failed to reset password:", err);
    process.exit(1);
  }
}

run();
