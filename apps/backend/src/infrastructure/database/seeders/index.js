/**
 * Database Seeders — top-level entry point.
 *
 *   import { runSeeders } from './seeders/index.js';
 *   await runSeeders(pool);
 *
 * Add new seeders to `ORDER` below. Each seeder runs idempotently
 * (ON CONFLICT DO NOTHING / UPSERT-by-PK), so calling this script
 * twice is safe.
 *
 * Usage from CLI:
 *   node apps/backend/src/infrastructure/database/seeders/index.js
 */
import dotenv from 'dotenv';
import pg from 'pg';
import { runMigrations } from '../migrationRunner.js';
import { dbHelpers } from '../postgres-helpers.js';

import SubjectsSeeder    from './subjects.seeder.js';
import TestsSeeder       from './tests.seeder.js';
import QuestionsSeeder   from './questions.seeder.js';
import LiveTestsSeeder   from './live_tests.seeder.js';
import ExamRoomsSeeder   from './exam_rooms.seeder.js';
import AppSettingsSeeder from './app_settings.seeder.js';

dotenv.config();

// Order matters: subjects → tests → questions → live_tests → exam_rooms → app_settings.
// Foreign keys require parents to exist before children.
export const ORDER = [
  { name: 'subjects',     seeder: SubjectsSeeder    },
  { name: 'tests',        seeder: TestsSeeder       },
  { name: 'questions',    seeder: QuestionsSeeder   },
  { name: 'live_tests',   seeder: LiveTestsSeeder   },
  { name: 'exam_rooms',   seeder: ExamRoomsSeeder   },
  { name: 'app_settings', seeder: AppSettingsSeeder },
];

export async function runSeeders(pool, { logger = console, runMigrationsFirst = true } = {}) {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set; cannot run seeders.');
  }
  if (runMigrationsFirst) {
    logger.log?.('[seed] Running migrations first to ensure schema is up to date...');
    await runMigrations(pool, { afterMigrations: () => dbHelpers.clearColumnExistsCache() });
  }

  const summary = [];
  for (const { name, seeder } of ORDER) {
    const t0 = Date.now();
    try {
      const result = await seeder.run(pool, { logger });
      summary.push({ name, ...result, durationMs: Date.now() - t0 });
    } catch (err) {
      summary.push({ name, error: err.message, durationMs: Date.now() - t0 });
      logger.error?.(`[seed] ${name} failed: ${err.message}`);
      throw err;
    }
  }

  logger.log?.('\n[seed] Summary:');
  for (const s of summary) {
    if (s.error) {
      logger.log?.(`  \u274c ${s.name.padEnd(15)} ${s.error} (${s.durationMs}ms)`);
    } else {
      logger.log?.(`  \u2705 ${s.name.padEnd(15)} inserted=${s.inserted} skipped=${s.skipped} (${s.durationMs}ms)`);
    }
  }
  return summary;
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const { Pool } = pg;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  runSeeders(pool)
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed] fatal:', err);
      pool.end().finally(() => process.exit(1));
    });
}
