import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonlPath = path.join(__dirname, 'out', 'classified-questions.jsonl');

async function main() {
  console.log('[DB-Correction-Planner] Connecting to database to verify taxonomy nodes...');
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const [subjsRes, chapsRes, topsRes, subtopsRes] = await Promise.all([
    pool.query('SELECT id, name FROM subjects'),
    pool.query('SELECT id, subject_id, title FROM subject_chapters'),
    pool.query('SELECT id, chapter_id, name FROM subject_topics'),
    pool.query('SELECT id, topic_id, name FROM subject_subtopics')
  ]);

  await pool.end();

  const validSubjects = new Map(subjsRes.rows.map(r => [r.id, r]));
  const validChapters = new Map(chapsRes.rows.map(r => [r.id, r]));
  const validTopics = new Map(topsRes.rows.map(r => [r.id, r]));
  const validSubtopics = new Map(subtopsRes.rows.map(r => [r.id, r]));

  console.log(`[DB-Correction-Planner] Taxonomy baseline loaded:`);
  console.log(`  - Subjects: ${validSubjects.size}`);
  console.log(`  - Chapters: ${validChapters.size}`);
  console.log(`  - Topics: ${validTopics.size}`);
  console.log(`  - Subtopics: ${validSubtopics.size}`);

  const rl = readline.createInterface({
    input: fs.createReadStream(jsonlPath),
    crlfDelay: Infinity
  });

  let total = 0;
  const plan = {
    unchanged: [],
    backfills_nulls: [],
    high_conf_cross_subject: [],
    topic_chapter_refinements: [],
    low_conf_retained: []
  };

  for await (const line of rl) {
    if (!line.trim()) continue;
    total++;
    const q = JSON.parse(line);

    const actualSubj = q.actual_subject_id;
    const actualChap = q.actual_chapter_id;
    const actualTop = q.actual_topic_id;
    const actualSubtop = q.actual_subtopic_id;

    // Check if subject is changing with high confidence
    const predSubj = q.predicted_subject?.id;
    const subjConf = q.subject_confidence || 0;
    const isCrossSubjectChange = (subjConf >= 0.7 && predSubj && predSubj !== actualSubj && validSubjects.has(predSubj));

    const finalSubjId = isCrossSubjectChange ? predSubj : actualSubj;

    // Determine target chapter
    const predChap = q.predicted_chapter?.id;
    const validChap = (predChap && validChapters.has(predChap)) ? predChap : actualChap;

    // Determine target topic
    const predTop = q.predicted_topic?.id;
    const validTop = (predTop && validTopics.has(predTop)) ? predTop : actualTop;

    // Determine target subtopic
    const predSubtop = q.predicted_subtopic?.id;
    const validSubtop = (predSubtop && validSubtopics.has(predSubtop)) ? predSubtop : actualSubtop;

    const hasNullBackfill = (!actualChap && validChap) || (!actualTop && validTop) || (!actualSubtop && validSubtop);
    const hasTaxonomyChange = (finalSubjId !== actualSubj) || (validChap !== actualChap) || (validTop !== actualTop) || (validSubtop !== actualSubtop);

    const record = {
      question_id: q.question_id,
      from: {
        subject_id: actualSubj,
        chapter_id: actualChap,
        topic_id: actualTop,
        subtopic_id: actualSubtop
      },
      to: {
        subject_id: finalSubjId,
        chapter_id: validChap,
        topic_id: validTop,
        subtopic_id: validSubtop,
        chapter_name: validChapters.get(validChap)?.title || null
      }
    };

    if (!hasTaxonomyChange) {
      plan.unchanged.push(record.question_id);
    } else if (hasNullBackfill) {
      plan.backfills_nulls.push(record);
    } else if (isCrossSubjectChange) {
      plan.high_conf_cross_subject.push({
        ...record,
        confidence: subjConf,
        predicted_subject_name: q.predicted_subject?.name
      });
    } else if (validChap !== actualChap || validTop !== actualTop || validSubtop !== actualSubtop) {
      plan.topic_chapter_refinements.push(record);
    } else {
      plan.low_conf_retained.push(record.question_id);
    }
  }

  const summary = {
    generated_at: new Date().toISOString(),
    total_corpus_questions: total,
    categories: {
      unchanged_count: plan.unchanged.length,
      unchanged_percent: ((plan.unchanged.length / total) * 100).toFixed(1) + '%',
      backfills_null_count: plan.backfills_nulls.length,
      backfills_null_description: 'Questions where chapter_id, topic_id, or subtopic_id was NULL and is now populated',
      high_conf_cross_subject_count: plan.high_conf_cross_subject.length,
      high_conf_cross_subject_description: 'Questions misfiled in wrong subject with >=0.7 confidence',
      topic_chapter_refinements_count: plan.topic_chapter_refinements.length,
      topic_chapter_refinements_description: 'Questions updated to more precise NCERT/PYQ standard chapters & topics'
    }
  };

  console.log('========================================================');
  console.log('📊 DATABASE CORRECTION PLAN SUMMARY');
  console.log('========================================================');
  console.log(`Total Questions in Corpus: ${total}`);
  console.log(`  1. Unchanged (Already Accurate):           ${plan.unchanged.length} (${summary.categories.unchanged_percent})`);
  console.log(`  2. Missing Values Backfilled (NULL -> ID): ${plan.backfills_nulls.length}`);
  console.log(`  3. High-Confidence Cross-Subject Fixes:    ${plan.high_conf_cross_subject.length}`);
  console.log(`  4. Chapter & Topic Standardizations:       ${plan.topic_chapter_refinements.length}`);
  console.log('========================================================\n');

  // Write summary
  fs.writeFileSync(
    path.join(__dirname, 'out', 'db-correction-summary.json'),
    JSON.stringify(summary, null, 2)
  );

  // Write sample SQL preview (first 25 updates from each bucket)
  let sql = `-- Trstprep Database Taxonomy Correction Preview
-- Generated: ${new Date().toISOString()}
-- Total Planned Updates: ${plan.backfills_nulls.length + plan.high_conf_cross_subject.length + plan.topic_chapter_refinements.length} questions

BEGIN;

-- 1. NULL Backfills Sample (Total: ${plan.backfills_nulls.length})
`;

  plan.backfills_nulls.slice(0, 10).forEach(b => {
    sql += `UPDATE questions SET chapter_id = ${b.to.chapter_id || 'NULL'}, topic_id = ${b.to.topic_id || 'NULL'}, subtopic_id = ${b.to.subtopic_id || 'NULL'}, chapter = ${b.to.chapter_name ? `'${b.to.chapter_name.replace(/'/g, "''")}'` : 'NULL'} WHERE id = ${b.question_id};\n`;
  });

  sql += `\n-- 2. Cross-Subject Reallocations Sample (Total: ${plan.high_conf_cross_subject.length})\n`;
  plan.high_conf_cross_subject.slice(0, 10).forEach(b => {
    sql += `UPDATE questions SET subject_id = ${b.to.subject_id}, chapter_id = ${b.to.chapter_id || 'NULL'}, topic_id = ${b.to.topic_id || 'NULL'}, subtopic_id = ${b.to.subtopic_id || 'NULL'}, chapter = ${b.to.chapter_name ? `'${b.to.chapter_name.replace(/'/g, "''")}'` : 'NULL'} WHERE id = ${b.question_id}; -- Moved to ${b.predicted_subject_name}\n`;
  });

  sql += `\n-- 3. Topic & Chapter Refinements Sample (Total: ${plan.topic_chapter_refinements.length})\n`;
  plan.topic_chapter_refinements.slice(0, 10).forEach(b => {
    sql += `UPDATE questions SET chapter_id = ${b.to.chapter_id || 'NULL'}, topic_id = ${b.to.topic_id || 'NULL'}, subtopic_id = ${b.to.subtopic_id || 'NULL'}, chapter = ${b.to.chapter_name ? `'${b.to.chapter_name.replace(/'/g, "''")}'` : 'NULL'} WHERE id = ${b.question_id};\n`;
  });

  sql += `\nCOMMIT;\n`;

  fs.writeFileSync(path.join(__dirname, 'out', 'db-correction-sample.sql'), sql);
  console.log('✓ Saved summary to scripts/out/db-correction-summary.json');
  console.log('✓ Saved SQL preview to scripts/out/db-correction-sample.sql');
}

main();
