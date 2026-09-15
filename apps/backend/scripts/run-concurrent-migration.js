/**
 * One-off migration runner for CONCURRENTLY-safe migrations.
 * Each statement is executed separately outside any transaction block.
 *
 * Usage: node scripts/run-concurrent-migration.js 124_practice_subjects_perf_indexes.sql
 */
import "dotenv/config";
import dns from "dns";
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dns.setDefaultResultOrder("ipv4first");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATION = process.argv[2];
if (!MIGRATION) {
  console.error(
    "Usage: node scripts/run-concurrent-migration.js <migration_file.sql>",
  );
  process.exit(1);
}

const migrationsDir = path.join(
  __dirname,
  "..",
  "src",
  "infrastructure",
  "database",
  "migrations",
);
const filePath = path.join(migrationsDir, MIGRATION);

if (!fs.existsSync(filePath)) {
  console.error(`Migration file not found: ${filePath}`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Aborting.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  const sql = fs.readFileSync(filePath, "utf8");
  // Split on semicolons, filter empty statements
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  console.log(
    `Applying ${statements.length} statements from ${MIGRATION} (CONCURRENTLY-safe)...`,
  );

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    // Strip trailing comment-only lines that got merged
    const clean = stmt.replace(/--.*$/gm, "").trim();
    if (!clean) continue;
    try {
      console.log(
        `  [${i + 1}/${statements.length}] ${clean.substring(0, 80)}...`,
      );
      await pool.query(stmt + ";");
      console.log(`  ✓ done`);
    } catch (err) {
      // CONCURRENTLY indexes may fail if already exists — non-fatal
      if (err.message.includes("already exists")) {
        console.log(`  ⏭  already exists, skipping`);
      } else {
        console.error(`  ✗ FAILED: ${err.message}`);
        process.exitCode = 1;
      }
    }
  }

  // Record migration
  try {
    await pool.query(
      "INSERT INTO schema_migrations (migration_name) VALUES ($1) ON CONFLICT (migration_name) DO NOTHING;",
      [MIGRATION],
    );
    console.log(`Migration ${MIGRATION} recorded in schema_migrations.`);
  } catch (err) {
    console.warn(`Could not record migration (non-fatal): ${err.message}`);
  }

  await pool.end();
  console.log("Done.");
})();
