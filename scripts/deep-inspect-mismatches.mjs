import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log("=== TAXONOMY HIERARCHY INTEGRITY ANALYSIS ===");

  // 1. Check questions where question.subject_id != chapter.subject_id
  const q1 = await pool.query(`
    SELECT COUNT(*) as cnt
    FROM questions q
    JOIN subject_chapters c ON q.chapter_id = c.id
    WHERE q.subject_id != c.subject_id;
  `);
  console.log("1. Mismatches: q.subject_id != chapter.subject_id:", q1.rows[0].cnt);

  // 2. Check questions where question.chapter_id != topic.chapter_id
  const q2 = await pool.query(`
    SELECT COUNT(*) as cnt
    FROM questions q
    JOIN subject_topics t ON q.topic_id = t.id
    WHERE q.chapter_id != t.chapter_id;
  `);
  console.log("2. Mismatches: q.chapter_id != topic.chapter_id:", q2.rows[0].cnt);

  // 3. Check questions where question.topic_id != subtopic.topic_id
  const q3 = await pool.query(`
    SELECT COUNT(*) as cnt
    FROM questions q
    JOIN subject_subtopics st ON q.subtopic_id = st.id
    WHERE q.topic_id != st.topic_id;
  `);
  console.log("3. Mismatches: q.topic_id != subtopic.topic_id:", q3.rows[0].cnt);

  // 4. Check questions where subtopic's effective subject != question.subject_id
  const q4 = await pool.query(`
    SELECT COUNT(*) as cnt
    FROM questions q
    JOIN subject_subtopics st ON q.subtopic_id = st.id
    JOIN subject_topics t ON st.topic_id = t.id
    JOIN subject_chapters c ON t.chapter_id = c.id
    WHERE q.subject_id != c.subject_id;
  `);
  console.log("4. Mismatches: q.subject_id != subtopic->topic->chapter->subject_id:", q4.rows[0].cnt);

  // 5. Let's see the distribution of these mismatches by question.subject_id and subtopic's real subject
  const q5 = await pool.query(`
    SELECT 
      qs.name as question_subject,
      st_s.name as subtopic_real_subject,
      COUNT(*) as count
    FROM questions q
    JOIN subjects qs ON q.subject_id = qs.id
    JOIN subject_subtopics st ON q.subtopic_id = st.id
    JOIN subject_topics st_t ON st.topic_id = st_t.id
    JOIN subject_chapters st_c ON st_t.chapter_id = st_c.id
    JOIN subjects st_s ON st_c.subject_id = st_s.id
    WHERE q.subject_id != st_c.subject_id
    GROUP BY qs.name, st_s.name
    ORDER BY count DESC
    LIMIT 25;
  `);
  console.log("\nTop 25 Cross-Subject Subtopic Links:");
  console.table(q5.rows);

  // 6. Let's check topic->chapter mismatches breakdown
  const q6 = await pool.query(`
    SELECT 
      qc.title as question_chapter,
      tt_c.title as topic_real_chapter,
      COUNT(*) as count
    FROM questions q
    JOIN subject_chapters qc ON q.chapter_id = qc.id
    JOIN subject_topics t ON q.topic_id = t.id
    JOIN subject_chapters tt_c ON t.chapter_id = tt_c.id
    WHERE q.chapter_id != t.chapter_id
    GROUP BY qc.title, tt_c.title
    ORDER BY count DESC;
  `);
  console.log("\nBreakdown of Topic-Chapter Mismatches (121 total):");
  console.table(q6.rows);

  await pool.end();
}

main().catch(console.error);
