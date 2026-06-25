import { pool } from '../src/infrastructure/database/postgres-helpers.js';
import fs from 'fs';

const client = await pool.connect();
try {
  const result = {};

  const queryById = await client.query(
    "SELECT * FROM tests WHERE source_test_id = $1 OR slug = $2 OR title ILIKE '%Free Mock Test%'",
    ['3323285', 'ssc-cgl-tier-i-2026---free-mock-test']
  );
  result.matchingTests = queryById.rows;

  fs.writeFileSync('scratch/query-results.json', JSON.stringify(result, null, 2));
  console.log(`Found ${queryById.rows.length} matching test(s) in DB`);
} catch (e) {
  console.error(e);
} finally {
  client.release();
  process.exit(0);
}
