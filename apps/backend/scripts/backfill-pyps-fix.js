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
    // Backfill pyq_year using simple [0-9]{4} regex
    const r1 = await pool.query(`
      UPDATE tests SET pyq_year = CAST(SUBSTRING(title FROM '([0-9]{4})') AS INTEGER)
      WHERE pyq_year IS NULL
        AND (is_pyq = true OR category = 'PYPs' OR 'pyp' = ANY(tags))
        AND title ~ '[0-9]{4}'
        AND CAST(SUBSTRING(title FROM '([0-9]{4})') AS INTEGER) BETWEEN 2010 AND 2030
      RETURNING id, title, pyq_year
    `);
    console.log('Backfilled pyq_year:', r1.rowCount);
    console.log(JSON.stringify(r1.rows, null, 2));

    // Backfill shift
    const r2 = await pool.query(`
      UPDATE tests SET shift = SUBSTRING(title FROM 'Shift ?([0-9]+)'::text)
      WHERE shift IS NULL
        AND (is_pyq = true OR category = 'PYPs' OR 'pyp' = ANY(tags))
        AND title ~* 'Shift'
      RETURNING id, title, shift
    `);
    console.log('Backfilled shift:', r2.rowCount);
    console.log(JSON.stringify(r2.rows, null, 2));

    // Final state
    const fin = await pool.query(`
      SELECT id, title, exam_id, exam_category_id, pyq_year, shift
      FROM tests
      WHERE is_active = true AND (is_pyq = true OR category = 'PYPs' OR 'pyp' = ANY(tags))
      ORDER BY pyq_year DESC NULLS LAST
    `);
    console.log('\n=== Final PYP state ===');
    console.log('Total:', fin.rows.length);
    console.log(JSON.stringify(fin.rows, null, 2));
  } catch (e) {
    console.error('ERR:', e.message);
  } finally {
    await pool.end();
  }
})();