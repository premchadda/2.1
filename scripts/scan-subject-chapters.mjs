import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
import fs from 'fs';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log("=== SCANNING ALL CHAPTERS AND TOPICS PER SUBJECT ===");
  
  const subjects = await pool.query(`SELECT id, name, slug FROM subjects ORDER BY id;`);
  
  const taxonomySummary = [];
  for (const s of subjects.rows) {
    const chRes = await pool.query(`
      SELECT sc.id, sc.title, COUNT(st.id) as topic_count
      FROM subject_chapters sc
      LEFT JOIN subject_topics st ON st.chapter_id = sc.id AND (st.is_deleted IS NOT TRUE)
      WHERE sc.subject_id = $1 AND (sc.is_deleted IS NOT TRUE)
      GROUP BY sc.id, sc.title
      ORDER BY sc.id;
    `, [s.id]);

    const qCount = await pool.query(`
      SELECT COUNT(*) as count FROM questions WHERE subject_id = $1;
    `, [s.id]);

    taxonomySummary.push({
      subject_id: s.id,
      name: s.name,
      questions: Number(qCount.rows[0].count),
      chapters: chRes.rows.length,
      sample_chapters: chRes.rows.slice(0, 5).map(c => `[${c.id}] ${c.title} (${c.topic_count} topics)`)
    });
  }
  
  console.table(taxonomySummary.map(t => ({
    ID: t.subject_id,
    Subject: t.name,
    Questions: t.questions,
    Chapters: t.chapters,
    SampleChapters: t.sample_chapters.join('; ')
  })));

  await pool.end();
}

main().catch(console.error);
