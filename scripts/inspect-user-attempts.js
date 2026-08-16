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

async function inspectAttempts() {
  const client = await pool.connect();
  try {
    console.log("=== INSPECTING ATTEMPTS TABLE DATA ===");
    const res = await client.query(`
      SELECT 
        a.id, 
        a.user_id, 
        a.test_id, 
        t.title as test_title,
        a.series_id,
        a.status, 
        a.created_at, 
        a.updated_at,
        a.submitted_at
      FROM attempts a
      LEFT JOIN tests t ON a.test_id = t.id
      ORDER BY a.id DESC;
    `);

    console.table(res.rows);

  } finally {
    client.release();
    await pool.end();
  }
}

inspectAttempts().catch(console.error);
