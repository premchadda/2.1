import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

function cleanText(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

async function main() {
  const client = await pool.connect();
  await client.query("SET statement_timeout = '60s'");

  // Specifically check QID 3308 and QID 3336 and similar IDs
  const res = await client.query(`
    SELECT q.id, q.chapter_id, qc.title as chap_title, q.question_text
    FROM questions q
    JOIN subject_chapters qc ON q.chapter_id = qc.id
    WHERE q.subject_id = 4 AND (
      q.id IN (3308, 3336) OR
      q.question_text ILIKE '%equal to:%' OR
      q.question_text ILIKE '%from the top%' OR
      q.question_text ILIKE '%mean proportional%' OR
      q.question_text ILIKE '%continued proportion%'
    );
  `);

  console.log(`Found ${res.rows.length} candidates.`);
  for (const r of res.rows) {
    const text = cleanText(r.question_text).toLowerCase();
    console.log(`Candidate QID ${r.id}: ${text.slice(0, 70)}`);
    if (text.includes("equal to:") || text.includes("mean proportional") || text.includes("continued proportion")) {
      await client.query(`
        UPDATE questions
        SET subject_id = 2, chapter_id = 282, topic_id = 727, subtopic_id = 921, subject = 2, chapter = 'Chapter 3: Simplification (सरलीकरण)', topic = 'Topic 1: Simplification'
        WHERE id = $1;
      `, [r.id]);
      console.log(`  Updated QID ${r.id} to Quantitative Aptitude (Simplification)`);
    } else if (text.includes("from the top") || text.includes("from the bottom")) {
      await client.query(`
        UPDATE questions
        SET subject_id = 1, chapter_id = 567, topic_id = 758, subtopic_id = 952, subject = 1, chapter = 'Chapter 22: Ranking & Order', topic = 'Topic 1: Ranking & Order'
        WHERE id = $1;
      `, [r.id]);
      console.log(`  Updated QID ${r.id} to Reasoning (Ranking & Order)`);
    }
  }

  client.release();
  await pool.end();
}

main().catch(console.error);
