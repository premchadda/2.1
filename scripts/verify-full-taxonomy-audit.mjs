import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

function cleanText(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function verify() {
  console.log("=== COMPREHENSIVE POST-CLASSIFICATION AUDIT & INTEGRITY CHECK ===");

  // 1. Check Chapter-Subject consistency
  const chMismatch = await pool.query(`
    SELECT COUNT(*) as count
    FROM questions q
    JOIN subject_chapters c ON q.chapter_id = c.id
    WHERE q.subject_id != c.subject_id;
  `);
  console.log(`1. Questions with q.subject_id != chapter.subject_id: ${chMismatch.rows[0].count} (Expected: 0)`);

  // 2. Check Topic-Chapter consistency
  const topMismatch = await pool.query(`
    SELECT COUNT(*) as count
    FROM questions q
    JOIN subject_topics t ON q.topic_id = t.id
    WHERE q.chapter_id != t.chapter_id;
  `);
  console.log(`2. Questions with q.chapter_id != topic.chapter_id: ${topMismatch.rows[0].count} (Expected: 0)`);

  // 3. Check Subtopic-Topic consistency
  const subMismatch = await pool.query(`
    SELECT COUNT(*) as count
    FROM questions q
    JOIN subject_subtopics st ON q.subtopic_id = st.id
    WHERE q.topic_id != st.topic_id;
  `);
  console.log(`3. Questions with q.topic_id != subtopic.topic_id: ${subMismatch.rows[0].count} (Expected: 0)`);

  // 4. Check Subtopic-Subject consistency (The 2,667 Practice Lab leak)
  const crossSub = await pool.query(`
    SELECT COUNT(*) as count
    FROM questions q
    JOIN subject_subtopics st ON q.subtopic_id = st.id
    JOIN subject_topics t ON st.topic_id = t.id
    JOIN subject_chapters c ON t.chapter_id = c.id
    WHERE q.subject_id != c.subject_id;
  `);
  console.log(`4. Questions with q.subject_id != subtopic->subject_id: ${crossSub.rows[0].count} (Expected: 0)`);

  // 5. Check remaining NULLs
  const nulls = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE subject_id IS NULL) as null_subj,
      COUNT(*) FILTER (WHERE chapter_id IS NULL) as null_chap,
      COUNT(*) FILTER (WHERE topic_id IS NULL) as null_top,
      COUNT(*) FILTER (WHERE subtopic_id IS NULL) as null_subtop
    FROM questions;
  `);
  console.log(`5. Null taxonomy counts:`, nulls.rows[0]);

  // 6. Check the 17 Benchmark Questions
  const targetIds = [
    44470, 50228, 37833, 45750, 48493, 37540, 46032, 45941,
    53754, 36975, 32972, 3292, 24920, 22106, 38889, 39059, 37317
  ];

  const benchRes = await pool.query(`
    SELECT q.id, q.test_id, q.question_number,
           qs.name as subj, qc.title as chap, qt.name as top, qst.name as subtop,
           q.question_text
    FROM questions q
    JOIN subjects qs ON q.subject_id = qs.id
    JOIN subject_chapters qc ON q.chapter_id = qc.id
    JOIN subject_topics qt ON q.topic_id = qt.id
    JOIN subject_subtopics qst ON q.subtopic_id = qst.id
    WHERE q.id = ANY($1::int[])
    ORDER BY q.id;
  `, [targetIds]);

  console.log("\n6. Status of Benchmark Questions:");
  for (const b of benchRes.rows) {
    console.log(`QID ${b.id} | ${b.subj} -> ${b.chap} -> ${b.top} -> ${b.subtop}`);
    console.log(`   Snippet: ${cleanText(b.question_text).slice(0, 80)}`);
  }

  // 7. Practice Lab Simulation: Query questions for Polity Preamble subtopic 3492
  console.log("\n7. Practice Lab Simulation: Testing Subtopic 3492 (Constitutional Amendments Related to Preamble)...");
  const pSim = await pool.query(`
    SELECT q.id, q.question_text, qs.name as subj
    FROM questions q
    JOIN subjects qs ON q.subject_id = qs.id
    WHERE q.subtopic_id = 3492;
  `);
  console.log(`Found ${pSim.rows.length} questions in subtopic 3492. Any Reasoning leaks?`);
  let hasLeak = false;
  for (const pq of pSim.rows) {
    const text = cleanText(pq.question_text).toLowerCase();
    if (text.includes("select the option that is related to the third number") || pq.subj !== "Polity") {
      hasLeak = true;
      console.log(`  LEAK DETECTED: QID ${pq.id} (${pq.subj}): ${text.slice(0, 60)}`);
    }
  }
  if (!hasLeak) console.log("  SUCCESS: Zero reasoning questions leaked into Polity Subtopic 3492!");

  // 8. Questions per subject
  const subCounts = await pool.query(`
    SELECT s.id, s.name, count(q.id) as count
    FROM subjects s
    LEFT JOIN questions q ON q.subject_id = s.id
    GROUP BY s.id, s.name
    ORDER BY s.id;
  `);
  console.log("\n8. Final Questions Per Subject:");
  console.table(subCounts.rows);

  await pool.end();
}

verify().catch(console.error);
