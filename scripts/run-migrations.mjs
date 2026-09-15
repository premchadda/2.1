#!/usr/bin/env node
/**
 * CLI entry point for the database migration runner.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `.github/workflows/ci.yml` used to run
 * `node apps/backend/src/infrastructure/database/run-migrations.js` — a path that
 * has never existed in this repository, so the `test-migrations` job failed
 * before it could validate anything. `migrationRunner.js` only exports
 * `runMigrations(pool, { afterMigrations })`; this wrapper supplies a pool from
 * `DATABASE_URL` and turns failures into a non-zero exit code so CI stays honest.
 *
 * USAGE
 *   DATABASE_URL=postgresql://user:pass@host:5432/db node scripts/run-migrations.mjs
 *
 * ENV
 *   DATABASE_URL                 required (postgres:// or postgresql://)
 *   PG_SSL_REJECT_UNAUTHORIZED   "false" to accept a self-signed certificate
 *                                (default: reject; ignored for localhost)
 */
import pg from "pg";
import dotenv from "dotenv";
import { runMigrations } from "../apps/backend/src/infrastructure/database/migrationRunner.js";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("[migrations] DATABASE_URL is not set — refusing to run.");
  process.exit(1);
}

if (
  !connectionString.startsWith("postgres://") &&
  !connectionString.startsWith("postgresql://")
) {
  console.error(
    "[migrations] DATABASE_URL must start with postgres:// or postgresql://",
  );
  process.exit(1);
}

// Local/CI Postgres (docker-compose services, GitHub Actions service containers)
// has no TLS listener; hosted providers (Supabase) require it.
const isLocal = /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(
  connectionString,
);
const ssl = isLocal
  ? false
  : { rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== "false" };

const pool = new pg.Pool({ connectionString, ssl, max: 2 });

try {
  console.log("[migrations] applying migrations…");
  await runMigrations(pool, {});
  console.log("[migrations] all migrations applied.");
} catch (err) {
  console.error(`[migrations] FAILED: ${err?.message || err}`);
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => {});
}
