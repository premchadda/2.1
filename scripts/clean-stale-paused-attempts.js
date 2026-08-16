import dotenv from "dotenv";
import pg from "pg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendEnvPath = path.join(__dirname, "../apps/backend/.env");
const rootEnvPath = path.join(__dirname, "../.env");

if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else {
  dotenv.config();
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : { rejectUnauthorized: false }
});

async function cleanStaleAttempts() {
  const client = await pool.connect();
  try {
    console.log("=== CLEANING STALE EMPTY PAUSED ATTEMPTS FOR COMPLETED TESTS ===");

    // Mark PAUSED/IN_PROGRESS attempts as 'abandoned' if the user already has a completed attempt for that test and 0 answers
    const res = await client.query(`
      UPDATE attempts a
      SET status = 'abandoned'
      FROM attempts c
      WHERE a.user_id = c.user_id 
        AND a.test_id = c.test_id 
        AND c.status = 'completed'
        AND a.status IN ('PAUSED', 'paused', 'IN_PROGRESS', 'in_progress')
        AND (a.answers IS NULL OR a.answers = '[]'::jsonb OR jsonb_array_length(a.answers) = 0);
    `);

    console.log(`Updated ${res.rowCount} stale paused/in-progress attempt rows to 'abandoned'.`);

  } finally {
    client.release();
    await pool.end();
  }
}

cleanStaleAttempts().catch(console.error);
