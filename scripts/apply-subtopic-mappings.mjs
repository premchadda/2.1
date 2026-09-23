import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: 'apps/backend/.env' });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/apply-subtopic-mappings.mjs <mappings.json>');
    process.exit(1);
  }

  const mappings = JSON.parse(fs.readFileSync(file));
  console.log(`Applying ${mappings.length} subtopic updates from ${file}...`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Process in batches of 1000 for safety and progress logging
    const batchSize = 1000;
    let totalUpdated = 0;

    for (let i = 0; i < mappings.length; i += batchSize) {
      const batch = mappings.slice(i, i + batchSize);
      const ids = batch.map(m => m.id);
      const names = batch.map(m => m.new_name);

      const res = await client.query(`
        UPDATE subject_subtopics st
        SET name = u.name, updated_at = NOW()
        FROM (
          SELECT unnest($1::int[]) AS id, unnest($2::text[]) AS name
        ) u
        WHERE st.id = u.id AND st.is_deleted IS NOT TRUE
        RETURNING st.id
      `, [ids, names]);

      totalUpdated += res.rows.length;
      console.log(`Batch ${Math.floor(i / batchSize) + 1}: updated ${res.rows.length} / ${batch.length} subtopics.`);

      if (res.rows.length !== batch.length) {
        throw new Error(`Batch count mismatch! Expected ${batch.length}, updated ${res.rows.length}`);
      }
    }

    console.log(`Total subtopics updated: ${totalUpdated} / ${mappings.length}`);

    // Verify questions integrity
    const qCheck = await client.query(`
      SELECT count(q.id)
      FROM questions q
      JOIN subject_subtopics st ON q.subtopic_id = st.id
      JOIN subject_topics t ON st.topic_id = t.id
      JOIN subject_chapters c ON t.chapter_id = c.id
      WHERE q.is_deleted IS NOT TRUE AND (c.is_deleted IS TRUE OR t.is_deleted IS TRUE OR st.is_deleted IS TRUE)
    `);
    const brokenCount = parseInt(qCheck.rows[0].count, 10);
    console.log(`Question integrity check: ${brokenCount} broken questions found.`);
    if (brokenCount !== 0) {
      throw new Error(`Integrity check failed: ${brokenCount} questions broken!`);
    }

    // Verify bilingual count in database
    const statsCheck = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN name ~ '[\\u0900-\\u097F]' THEN 1 END) as bilingual,
        COUNT(CASE WHEN name !~ '[\\u0900-\\u097F]' THEN 1 END) as non_bilingual
      FROM subject_subtopics
      WHERE is_deleted IS NOT TRUE
    `);
    console.log('Subtopics stats after update:', statsCheck.rows[0]);

    await client.query('COMMIT');
    console.log(`Successfully committed all ${totalUpdated} updates!`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error occurred, transaction rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
