import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log("=== INSPECTING GS QUESTIONS LINKED TO REASONING SUBTOPICS ===");

  const res = await pool.query(`
    SELECT q.id, q.test_id, q.question_number, q.section,
           qs.name as q_subj, qc.title as q_chap, qt.name as q_top,
           st.name as subtop_name, st_s.name as subtop_subj,
           q.question_text
    FROM questions q
    JOIN subjects qs ON q.subject_id = qs.id
    JOIN subject_chapters qc ON q.chapter_id = qc.id
    JOIN subject_topics qt ON q.topic_id = qt.id
    JOIN subject_subtopics st ON q.subtopic_id = st.id
    JOIN subject_topics st_t ON st.topic_id = st_t.id
    JOIN subject_chapters st_c ON st_t.chapter_id = st_c.id
    JOIN subjects st_s ON st_c.subject_id = st_s.id
    WHERE qs.id IN (4, 5, 6, 7, 8, 9, 10, 11, 12, 13) -- All GS/GK
      AND st_s.id = 1 -- Subtopic belongs to Reasoning
    LIMIT 20;
  `);

  for (const r of res.rows) {
    console.log(`QID ${r.id} | Test ${r.test_id} #${r.question_number} | Sec: ${r.section}`);
    console.log(`  Current Q: Subj=[${r.q_subj}] | Chap=[${r.q_chap}] | Top=[${r.q_top}]`);
    console.log(`  Linked Subtopic: [${r.subtop_name}] (in ${r.subtop_subj})`);
    console.log(`  TEXT: ${r.question_text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 150)}`);
    console.log('---');
  }

  await pool.end();
}

main().catch(console.error);
