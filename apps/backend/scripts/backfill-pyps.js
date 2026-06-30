import 'dotenv/config';
import pg from 'pg';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

(async () => {
  try {
    // 1. Backfill exam_category_id by matching exam_id to exam id::text
    const r1 = await pool.query(`
      UPDATE tests SET exam_category_id = ec.id
      FROM exams e JOIN exam_categories ec ON ec.category_id = e.category_id
      WHERE tests.exam_id = e.id::text
        AND tests.exam_category_id IS NULL
        AND (tests.is_pyq = true OR tests.category = 'PYPs' OR 'pyp' = ANY(tests.tags))
      RETURNING tests.id, tests.title
    `);
    console.log('Backfilled exam_category_id (by exam id):', r1.rowCount);

    // 2. Backfill by matching exam_id slug to exam title (e.g. 'ssc-cgl' -> 'SSC CGL')
    const r2 = await pool.query(`
      UPDATE tests SET exam_category_id = ec.id, exam_id = e.id::text
      FROM exams e JOIN exam_categories ec ON ec.category_id = e.category_id
      WHERE REPLACE(LOWER(e.title), ' ', '-') = tests.exam_id
        AND tests.exam_category_id IS NULL
        AND (tests.is_pyq = true OR tests.category = 'PYPs' OR 'pyp' = ANY(tests.tags))
      RETURNING tests.id, tests.title, tests.exam_id
    `);
    console.log('Backfilled exam_category_id (by title slug):', r2.rowCount);
    console.log(JSON.stringify(r2.rows, null, 2));

    // 3. Backfill pyq_year from title (extract 4-digit year)
    const r3 = await pool.query(`
      UPDATE tests SET pyq_year = CAST(SUBSTRING(title FROM '\\b(20\\d{2})\\b') AS INTEGER)
      WHERE pyq_year IS NULL
        AND (is_pyq = true OR category = 'PYPs' OR 'pyp' = ANY(tags))
        AND title ~ '\\b20\\d{2}\\b'
      RETURNING id, title, pyq_year
    `);
    console.log('Backfilled pyq_year:', r3.rowCount);
    console.log(JSON.stringify(r3.rows, null, 2));

    // 4. Backfill shift from title
    const r4 = await pool.query(`
      UPDATE tests SET shift = SUBSTRING(title FROM 'shift\\s*[-:]?\\s*(\\d+)'::text)
      WHERE shift IS NULL
        AND (is_pyq = true OR category = 'PYPs' OR 'pyp' = ANY(tags))
        AND title ~* 'shift\\s*[-:]?\\s*\\d+'
      RETURNING id, title, shift
    `);
    console.log('Backfilled shift:', r4.rowCount);
    console.log(JSON.stringify(r4.rows, null, 2));

    // 5. Verify final state
    const final = await pool.query(`
      SELECT id, title, exam_id, exam_category_id, pyq_year, shift
      FROM tests
      WHERE is_active = true AND (is_pyq = true OR category = 'PYPs' OR 'pyp' = ANY(tags))
      ORDER BY pyq_year DESC NULLS LAST
    `);
    console.log('\n=== Final PYP state ===');
    console.log(JSON.stringify(final.rows, null, 2));

  } catch (e) {
    console.error('ERR:', e.message);
  } finally {
    await pool.end();
  }
})();