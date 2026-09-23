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
    console.error('Usage: node scripts/apply-batch-mappings.mjs <mappings.json>');
    process.exit(1);
  }

  const mappings = JSON.parse(fs.readFileSync(file));
  console.log(`Applying ${mappings.length} topic updates from ${file}...`);

  const ids = mappings.map(m => m.id);
  const names = mappings.map(m => m.new_name);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const res = await client.query(`
      UPDATE subject_topics t
      SET name = u.name, updated_at = NOW()
      FROM (
        SELECT unnest($1::int[]) AS id, unnest($2::text[]) AS name
      ) u
      WHERE t.id = u.id AND t.is_deleted IS NOT TRUE
      RETURNING t.id
    `, [ids, names]);

    console.log(`Updated ${res.rows.length} / ${mappings.length} topics.`);

    if (res.rows.length !== mappings.length) {
      throw new Error(`Count mismatch! Expected ${mappings.length}, updated ${res.rows.length}`);
    }

    // Verify questions integrity
    const qCheck = await client.query(`
      SELECT count(q.id)
      FROM questions q
      JOIN subject_subtopics st ON q.subtopic_id = st.id
      JOIN subject_topics t ON st.topic_id = t.id
      JOIN subject_chapters c ON t.chapter_id = c.id
      WHERE q.is_deleted IS NOT TRUE AND (c.is_deleted IS TRUE OR t.is_deleted IS TRUE OR st.is_deleted IS TRUE)
    `);
    if (parseInt(qCheck.rows[0].count, 10) !== 0) {
      throw new Error(`Integrity check failed: ${qCheck.rows[0].count} questions broken!`);
    }

    await client.query('COMMIT');
    console.log(`Successfully committed updates from ${file}!`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Transaction rolled back due to error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
