import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

// Debug helper: inspect a user's attempts. Target email is supplied via
// CLI argv or env (TARGET_USER_EMAIL) — never hardcoded (DPDP/PII).
// Usage: node scripts/check_user_attempts.js <email>
//   or: TARGET_USER_EMAIL=<email> node scripts/check_user_attempts.js
const targetEmail = process.argv[2] || process.env.TARGET_USER_EMAIL;
if (!targetEmail) {
  console.error(
    "Usage: node scripts/check_user_attempts.js <email>  (or set TARGET_USER_EMAIL)",
  );
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    const res = await pool.query(
      `
      SELECT a.id, a.public_id, a.user_id, a.test_id, a.status, a.is_completed, a.created_at, a.updated_at, u.email
      FROM attempts a
      JOIN users u ON a.user_id = u.id
      WHERE u.email = $1
      ORDER BY a.updated_at DESC
    `,
      [targetEmail],
    );
    console.log(`Attempts for ${targetEmail}:`);
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
