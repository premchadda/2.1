import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonlPath = path.join(__dirname, 'out', 'classified-questions.jsonl');

async function main() {
  console.log('Connecting to PostgreSQL to fetch DB-wise test and question stats...');
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  // 1. Live DB-wise query: reasoning questions per test
  const dbTestQuery = await pool.query(`
    SELECT 
      COALESCE(q.test_id, 0) AS test_id,
      COALESCE(t.title, 'Standalone / Untethered Questions') AS test_title,
      COUNT(q.id)::int AS db_reasoning_count
    FROM questions q
    LEFT JOIN tests t ON t.id = q.test_id
    WHERE q.subject_id = 1
    GROUP BY q.test_id, t.title
    ORDER BY db_reasoning_count DESC
  `);

  // Total DB questions where subject_id = 1
  const dbTotalRes = await pool.query(`
    SELECT COUNT(*)::int AS total_db_reasoning FROM questions WHERE subject_id = 1
  `);

  // Total tests in DB with reasoning
  const testsWithReasoningCount = dbTestQuery.rows.filter(r => r.test_id > 0).length;

  // Also fetch question_id -> test_id mapping for all questions
  const qMapRes = await pool.query(`
    SELECT q.id, COALESCE(q.test_id, 0) AS test_id, COALESCE(t.title, 'Standalone / Untethered Questions') AS test_title
    FROM questions q
    LEFT JOIN tests t ON t.id = q.test_id
  `);
  await pool.end();

  const questionToTest = new Map();
  qMapRes.rows.forEach(r => questionToTest.set(r.id, { test_id: r.test_id, test_title: r.test_title }));

  console.log(`Live DB stats:`);
  console.log(`  - Total Reasoning Questions in DB: ${dbTotalRes.rows[0].total_db_reasoning}`);
  console.log(`  - Number of Distinct Tests with Reasoning: ${testsWithReasoningCount}`);

  // 2. JSONL file-wise analysis
  console.log('\nReading classified-questions.jsonl for file-wise comparison...');
  const rl = readline.createInterface({
    input: fs.createReadStream(jsonlPath),
    crlfDelay: Infinity
  });

  let jsonlActualReasoningTotal = 0;
  let jsonlEffectiveReasoningTotal = 0;

  // Map of test_id -> { test_title, db_count, jsonl_actual, jsonl_effective, moved_out, moved_in }
  const testComparison = new Map();

  // Initialize with DB tests
  dbTestQuery.rows.forEach(r => {
    testComparison.set(r.test_id, {
      test_id: r.test_id,
      test_title: r.test_title,
      db_count: r.db_reasoning_count,
      jsonl_actual: 0,
      jsonl_effective: 0,
      moved_out: 0,
      moved_in: 0
    });
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    const q = JSON.parse(line);

    const testInfo = questionToTest.get(q.question_id) || { test_id: 0, test_title: 'Unknown' };
    const testId = testInfo.test_id;

    if (!testComparison.has(testId)) {
      testComparison.set(testId, {
        test_id: testId,
        test_title: testInfo.test_title,
        db_count: 0,
        jsonl_actual: 0,
        jsonl_effective: 0,
        moved_out: 0,
        moved_in: 0
      });
    }

    const tObj = testComparison.get(testId);

    const isActualReasoning = (q.actual_subject_id === 1);
    if (isActualReasoning) {
      jsonlActualReasoningTotal++;
      tObj.jsonl_actual++;
    }

    // Effective reasoning rule:
    // If high confidence (>=0.6) predicted subject exists, use that. Else keep actual.
    const effectiveSubjId = (q.subject_confidence >= 0.6 && q.predicted_subject?.id)
      ? q.predicted_subject.id
      : q.actual_subject_id;

    const isEffectiveReasoning = (effectiveSubjId === 1);

    if (isEffectiveReasoning) {
      jsonlEffectiveReasoningTotal++;
      tObj.jsonl_effective++;
    }

    if (isActualReasoning && !isEffectiveReasoning) {
      tObj.moved_out++;
    } else if (!isActualReasoning && isEffectiveReasoning) {
      tObj.moved_in++;
    }
  }

  const sortedTests = Array.from(testComparison.values()).sort((a, b) => b.db_count - a.db_count);

  console.log('\n========================================================================================');
  console.log('📊 REASONING QUESTIONS: DB-WISE VS CLASSIFIED-JSONL SUMMARY');
  console.log('========================================================================================');
  console.log(`1. Total Reasoning Questions in Live DB:            ${dbTotalRes.rows[0].total_db_reasoning}`);
  console.log(`2. Total Reasoning Questions in JSONL (Actual):     ${jsonlActualReasoningTotal}`);
  console.log(`3. Total Reasoning Questions in JSONL (Effective):  ${jsonlEffectiveReasoningTotal}`);
  console.log(`4. Net Change Across Whole Database:               ${jsonlEffectiveReasoningTotal - dbTotalRes.rows[0].total_db_reasoning}`);
  console.log(`5. Number of Tests Containing Reasoning Questions:  ${testsWithReasoningCount}`);
  console.log('========================================================================================\n');

  // Distribution by questions per test
  const distribution = {};
  sortedTests.filter(t => t.test_id > 0).forEach(t => {
    const bucket = `${t.db_count} Qs`;
    distribution[bucket] = (distribution[bucket] || 0) + 1;
  });

  console.log('Distribution of Reasoning Questions per Test:');
  console.table(distribution);

  console.log('\nTop 25 Tests by Reasoning Question Count:');
  console.table(sortedTests.slice(0, 25).map(t => ({
    TestID: t.test_id,
    Title: t.test_title.length > 40 ? t.test_title.slice(0, 37) + '...' : t.test_title,
    DB_Count: t.db_count,
    JSONL_Effective: t.jsonl_effective,
    Net_Diff: t.jsonl_effective - t.db_count
  })));

  // Write full report
  fs.writeFileSync(
    path.join(__dirname, 'out', 'test-wise-reasoning-report.json'),
    JSON.stringify({
      summary: {
        total_db_reasoning: dbTotalRes.rows[0].total_db_reasoning,
        total_jsonl_actual: jsonlActualReasoningTotal,
        total_jsonl_effective: jsonlEffectiveReasoningTotal,
        net_change: jsonlEffectiveReasoningTotal - dbTotalRes.rows[0].total_db_reasoning,
        tests_count: testsWithReasoningCount
      },
      distribution,
      tests: sortedTests
    }, null, 2)
  );

  console.log('✓ Full test-wise report saved to scripts/out/test-wise-reasoning-report.json');
}

main();
