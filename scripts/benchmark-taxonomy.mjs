import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TaxonomyClassifier } from '../apps/backend/src/services/taxonomyClassifier.service.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse CLI args
const args = process.argv.slice(2);
let subjectId = 4; // Default to History (has 39 chapters, ~1,491 questions)
let limit = 50;   // Default sample size

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--subject' && args[i + 1]) {
    subjectId = parseInt(args[i + 1], 10);
  }
  if (args[i] === '--limit' && args[i + 1]) {
    limit = parseInt(args[i + 1], 10);
  }
}

async function runBenchmark() {
  console.log(`=== TAXONOMY CLASSIFIER BENCHMARK (classifier.dev) ===`);
  console.log(`Target Subject ID: ${subjectId}, Sample Limit: ${limit}\n`);

  const taxonomyPath = path.join(__dirname, 'full-taxonomy.json');
  if (!fs.existsSync(taxonomyPath)) {
    console.error(`Missing full-taxonomy.json! Run scripts/build-taxonomy-map.mjs first.`);
    process.exit(1);
  }

  const taxonomyData = JSON.parse(fs.readFileSync(taxonomyPath, 'utf-8'));
  const classifier = new TaxonomyClassifier(taxonomyData);

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_READ_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const subjectRes = await pool.query(`SELECT id, name FROM subjects WHERE id = $1;`, [subjectId]);
    const subjectName = subjectRes.rows[0]?.name || `Subject ${subjectId}`;
    console.log(`Subject: "${subjectName}"`);

    // Fetch sample questions that already have chapter_id & topic_id to benchmark against
    const questionsRes = await pool.query(
      `
      SELECT id, subject_id, chapter_id, topic_id, subtopic_id, question_text
      FROM questions
      WHERE subject_id = $1 
        AND chapter_id IS NOT NULL 
        AND question_text IS NOT NULL 
        AND length(trim(question_text)) > 10
      ORDER BY id DESC
      LIMIT $2;
    `,
      [subjectId, limit]
    );

    const questions = questionsRes.rows;
    console.log(`Fetched ${questions.length} benchmark questions from database.\n`);

    const startTime = Date.now();

    // Step 0: Classify Subject (Cross-Subject Validation)
    console.log(`[Step 0] Validating Subject assignment across all academic subjects...`);
    const subjectClassifications = await classifier.classifySubjects(questions);

    let subjectMatches = 0;
    const crossSubjectAnomalies = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const sc = subjectClassifications[i];
      if (sc.predicted_subject && sc.predicted_subject.id === q.subject_id) {
        subjectMatches++;
      } else {
        crossSubjectAnomalies.push({
          question_id: q.id,
          snippet: q.question_text.replace(/<[^>]+>/g, ' ').slice(0, 100).trim(),
          current_subject: subjectName,
          detected_subject: sc.predicted_subject?.name,
          confidence: sc.subject_confidence
        });
      }
    }

    // Step 1-3: Hierarchical Chapter, Topic, Subtopic classification
    const results = await classifier.classifyQuestionsForSubject(subjectId, questions);
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

    // Compute metrics
    let chapterMatches = 0;
    let topicMatches = 0;
    let subtopicMatches = 0;
    let highConfCount = 0;
    let totalEvaluated = results.length;

    const discrepancies = [];

    for (const r of results) {
      const chMatch = r.predicted_chapter && r.predicted_chapter.id === r.actual.chapter_id;
      const topMatch = r.predicted_topic && r.predicted_topic.id === r.actual.topic_id;
      const subMatch = r.predicted_subtopic && r.predicted_subtopic.id === r.actual.subtopic_id;

      if (chMatch) chapterMatches++;
      if (topMatch) topicMatches++;
      if (subMatch) subtopicMatches++;

      if (r.chapter_confidence >= 0.7) highConfCount++;

      if (!chMatch || !topMatch) {
        discrepancies.push({
          question_id: r.question_id,
          snippet: r.question_text.slice(0, 120),
          actual: {
            chapter_id: r.actual.chapter_id,
            topic_id: r.actual.topic_id
          },
          predicted: {
            chapter: r.predicted_chapter?.title,
            chapter_confidence: r.chapter_confidence,
            topic: r.predicted_topic?.name,
            topic_confidence: r.topic_confidence
          }
        });
      }
    }

    const subjMatchRate = ((subjectMatches / totalEvaluated) * 100).toFixed(1);
    const chMatchRate = ((chapterMatches / totalEvaluated) * 100).toFixed(1);
    const topMatchRate = ((topicMatches / totalEvaluated) * 100).toFixed(1);

    console.log(`\n================ BENCHMARK RESULTS ================`);
    console.log(`Processed:           ${totalEvaluated} questions in ${durationSec}s`);
    console.log(`Subject Match Rate:  ${subjectMatches}/${totalEvaluated} (${subjMatchRate}%)`);
    console.log(`Chapter Match Rate:  ${chapterMatches}/${totalEvaluated} (${chMatchRate}%)`);
    console.log(`Topic Match Rate:    ${topicMatches}/${totalEvaluated} (${topMatchRate}%)`);
    console.log(`High Confidence (>=0.7): ${highConfCount}/${totalEvaluated} (${((highConfCount / totalEvaluated) * 100).toFixed(1)}%)`);
    console.log(`Cross-Subject Anomalies: ${crossSubjectAnomalies.length}`);
    console.log(`Chapter/Topic Discrepancies: ${discrepancies.length}`);

    if (crossSubjectAnomalies.length > 0) {
      console.log(`\n--- Cross-Subject Anomalies (first 3) ---`);
      console.log(JSON.stringify(crossSubjectAnomalies.slice(0, 3), null, 2));
    }

    if (discrepancies.length > 0) {
      console.log(`\n--- Sample Chapter/Topic Discrepancies (first 3) ---`);
      console.log(JSON.stringify(discrepancies.slice(0, 3), null, 2));
    }

    // Write full report
    const reportFile = path.join(__dirname, 'taxonomy-classifier-benchmark-report.json');
    fs.writeFileSync(
      reportFile,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          subject: { id: subjectId, name: subjectName },
          metrics: {
            total: totalEvaluated,
            durationSec: parseFloat(durationSec),
            subjectMatchRate: `${subjMatchRate}%`,
            chapterMatchRate: `${chMatchRate}%`,
            topicMatchRate: `${topMatchRate}%`,
            highConfidenceRate: `${((highConfCount / totalEvaluated) * 100).toFixed(1)}%`
          },
          crossSubjectAnomalies,
          discrepancies,
          resultsSummary: results.slice(0, 10)
        },
        null,
        2
      )
    );
    console.log(`\nFull benchmark report saved to: scripts/taxonomy-classifier-benchmark-report.json`);
  } catch (err) {
    console.error('Benchmark failed:', err);
  } finally {
    await pool.end();
  }
}

runBenchmark();
