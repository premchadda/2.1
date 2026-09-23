/**
 * Bulk Taxonomy Classification Runner for Trstprep Questions
 * Runs hierarchical classification (Subject -> Chapter -> Topic -> Subtopic) via classifier.dev
 * Features: Checkpointing, resume capability, rate-limit backoff, and streaming JSONL persistence.
 */

import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { TaxonomyClassifier, sanitizeQuestionText } from '../apps/backend/src/services/taxonomyClassifier.service.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// CLI argument parsing
const args = process.argv.slice(2);
let totalLimit = 25000;
let batchSize = 50;
let targetSubjectId = null;
let resume = true;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit' && args[i + 1]) {
    totalLimit = parseInt(args[i + 1], 10);
  }
  if (args[i] === '--batch-size' && args[i + 1]) {
    batchSize = parseInt(args[i + 1], 10);
  }
  if (args[i] === '--subject' && args[i + 1]) {
    targetSubjectId = parseInt(args[i + 1], 10);
  }
  if (args[i] === '--no-resume') {
    resume = false;
  }
}

const outDir = path.join(__dirname, 'out');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const progressFile = path.join(outDir, 'classified-questions.jsonl');
const summaryFile = path.join(outDir, 'taxonomy-run-summary.json');

// Read already processed IDs if resuming
async function loadProcessedIds() {
  const processed = new Set();
  if (!resume || !fs.existsSync(progressFile)) return processed;

  const fileStream = fs.createReadStream(progressFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.trim()) {
      try {
        const obj = JSON.parse(line);
        if (obj.question_id) processed.add(obj.question_id);
      } catch (_) {}
    }
  }
  return processed;
}

async function main() {
  console.log(`========================================================`);
  console.log(`🚀 TRSTPREP BULK TAXONOMY CLASSIFICATION`);
  console.log(`   Target Goal: Up to ${totalLimit} questions`);
  console.log(`   Batch Size: ${batchSize} questions per cycle`);
  if (targetSubjectId) console.log(`   Filtered to Subject ID: ${targetSubjectId}`);
  console.log(`========================================================\n`);

  // Load taxonomy dictionary
  const taxonomyPath = path.join(__dirname, 'full-taxonomy.json');
  if (!fs.existsSync(taxonomyPath)) {
    console.error(`Error: full-taxonomy.json not found! Run scripts/build-taxonomy-map.mjs first.`);
    process.exit(1);
  }
  const taxonomyData = JSON.parse(fs.readFileSync(taxonomyPath, 'utf-8'));
  const classifier = new TaxonomyClassifier(taxonomyData);

  const processedIds = await loadProcessedIds();
  console.log(`[Checkpoint] Found ${processedIds.size} already processed questions in ${path.basename(progressFile)}.`);

  const remainingToProcess = totalLimit - processedIds.size;
  if (remainingToProcess <= 0) {
    console.log(`Target goal of ${totalLimit} questions already reached! Exiting.`);
    return;
  }

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_READ_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Fetch target questions
    console.log(`Querying questions from PostgreSQL database...`);
    let query = `
      SELECT id, subject_id, chapter_id, topic_id, subtopic_id, question_text
      FROM questions
      WHERE question_text IS NOT NULL 
        AND length(trim(question_text)) > 10
    `;
    const params = [];
    if (targetSubjectId) {
      params.push(targetSubjectId);
      query += ` AND subject_id = $${params.length}`;
    }
    query += ` ORDER BY id ASC LIMIT $${params.length + 1};`;
    params.push(totalLimit * 2); // Fetch extra buffer so we can skip processed

    const dbRes = await pool.query(query, params);
    const candidateQuestions = dbRes.rows.filter(q => !processedIds.has(q.id)).slice(0, remainingToProcess);

    console.log(`Fetched ${candidateQuestions.length} pending questions to process.\n`);

    if (candidateQuestions.length === 0) {
      console.log(`No pending questions found matching criteria.`);
      return;
    }

    // Open append stream for results
    const outStream = fs.createWriteStream(progressFile, { flags: 'a' });

    let totalSuccess = processedIds.size;
    let crossSubjectCount = 0;
    let highConfCount = 0;
    const startTime = Date.now();

    for (let i = 0; i < candidateQuestions.length; i += batchSize) {
      const batch = candidateQuestions.slice(i, i + batchSize);
      console.log(`\n[Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(candidateQuestions.length / batchSize)}] Processing ${batch.length} questions (IDs: ${batch[0].id} - ${batch[batch.length - 1].id})...`);

      try {
        // Step 0: Subject Validation
        const subjectResults = await classifier.classifySubjects(batch);

        // Group questions by their validated subject
        const questionsBySubject = new Map();
        for (let j = 0; j < batch.length; j++) {
          const q = batch[j];
          const sr = subjectResults[j];
          const assignedSubjectId = (sr.predicted_subject && sr.subject_confidence >= 0.6) 
            ? sr.predicted_subject.id 
            : q.subject_id;

          if (sr.predicted_subject && sr.predicted_subject.id !== q.subject_id) {
            crossSubjectCount++;
          }

          if (!questionsBySubject.has(assignedSubjectId)) {
            questionsBySubject.set(assignedSubjectId, []);
          }
          questionsBySubject.get(assignedSubjectId).push({
            ...q,
            predicted_subject: sr.predicted_subject,
            subject_confidence: sr.subject_confidence
          });
        }

        // Step 1-3: Hierarchical Chapter, Topic, Subtopic per Subject
        for (const [subjId, subjQuestions] of questionsBySubject.entries()) {
          const hierarchicalResults = await classifier.classifyQuestionsForSubject(subjId, subjQuestions);

          for (const res of hierarchicalResults) {
            if (res.chapter_confidence >= 0.7) highConfCount++;

            const outputRecord = {
              question_id: res.question_id,
              actual_subject_id: res.actual.subject_id || subjQuestions.find(q => q.id === res.question_id)?.subject_id,
              actual_chapter_id: res.actual.chapter_id,
              actual_topic_id: res.actual.topic_id,
              actual_subtopic_id: res.actual.subtopic_id,
              predicted_subject: subjQuestions.find(q => q.id === res.question_id)?.predicted_subject,
              subject_confidence: subjQuestions.find(q => q.id === res.question_id)?.subject_confidence,
              predicted_chapter: res.predicted_chapter,
              chapter_confidence: res.chapter_confidence,
              predicted_topic: res.predicted_topic,
              topic_confidence: res.topic_confidence,
              predicted_subtopic: res.predicted_subtopic,
              subtopic_confidence: res.subtopic_confidence,
              processed_at: new Date().toISOString()
            };

            outStream.write(JSON.stringify(outputRecord) + '\n');
            totalSuccess++;
          }
        }

        console.log(`  ✓ Batch completed. Total classified so far: ${totalSuccess}/${totalLimit}`);

        // Write live summary stats
        const currentSummary = {
          last_updated: new Date().toISOString(),
          total_classified: totalSuccess,
          cross_subject_anomalies: crossSubjectCount,
          high_confidence_count: highConfCount,
          elapsed_sec: ((Date.now() - startTime) / 1000).toFixed(1)
        };
        fs.writeFileSync(summaryFile, JSON.stringify(currentSummary, null, 2));

      } catch (err) {
        console.error(`\n[Batch Error] Encountered error: ${err.message}`);
        if (err.message.includes('429') || err.message.includes('quota') || err.message.includes('rate limit')) {
          console.warn(`\n⚠️ classifier.dev Rate Limit reached. Safely stopping batch run.`);
          console.warn(`Progress is saved in ${progressFile}. Resume anytime by running the script again.`);
          break;
        } else {
          console.warn(`Skipping failed batch and continuing...`);
        }
      }
    }

    outStream.end();
    console.log(`\n========================================================`);
    console.log(`🎉 RUN COMPLETE / PAUSED`);
    console.log(`   Total Classified: ${totalSuccess}`);
    console.log(`   Cross-Subject Anomalies: ${crossSubjectCount}`);
    console.log(`   Output Saved To: ${progressFile}`);
    console.log(`   Summary Saved To: ${summaryFile}`);
    console.log(`========================================================\n`);

  } catch (err) {
    console.error('Fatal execution error:', err);
  } finally {
    await pool.end();
  }
}

main();
