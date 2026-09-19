import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function verifyIntegrity() {
  try {
    const mismatchedChapter = await pool.query(`
      SELECT COUNT(*) 
      FROM questions q 
      JOIN subject_chapters sc ON q.chapter_id = sc.id 
      WHERE q.subject_id != sc.subject_id;
    `);
    console.log('Mismatched Question Subject vs Chapter Subject:', mismatchedChapter.rows[0].count);

    const mismatchedTopic = await pool.query(`
      SELECT COUNT(*) 
      FROM questions q 
      JOIN subject_topics st ON q.topic_id = st.id 
      WHERE q.chapter_id != st.chapter_id;
    `);
    console.log('Mismatched Question Chapter vs Topic Chapter:', mismatchedTopic.rows[0].count);

    const nullChapter = await pool.query(`
      SELECT COUNT(*) FROM questions WHERE chapter_id IS NULL;
    `);
    console.log('Questions with NULL chapter_id:', nullChapter.rows[0].count);

    const nullTopic = await pool.query(`
      SELECT COUNT(*) FROM questions WHERE topic_id IS NULL;
    `);
    console.log('Questions with NULL topic_id:', nullTopic.rows[0].count);

    const orphanedSubtopics = await pool.query(`
      SELECT COUNT(*) 
      FROM subject_topics st1 
      WHERE st1.parent_topic_id IS NOT NULL 
      AND NOT EXISTS (SELECT 1 FROM subject_topics st2 WHERE st2.id = st1.parent_topic_id);
    `);
    console.log('Orphaned subtopics (broken parent_topic_id):', orphanedSubtopics.rows[0].count);

    if (parseInt(mismatchedTopic.rows[0].count, 10) > 0) {
      const distinctMismatches = await pool.query(`
        SELECT q.chapter_id, sc.title as chapter_title, q.topic_id, st.name as topic_name, st.chapter_id as topic_chapter_id, sc2.title as topic_belongs_to_chapter, COUNT(*) as question_count
        FROM questions q 
        JOIN subject_chapters sc ON q.chapter_id = sc.id 
        JOIN subject_topics st ON q.topic_id = st.id 
        JOIN subject_chapters sc2 ON st.chapter_id = sc2.id
        WHERE q.chapter_id != st.chapter_id
        GROUP BY q.chapter_id, sc.title, q.topic_id, st.name, st.chapter_id, sc2.title
        ORDER BY question_count DESC;
      `);
      console.table(distinctMismatches.rows);
      
      const emptyChapters = await pool.query(`
        SELECT sc.id, sc.title, sc.subject_id, s.name as subject_name
        FROM subject_chapters sc
        LEFT JOIN subject_topics st ON st.chapter_id = sc.id
        LEFT JOIN subjects s ON sc.subject_id = s.id
        WHERE st.id IS NULL;
      `);
      console.log('Chapters with 0 topics:', emptyChapters.rows);

      const sampleTopics = await pool.query(`
        SELECT id, name, slug, subject, chapter_id, subject_id 
        FROM subject_topics 
        WHERE subject_id = 4 
        LIMIT 5;
      `);
      console.table(sampleTopics.rows);
    }
  } catch (err) {
    console.error('Error verifying integrity:', err);
  } finally {
    await pool.end();
  }
}

verifyIntegrity();
