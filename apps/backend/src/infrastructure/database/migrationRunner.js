import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fixed 64-bit key for the migration advisory lock. Any value works as long as
// every instance uses the same one. Chosen arbitrarily but kept constant.
const MIGRATION_ADVISORY_LOCK_KEY = 727274266; // "trstprep-migrations"

export async function runMigrations(pool, { afterMigrations } = {}) {
  const migrationsDir = path.join(__dirname, "migrations");
  console.log(`[Migrations] Scanning migrations from: ${migrationsDir}`);

  // H18 FIX: acquire a session-level advisory lock BEFORE doing any migration
  // work. Without it, two instances booting simultaneously (e.g. rolling deploy,
  // horizontal scaling) can both attempt to apply the same pending migration,
  // producing duplicate/partial application and confusing errors. The lock is
  // held on a dedicated client for the whole run and released in `finally`.
  // Other instances block here until the holder finishes, then see the
  // migrations as already applied.
  const lockClient = await pool.connect();
  try {
    console.log("[Migrations] Acquiring advisory lock...");
    await lockClient.query("SELECT pg_advisory_lock($1)", [
      MIGRATION_ADVISORY_LOCK_KEY,
    ]);
    console.log("[Migrations] Advisory lock acquired.");

    await runMigrationsLocked(pool, migrationsDir, { afterMigrations });
  } finally {
    try {
      await lockClient.query("SELECT pg_advisory_unlock($1)", [
        MIGRATION_ADVISORY_LOCK_KEY,
      ]);
    } catch (unlockError) {
      console.error(
        "[Migrations] Failed to release advisory lock:",
        unlockError.message,
      );
    }
    lockClient.release();
  }
}

async function runMigrationsLocked(
  pool,
  migrationsDir,
  { afterMigrations } = {},
) {
  // 1. Ensure schema_migrations table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      migration_name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // 2. Read migration files
  if (!fs.existsSync(migrationsDir)) {
    console.warn(`[Migrations] Directory not found: ${migrationsDir}`);
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) =>
      a.localeCompare(b, "en", { numeric: true, sensitivity: "base" }),
    );

  // 2a. Detect duplicate numeric prefixes (e.g., 038_a.sql + 038_b.sql).
  //     Lexicographic sort alone does not prevent the runner from applying both,
  //     but humans + tooling rely on a unique prefix. Fail fast with a
  //     descriptive error pointing at the conflicting files.
  const prefixMap = new Map();
  for (const file of files) {
    const match = file.match(/^(\d{3})_/);
    if (!match) continue;
    const prefix = match[1];
    if (!prefixMap.has(prefix)) prefixMap.set(prefix, []);
    prefixMap.get(prefix).push(file);
  }
  const duplicates = [...prefixMap.entries()].filter(
    ([, list]) => list.length > 1,
  );
  if (duplicates.length > 0) {
    const details = duplicates
      .map(([prefix, list]) => `  ${prefix}_: ${list.join(", ")}`)
      .join("\n");
    throw new Error(
      `[Migrations] Duplicate numeric prefix detected. Rename one of each pair so prefixes are unique.\n${details}`,
    );
  }

  // 3. Get applied migrations
  const { rows } = await pool.query(
    "SELECT migration_name FROM schema_migrations;",
  );
  const applied = new Set(rows.map((r) => r.migration_name));

  console.log(
    `[Migrations] Found ${files.length} migration files. ${applied.size} already applied.`,
  );

  // 4. Run pending migrations sequentially
  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    console.log(`[Migrations] Applying pending migration: ${file}...`);
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf8");

    const client = await pool.connect();
    try {
      // Prefer DB_ENCRYPTION_KEY (canonical) then PGCRYPTO_KEY (legacy alias); never use JWT_SECRET
      const cryptoKey =
        process.env.DB_ENCRYPTION_KEY ||
        process.env.PGCRYPTO_KEY ||
        "dev-fallback-trstprep-pgcrypto-key-32bytes";
      if (
        cryptoKey.startsWith("dev-fallback") &&
        process.env.NODE_ENV === "production"
      ) {
        throw new Error(
          "FATAL: DB_ENCRYPTION_KEY/PGCRYPTO_KEY must be configured in production — refusing dev fallback",
        );
      }
      if (cryptoKey.startsWith("dev-fallback")) {
        console.warn(
          "[Migrations] Using dev fallback pgcrypto key — set DB_ENCRYPTION_KEY for prod",
        );
      }
      await client.query("SELECT set_config('app.pgcrypto_key', $1, false);", [
        cryptoKey,
      ]);

      const trimmedSql = sql.trim();
      const hasTransaction = /^\s*BEGIN\b/i.test(trimmedSql);
      const isConcurrent = /CONCURRENTLY/i.test(trimmedSql);
      if (hasTransaction) {
        await client.query(trimmedSql);
      } else if (isConcurrent) {
        // CONCURRENTLY cannot run inside a transaction block — run outside
        await client.query(trimmedSql);
      } else {
        await client.query("BEGIN");
        await client.query(trimmedSql);
        await client.query("COMMIT");
      }
      await client.query(
        "INSERT INTO schema_migrations (migration_name) VALUES ($1);",
        [file],
      );
      console.log(`[Migrations] Successfully applied: ${file}`);
    } catch (error) {
      const trimmedSql = sql.trim();
      const hasTransaction = /^\s*BEGIN\b/i.test(trimmedSql);
      const isConcurrent = /CONCURRENTLY/i.test(trimmedSql);
      if (!hasTransaction && !isConcurrent) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("[Migrations] Rollback failed:", rollbackError.message);
        }
      }
      console.error(`[Migrations] Failed to apply migration: ${file}`);
      console.error(error);
      throw error; // halt backend startup on migration failure
    } finally {
      client.release();
    }
  }

  console.log("[Migrations] All migrations verified up-to-date.");

  if (typeof afterMigrations === "function") {
    afterMigrations();
  }
}
