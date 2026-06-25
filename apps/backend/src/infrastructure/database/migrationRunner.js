import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(pool) {
  const migrationsDir = path.join(__dirname, 'migrations');
  console.log(`[Migrations] Scanning migrations from: ${migrationsDir}`);

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

  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }));

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
  const duplicates = [...prefixMap.entries()].filter(([, list]) => list.length > 1);
  if (duplicates.length > 0) {
    const details = duplicates
      .map(([prefix, list]) => `  ${prefix}_: ${list.join(', ')}`)
      .join('\n');
    throw new Error(
      `[Migrations] Duplicate numeric prefix detected. Rename one of each pair so prefixes are unique.\n${details}`
    );
  }

  // 3. Get applied migrations
  const { rows } = await pool.query('SELECT migration_name FROM schema_migrations;');
  const applied = new Set(rows.map(r => r.migration_name));

  console.log(`[Migrations] Found ${files.length} migration files. ${applied.size} already applied.`);

  // 4. Run pending migrations sequentially
  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    console.log(`[Migrations] Applying pending migration: ${file}...`);
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    try {
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations (migration_name) VALUES ($1);', [file]);
      console.log(`[Migrations] Successfully applied: ${file}`);
    } catch (error) {
      console.error(`[Migrations] Failed to apply migration: ${file}`);
      console.error(error);
      throw error; // halt backend startup on migration failure
    }
  }

  console.log('[Migrations] All migrations verified up-to-date.');
}
