import fs from 'fs';
import readline from 'readline';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';

const CANONICAL_SUBJECTS = {
  1: 'General Intelligence & Reasoning',
  2: 'Quantitative Aptitude',
  3: 'English Language',
  4: 'History',
  5: 'Polity',
  6: 'Geography',
  7: 'Economy',
  8: 'Physics',
  9: 'Chemistry',
  10: 'Biology',
  11: 'Static GK',
  12: 'Current Affairs',
  13: 'Computer Knowledge',
  18: 'Statistics',
  19: 'Finance & Economics'
};

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const chapRes = await pool.query('SELECT id, subject_id FROM subject_chapters');
  await pool.end();

  const chapterToSubject = new Map(chapRes.rows.map(r => [r.id, r.subject_id]));

  const rl = readline.createInterface({
    input: fs.createReadStream('scripts/out/classified-questions.jsonl'),
    crlfDelay: Infinity
  });

  const stats = {};
  for (const id of Object.keys(CANONICAL_SUBJECTS)) {
    stats[id] = {
      id: Number(id),
      name: CANONICAL_SUBJECTS[id],
      jsonl_actual_subject: 0,
      jsonl_raw_predicted: 0,
      jsonl_high_conf_predicted: 0,
      chapter_parent_subject: 0,
      effective_for_db_update: 0
    };
  }

  for await (const line of rl) {
    if (!line.trim()) continue;
    const q = JSON.parse(line);

    const actId = q.actual_subject_id;
    const predId = q.predicted_subject?.id;
    const conf = q.subject_confidence || 0;

    if (stats[actId]) stats[actId].jsonl_actual_subject++;
    if (stats[predId]) stats[predId].jsonl_raw_predicted++;

    if (conf >= 0.6 && stats[predId]) {
      stats[predId].jsonl_high_conf_predicted++;
    }

    // Check parent subject of predicted chapter
    const predChapId = q.predicted_chapter?.id;
    const chapParentSubj = chapterToSubject.get(predChapId);
    if (chapParentSubj && stats[chapParentSubj]) {
      stats[chapParentSubj].chapter_parent_subject++;
    }

    // Effective subject for DB
    const effectiveSubjId = (conf >= 0.6 && predId) ? predId : actId;
    if (stats[effectiveSubjId]) {
      stats[effectiveSubjId].effective_for_db_update++;
    }
  }

  console.log('=== FULL ANALYSIS OF CLASSIFIED-QUESTIONS.JSONL ===');
  const rows = Object.values(stats)
    .filter(s => s.jsonl_actual_subject > 0 || s.jsonl_raw_predicted > 0)
    .sort((a, b) => b.effective_for_db_update - a.effective_for_db_update);

  console.table(rows);
}

main();
