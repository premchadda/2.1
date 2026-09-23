import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('Beginning transaction for reparenting and cleaning topics under deleted chapters...');
    await client.query('BEGIN');

    // 1. Reparent 5 questions from subtopic 705 to 533
    const qUpdate = await client.query(`
      UPDATE questions 
      SET subtopic_id = 533, updated_at = NOW()
      WHERE subtopic_id = 705 AND is_deleted IS NOT TRUE
      RETURNING id
    `);
    console.log(`Reparented ${qUpdate.rows.length} questions to subtopic 533 (IDs: ${qUpdate.rows.map(r => r.id).join(', ')})`);

    // 2. Soft-delete active subtopics under deleted chapters
    const subDelete = await client.query(`
      UPDATE subject_subtopics st
      SET is_deleted = TRUE, 
          deleted_at = NOW(), 
          deleted_reason = 'Parent chapter was soft-deleted; duplicate legacy quant seed'
      FROM subject_topics t
      JOIN subject_chapters c ON t.chapter_id = c.id
      WHERE st.topic_id = t.id 
        AND c.is_deleted IS TRUE 
        AND st.is_deleted IS NOT TRUE
      RETURNING st.id
    `);
    console.log(`Soft-deleted ${subDelete.rows.length} subtopics under deleted chapters.`);

    // 3. Soft-delete active topics under deleted chapters
    const topDelete = await client.query(`
      UPDATE subject_topics t
      SET is_deleted = TRUE, 
          deleted_at = NOW(), 
          deleted_reason = 'Parent chapter was soft-deleted; duplicate legacy quant seed'
      FROM subject_chapters c
      WHERE t.chapter_id = c.id 
        AND c.is_deleted IS TRUE 
        AND t.is_deleted IS NOT TRUE
      RETURNING t.id
    `);
    console.log(`Soft-deleted ${topDelete.rows.length} topics under deleted chapters.`);

    // Verification inside transaction
    const verifyQ = await client.query(`
      SELECT count(q.id)
      FROM questions q
      JOIN subject_subtopics st ON q.subtopic_id = st.id
      JOIN subject_topics t ON st.topic_id = t.id
      JOIN subject_chapters c ON t.chapter_id = c.id
      WHERE q.is_deleted IS NOT TRUE AND c.is_deleted IS TRUE
    `);
    if (parseInt(verifyQ.rows[0].count, 10) !== 0) {
      throw new Error(`Integrity check failed: ${verifyQ.rows[0].count} questions still in deleted chapters!`);
    }

    await client.query('COMMIT');
    console.log('Transaction committed successfully! 0 questions broken.');
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
