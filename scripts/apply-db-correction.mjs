/**
 * Trstprep Database Taxonomy Updater
 * Applies validated classifications from classified-questions.jsonl back to PostgreSQL.
 * Includes domain-aware reasoning guards and relational hierarchy validation.
 * 
 * Usage:
 *   node --dns-result-order=ipv4first scripts/apply-db-correction.mjs --dry-run
 *   node --dns-result-order=ipv4first scripts/apply-db-correction.mjs --apply --phase nulls
 *   node --dns-result-order=ipv4first scripts/apply-db-correction.mjs --apply --phase all
 */

import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonlPath = path.join(__dirname, 'out', 'classified-questions.jsonl');

const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const isDryRun = !isApply || args.includes('--dry-run');
const phaseIdx = args.indexOf('--phase');
const phase = phaseIdx !== -1 ? args[phaseIdx + 1] : 'all'; // 'nulls' | 'cross-subject' | 'all'

async function run() {
  console.log('========================================================');
  console.log(`🚀 TRSTPREP DATABASE TAXONOMY UPDATER`);
  console.log(`   Mode:  ${isDryRun ? '🔍 DRY RUN (Simulated, no DB writes)' : '⚡ LIVE APPLY (Writing to PostgreSQL)'}`);
  console.log(`   Phase: ${phase.toUpperCase()}`);
  console.log('========================================================\n');

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  // Verify foreign keys and parent hierarchy
  const [chapsRes, topsRes, subtopsRes] = await Promise.all([
    pool.query('SELECT id, subject_id, title FROM subject_chapters'),
    pool.query('SELECT id, chapter_id, name FROM subject_topics'),
    pool.query('SELECT id, topic_id, name FROM subject_subtopics')
  ]);

  const validChapters = new Map(chapsRes.rows.map(r => [r.id, { title: r.title, subject_id: r.subject_id }]));
  const validTopics = new Map(topsRes.rows.map(r => [r.id, { name: r.name, chapter_id: r.chapter_id }]));
  const validSubtopics = new Map(subtopsRes.rows.map(r => [r.id, { name: r.name, topic_id: r.topic_id }]));

  console.log(`Loaded taxonomy nodes:`);
  console.log(`  - Chapters: ${validChapters.size}`);
  console.log(`  - Topics: ${validTopics.size}`);
  console.log(`  - Subtopics: ${validSubtopics.size}\n`);

  const rl = readline.createInterface({
    input: fs.createReadStream(jsonlPath),
    crlfDelay: Infinity
  });

  let inspected = 0;
  let plannedUpdates = 0;
  let executedUpdates = 0;
  let reasoningProtectedCount = 0;
  let englishProtectedCount = 0;
  let hierarchyAdjustedCount = 0;
  let batch = [];
  const BATCH_SIZE = 250;

  async function flushBatch() {
    if (batch.length === 0) return;
    if (isApply) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const item of batch) {
          await client.query(
            `UPDATE questions 
             SET subject_id = $1, chapter_id = $2, topic_id = $3, subtopic_id = $4, chapter = $5
             WHERE id = $6`,
            [item.subject_id, item.chapter_id, item.topic_id, item.subtopic_id, item.chapter, item.id]
          );
        }
        await client.query('COMMIT');
        executedUpdates += batch.length;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`\n[Error] Batch failed: ${err.message}`);
        throw err;
      } finally {
        client.release();
      }
    } else {
      executedUpdates += batch.length;
    }
    batch = [];
    process.stdout.write(`\r  Progress: ${executedUpdates} updates ${isApply ? 'written' : 'queued'}...`);
  }

  for await (const line of rl) {
    if (!line.trim()) continue;
    inspected++;
    const q = JSON.parse(line);

    const actualSubj = q.actual_subject_id;
    const actualChap = q.actual_chapter_id;
    const actualTop = q.actual_topic_id;
    const actualSubtop = q.actual_subtopic_id;

    const predSubj = q.predicted_subject?.id;
    const subjConf = q.subject_confidence || 0;

    // Cross-subject check with Domain-Aware Reasoning Guards
    let isCrossSubject = (subjConf >= 0.7 && predSubj && predSubj !== actualSubj);

    // Guard 1: Reasoning -> Quant false moves (Mathematical Operations / BODMAS)
    if (actualSubj === 1 && predSubj === 2) {
      isCrossSubject = false;
      reasoningProtectedCount++;
    }

    // Guard 2: English -> Reasoning false moves (Cloze tests / Reading comprehension)
    if (actualSubj === 3 && predSubj === 1) {
      isCrossSubject = false;
      englishProtectedCount++;
    }

    let targetSubj = isCrossSubject ? predSubj : actualSubj;

    // Determine target chapter
    let targetChap = actualChap;
    if (q.predicted_chapter?.id && validChapters.has(q.predicted_chapter.id)) {
      const chapMeta = validChapters.get(q.predicted_chapter.id);
      // Strictly ensure the chapter belongs to the target subject!
      if (chapMeta.subject_id === targetSubj) {
        targetChap = q.predicted_chapter.id;
      } else {
        hierarchyAdjustedCount++;
      }
    }

    // Determine target topic
    let targetTop = actualTop;
    if (q.predicted_topic?.id && validTopics.has(q.predicted_topic.id)) {
      const topMeta = validTopics.get(q.predicted_topic.id);
      // Strictly ensure topic belongs to the target chapter!
      if (topMeta.chapter_id === targetChap) {
        targetTop = q.predicted_topic.id;
      } else {
        targetTop = null;
      }
    }

    // Determine target subtopic
    let targetSubtop = actualSubtop;
    if (q.predicted_subtopic?.id && validSubtopics.has(q.predicted_subtopic.id)) {
      const subtopMeta = validSubtopics.get(q.predicted_subtopic.id);
      // Strictly ensure subtopic belongs to the target topic!
      if (targetTop && subtopMeta.topic_id === targetTop) {
        targetSubtop = q.predicted_subtopic.id;
      } else {
        targetSubtop = null;
      }
    }

    const isNullBackfill = (!actualChap && targetChap) || (!actualTop && targetTop) || (!actualSubtop && targetSubtop);
    const hasChange = (targetSubj !== actualSubj) || (targetChap !== actualChap) || (targetTop !== actualTop) || (targetSubtop !== actualSubtop);

    if (!hasChange) continue;

    // Phase filtering
    if (phase === 'nulls' && !isNullBackfill) continue;
    if (phase === 'cross-subject' && !isCrossSubject) continue;

    plannedUpdates++;
    batch.push({
      id: q.question_id,
      subject_id: targetSubj,
      chapter_id: targetChap,
      topic_id: targetTop,
      subtopic_id: targetSubtop,
      chapter: validChapters.get(targetChap)?.title || null
    });

    if (batch.length >= BATCH_SIZE) {
      await flushBatch();
    }
  }

  await flushBatch();
  await pool.end();

  console.log('\n\n========================================================');
  console.log(`🎉 DB CORRECTION ${isDryRun ? 'DRY-RUN' : 'EXECUTION'} COMPLETE`);
  console.log(`   Total Questions Inspected:     ${inspected}`);
  console.log(`   Updates Qualified:             ${plannedUpdates}`);
  console.log(`   Reasoning Math Protected:      ${reasoningProtectedCount}`);
  console.log(`   English Cloze Protected:       ${englishProtectedCount}`);
  console.log(`   Cross-Subject Mismatch Fixed:  ${hierarchyAdjustedCount}`);
  console.log(`   Status:                        ${isDryRun ? 'SIMULATED (No changes made)' : 'APPLIED TO DATABASE'}`);
  console.log('========================================================\n');
}

run().catch(err => {
  console.error('\nExecution failed:', err);
  process.exit(1);
});
