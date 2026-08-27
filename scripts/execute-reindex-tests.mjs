import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const envPath = path.join(rootDir, 'apps', 'backend', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.substring(0, eqIdx).trim();
        let val = trimmed.substring(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

(async () => {
  console.log('Connecting to PostgreSQL with dedicated migration client...');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 0,
    query_timeout: 0
  });

  await client.connect();

  try {
    console.log('--- 1. Fetching all tests and computing chronological consecutive order ---');
    const { rows: testRows } = await client.query(`
      SELECT 
        t.id, 
        t.public_id,
        t.title, 
        t.category,
        t.sub_category,
        t.type,
        t.series_id,
        ts.title AS series_title
      FROM tests t
      LEFT JOIN test_series ts ON t.series_id = ts.id
      ORDER BY t.id ASC;
    `);

    console.log(`Found ${testRows.length} tests in database.`);

    const naturalSort = (a, b) => (a.title || '').localeCompare(b.title || '', undefined, { numeric: true, sensitivity: 'base' });
    
    // Sort all tests with proper series priority and natural title sort
    const sortedTests = [...testRows].sort((a, b) => {
      const sA = a.series_id || 999999;
      const sB = b.series_id || 999999;
      if (sA !== sB) return sA - sB;
      
      const catA = a.category || '';
      const catB = b.category || '';
      if (catA !== catB) return catA.localeCompare(catB);

      return naturalSort(a, b);
    });

    const mapping = sortedTests.map((t, idx) => ({
      oldId: t.id,
      newId: idx + 1,
      title: t.title,
      seriesId: t.series_id,
      seriesTitle: t.series_title || 'No Series',
      category: t.category
    }));

    console.log('--- 2. Starting PostgreSQL Transaction ---');
    await client.query('BEGIN;');

    // Create backup/mapping table
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_id_remap_backup (
        old_id INTEGER PRIMARY KEY,
        new_id INTEGER UNIQUE,
        title TEXT,
        series_id INTEGER,
        series_title TEXT,
        category TEXT,
        reindexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      TRUNCATE TABLE test_id_remap_backup;
    `);

    // Insert all mapping rows into test_id_remap_backup
    for (const m of mapping) {
      await client.query(
        `INSERT INTO test_id_remap_backup (old_id, new_id, title, series_id, series_title, category)
         VALUES ($1, $2, $3, $4, $5, $6);`,
        [m.oldId, m.newId, m.title, m.seriesId, m.seriesTitle, m.category]
      );
    }
    console.log(`Inserted ${mapping.length} mappings into test_id_remap_backup.`);

    console.log('--- 3. Dropping Foreign Key Constraints temporarily ---');
    const fkDropCommands = [
      'ALTER TABLE live_tests DROP CONSTRAINT IF EXISTS live_tests_test_id_fkey;',
      'ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_test_id_fkey;',
      'ALTER TABLE results DROP CONSTRAINT IF EXISTS results_test_id_fkey;',
      'ALTER TABLE topic_tests DROP CONSTRAINT IF EXISTS topic_tests_test_id_fkey;',
      'ALTER TABLE leaderboards DROP CONSTRAINT IF EXISTS leaderboards_test_fk;',
      'ALTER TABLE attempts DROP CONSTRAINT IF EXISTS attempts_test_id_fkey;',
      'ALTER TABLE test_questions DROP CONSTRAINT IF EXISTS test_questions_test_id_fkey;',
      'ALTER TABLE leaderboard_entries DROP CONSTRAINT IF EXISTS leaderboard_entries_test_id_fkey;',
      'ALTER TABLE leaderboard_entries DROP CONSTRAINT IF EXISTS fk_leaderboard_entries_test;',
      'ALTER TABLE wrong_questions DROP CONSTRAINT IF EXISTS wrong_questions_test_id_fkey;',
      'ALTER TABLE learner_recommendations DROP CONSTRAINT IF EXISTS learner_recommendations_target_test_id_fkey;',
      'ALTER TABLE test_sections DROP CONSTRAINT IF EXISTS test_sections_test_id_fkey;',
      'ALTER TABLE test_state_machine DROP CONSTRAINT IF EXISTS test_state_machine_test_id_fkey;'
    ];

    for (const cmd of fkDropCommands) {
      await client.query(cmd);
    }
    console.log('FK constraints dropped.');

    console.log('--- 4. Shifting all IDs to negative to prevent unique constraint collision ---');
    await client.query('UPDATE questions SET test_id = -test_id WHERE test_id IS NOT NULL;');
    await client.query('UPDATE test_questions SET test_id = -test_id WHERE test_id IS NOT NULL;');
    await client.query('UPDATE test_sections SET test_id = -test_id WHERE test_id IS NOT NULL;');
    await client.query('UPDATE attempts SET test_id = -test_id WHERE test_id IS NOT NULL;');
    await client.query('UPDATE leaderboards SET test_id = -test_id WHERE test_id IS NOT NULL;');
    await client.query('UPDATE leaderboard_entries SET test_id = -test_id WHERE test_id IS NOT NULL;');
    await client.query('UPDATE learner_recommendations SET target_test_id = -target_test_id WHERE target_test_id IS NOT NULL;');
    await client.query('UPDATE tests SET id = -id;');

    const optionalTables = [
      ['wrong_questions', 'test_id'],
      ['live_tests', 'test_id'],
      ['topic_tests', 'test_id'],
      ['results', 'test_id'],
      ['test_state_machine', 'test_id'],
      ['certificates', 'test_id'],
      ['leaderboard_snapshots', 'test_id'],
      ['test_attempts', 'test_id']
    ];

    for (const [tbl, col] of optionalTables) {
      try {
        await client.query(`UPDATE ${tbl} SET ${col} = -${col} WHERE ${col} IS NOT NULL;`);
      } catch (err) {
        // Table or column might not exist / empty, ignore safely
      }
    }
    console.log('All IDs shifted to negative.');

    console.log('--- 5. Remapping all tables to new consecutive positive IDs (1 to 493) ---');
    const childRemaps = [
      { name: 'tests', sql: 'UPDATE tests t SET id = m.new_id FROM test_id_remap_backup m WHERE t.id = -m.old_id;' },
      { name: 'questions', sql: 'UPDATE questions q SET test_id = m.new_id FROM test_id_remap_backup m WHERE q.test_id = -m.old_id;' },
      { name: 'test_questions', sql: 'UPDATE test_questions tq SET test_id = m.new_id FROM test_id_remap_backup m WHERE tq.test_id = -m.old_id;' },
      { name: 'test_sections', sql: 'UPDATE test_sections ts SET test_id = m.new_id FROM test_id_remap_backup m WHERE ts.test_id = -m.old_id;' },
      { name: 'attempts', sql: 'UPDATE attempts a SET test_id = m.new_id FROM test_id_remap_backup m WHERE a.test_id = -m.old_id;' },
      { name: 'leaderboards', sql: 'UPDATE leaderboards l SET test_id = m.new_id FROM test_id_remap_backup m WHERE l.test_id = -m.old_id;' },
      { name: 'leaderboard_entries', sql: 'UPDATE leaderboard_entries le SET test_id = m.new_id FROM test_id_remap_backup m WHERE le.test_id = -m.old_id;' },
      { name: 'learner_recommendations', sql: 'UPDATE learner_recommendations lr SET target_test_id = m.new_id FROM test_id_remap_backup m WHERE lr.target_test_id = -m.old_id;' }
    ];

    for (const cr of childRemaps) {
      const t0 = Date.now();
      const res = await client.query(cr.sql);
      console.log(`Remapped ${cr.name}: ${res.rowCount} rows (${Date.now() - t0}ms)`);
    }

    for (const [tbl, col] of optionalTables) {
      try {
        await client.query(`
          UPDATE ${tbl} t 
          SET ${col} = m.new_id 
          FROM test_id_remap_backup m 
          WHERE t.${col} = -m.old_id;
        `);
      } catch (err) {
        // Continue
      }
    }

    console.log('--- 6. Recreating Foreign Key Constraints ---');
    const fkRestoreCommands = [
      'ALTER TABLE live_tests ADD CONSTRAINT live_tests_test_id_fkey FOREIGN KEY (test_id) REFERENCES tests(id) ON UPDATE CASCADE ON DELETE CASCADE;',
      'ALTER TABLE questions ADD CONSTRAINT questions_test_id_fkey FOREIGN KEY (test_id) REFERENCES tests(id) ON UPDATE CASCADE ON DELETE CASCADE;',
      'ALTER TABLE results ADD CONSTRAINT results_test_id_fkey FOREIGN KEY (test_id) REFERENCES tests(id) ON UPDATE CASCADE ON DELETE CASCADE;',
      'ALTER TABLE topic_tests ADD CONSTRAINT topic_tests_test_id_fkey FOREIGN KEY (test_id) REFERENCES tests(id) ON UPDATE CASCADE ON DELETE CASCADE;',
      'ALTER TABLE leaderboards ADD CONSTRAINT leaderboards_test_fk FOREIGN KEY (test_id) REFERENCES tests(id) ON UPDATE CASCADE ON DELETE CASCADE;',
      'ALTER TABLE attempts ADD CONSTRAINT attempts_test_id_fkey FOREIGN KEY (test_id) REFERENCES tests(id) ON UPDATE CASCADE ON DELETE CASCADE;',
      'ALTER TABLE test_questions ADD CONSTRAINT test_questions_test_id_fkey FOREIGN KEY (test_id) REFERENCES tests(id) ON UPDATE CASCADE ON DELETE CASCADE;',
      'ALTER TABLE leaderboard_entries ADD CONSTRAINT leaderboard_entries_test_id_fkey FOREIGN KEY (test_id) REFERENCES tests(id) ON UPDATE CASCADE ON DELETE CASCADE;',
      'ALTER TABLE wrong_questions ADD CONSTRAINT wrong_questions_test_id_fkey FOREIGN KEY (test_id) REFERENCES tests(id) ON UPDATE CASCADE ON DELETE CASCADE;',
      'ALTER TABLE learner_recommendations ADD CONSTRAINT learner_recommendations_target_test_id_fkey FOREIGN KEY (target_test_id) REFERENCES tests(id) ON UPDATE CASCADE ON DELETE SET NULL;',
      'ALTER TABLE test_sections ADD CONSTRAINT test_sections_test_id_fkey FOREIGN KEY (test_id) REFERENCES tests(id) ON UPDATE CASCADE ON DELETE SET NULL;',
      'ALTER TABLE test_state_machine ADD CONSTRAINT test_state_machine_test_id_fkey FOREIGN KEY (test_id) REFERENCES tests(id) ON UPDATE CASCADE ON DELETE CASCADE;'
    ];

    for (const cmd of fkRestoreCommands) {
      await client.query(cmd);
    }
    console.log('FK constraints successfully restored with ON UPDATE CASCADE.');

    console.log('--- 7. Resetting tests_id_seq to max id ---');
    await client.query(`SELECT setval('tests_id_seq', (SELECT MAX(id) FROM tests));`);

    console.log('--- 8. Verifying Data Integrity ---');
    const [orphanQ, orphanTQ, orphanTS, orphanA] = await Promise.all([
      client.query(`SELECT COUNT(*)::int as c FROM questions q LEFT JOIN tests t ON q.test_id = t.id WHERE q.test_id IS NOT NULL AND t.id IS NULL;`),
      client.query(`SELECT COUNT(*)::int as c FROM test_questions tq LEFT JOIN tests t ON tq.test_id = t.id WHERE t.id IS NULL;`),
      client.query(`SELECT COUNT(*)::int as c FROM test_sections ts LEFT JOIN tests t ON ts.test_id = t.id WHERE ts.test_id IS NOT NULL AND t.id IS NULL;`),
      client.query(`SELECT COUNT(*)::int as c FROM attempts a LEFT JOIN tests t ON a.test_id = t.id WHERE t.id IS NULL;`)
    ]);

    const orphanCount = orphanQ.rows[0].c + orphanTQ.rows[0].c + orphanTS.rows[0].c + orphanA.rows[0].c;
    if (orphanCount > 0) {
      throw new Error(`Data verification failed! Found ${orphanCount} orphaned foreign key records.`);
    }

    console.log('Integrity verified: 0 orphaned rows.');

    await client.query('COMMIT;');
    console.log('=== TRANSACTION COMMITTED SUCCESSFULLY! ===');

  } catch (err) {
    console.error('Migration failed, rolling back transaction:', err);
    try {
      await client.query('ROLLBACK;');
      console.log('Rollback successful.');
    } catch (rbErr) {
      console.error('Rollback error:', rbErr);
    }
    process.exit(1);
  } finally {
    await client.end();
    process.exit(0);
  }
})();
