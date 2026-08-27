import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const envPath = path.join(rootDir, 'apps', 'backend', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.substring(0, eqIdx).trim();
        let val = trimmed.substring(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    console.log('--- STARTING 4-POINT COMPREHENSIVE QUESTION AUDIT (45,178 QUESTIONS) ---\n');

    // ==========================================
    // 1. BILINGUAL CHECK (ENGLISH + HINDI)
    // ==========================================
    console.log('================================================================');
    console.log('1. BILINGUAL AUDIT');
    console.log('================================================================');

    const bilingualStats = await client.query(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN LOWER(COALESCE(section, '')) ILIKE '%english%' THEN 1 END)::int as english_section_count,
        COUNT(CASE WHEN LOWER(COALESCE(section, '')) NOT ILIKE '%english%' THEN 1 END)::int as non_english_section_count,
        COUNT(CASE WHEN question_text_hi IS NOT NULL AND TRIM(question_text_hi) != '' THEN 1 END)::int as has_hindi_text,
        COUNT(CASE WHEN options_hi IS NOT NULL AND array_length(options_hi, 1) > 0 THEN 1 END)::int as has_hindi_options,
        COUNT(CASE WHEN LOWER(COALESCE(section, '')) NOT ILIKE '%english%' AND (question_text_hi IS NULL OR TRIM(question_text_hi) = '') THEN 1 END)::int as non_english_missing_hindi_text,
        COUNT(CASE WHEN LOWER(COALESCE(section, '')) NOT ILIKE '%english%' AND (options_hi IS NULL OR array_length(options_hi, 1) = 0) THEN 1 END)::int as non_english_missing_hindi_options
      FROM questions;
    `);
    console.log('Bilingual Statistics:', JSON.stringify(bilingualStats.rows[0], null, 2));

    // Find which tests have non-English questions missing Hindi
    const missingHindiByTest = await client.query(`
      SELECT 
        t.id as test_id,
        t.title as test_title,
        COUNT(q.id)::int as missing_hindi_count
      FROM questions q
      JOIN tests t ON q.test_id = t.id
      WHERE LOWER(COALESCE(q.section, '')) NOT ILIKE '%english%'
        AND (q.question_text_hi IS NULL OR TRIM(q.question_text_hi) = '')
      GROUP BY t.id, t.title
      ORDER BY missing_hindi_count DESC, t.id ASC;
    `);
    console.log(`\nTests with missing Hindi in Non-English sections (${missingHindiByTest.rows.length} tests affected):`);
    missingHindiByTest.rows.forEach(r => console.log(`  - [Test ID: ${r.test_id}] "${r.test_title}": ${r.missing_hindi_count} questions missing Hindi`));

    // Language column values
    const langCol = await client.query(`
      SELECT COALESCE(language, 'NULL/Unset') as lang, COUNT(*)::int as count 
      FROM questions GROUP BY lang ORDER BY count DESC;
    `);
    console.log('\nLanguage column breakdown:', JSON.stringify(langCol.rows, null, 2));

    // ==========================================
    // 2. OPTIONS AUDIT
    // ==========================================
    console.log('\n================================================================');
    console.log('2. OPTIONS AUDIT');
    console.log('================================================================');

    const optionsStats = await client.query(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN options IS NULL THEN 1 END)::int as null_options,
        COUNT(CASE WHEN options IS NOT NULL AND array_length(options, 1) = 0 THEN 1 END)::int as empty_options_array,
        COUNT(CASE WHEN options IS NOT NULL AND array_length(options, 1) < 4 THEN 1 END)::int as less_than_4_options,
        COUNT(CASE WHEN options IS NOT NULL AND array_length(options, 1) = 4 THEN 1 END)::int as exact_4_options,
        COUNT(CASE WHEN options IS NOT NULL AND array_length(options, 1) > 4 THEN 1 END)::int as more_than_4_options,
        COUNT(CASE WHEN options_hi IS NOT NULL AND array_length(options_hi, 1) != array_length(options, 1) THEN 1 END)::int as options_length_mismatch_with_hindi
      FROM questions;
    `);
    console.log('Options Statistics:', JSON.stringify(optionsStats.rows[0], null, 2));

    // Check for blank/empty strings inside options array
    const blankOptionRows = await client.query(`
      SELECT id, test_id, question_number, options 
      FROM questions 
      WHERE options IS NULL 
         OR array_length(options, 1) < 4
         OR '' = ANY(options)
      LIMIT 10;
    `);
    console.log('Sample invalid options count:', blankOptionRows.rows.length);

    // ==========================================
    // 3. CORRECT ANSWER & EXPLANATIONS AUDIT
    // ==========================================
    console.log('\n================================================================');
    console.log('3. CORRECT ANSWER & EXPLANATIONS AUDIT');
    console.log('================================================================');

    const answerStats = await client.query(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN correct_option IS NULL AND correct_answer IS NULL THEN 1 END)::int as missing_correct_option,
        COUNT(CASE WHEN correct_option IS NOT NULL AND (correct_option < 0 OR correct_option > 4) THEN 1 END)::int as invalid_correct_option_range,
        COUNT(CASE WHEN explanation IS NOT NULL AND TRIM(explanation) != '' THEN 1 END)::int as has_english_explanation,
        COUNT(CASE WHEN explanation IS NULL OR TRIM(explanation) = '' THEN 1 END)::int as missing_english_explanation,
        COUNT(CASE WHEN explanation_hi IS NOT NULL AND TRIM(explanation_hi) != '' THEN 1 END)::int as has_hindi_explanation,
        COUNT(CASE WHEN explanation_hi IS NULL OR TRIM(explanation_hi) = '' THEN 1 END)::int as missing_hindi_explanation,
        COUNT(CASE WHEN (explanation IS NOT NULL AND TRIM(explanation) != '') AND (explanation_hi IS NOT NULL AND TRIM(explanation_hi) != '') THEN 1 END)::int as bilingual_explanation_count
      FROM questions;
    `);
    console.log('Answer & Explanation Statistics:', JSON.stringify(answerStats.rows[0], null, 2));

    // Distribution of correct_option index
    const correctOptDist = await client.query(`
      SELECT correct_option, COUNT(*)::int as count 
      FROM questions GROUP BY correct_option ORDER BY correct_option;
    `);
    console.log('Correct Option Distribution (0-indexed 0,1,2,3 or 1,2,3,4):', JSON.stringify(correctOptDist.rows, null, 2));

    // ==========================================
    // 4. TAXONOMY HIERARCHY LINKING AUDIT
    // ==========================================
    console.log('\n================================================================');
    console.log('4. TAXONOMY HIERARCHY LINKING (SUBJECT -> CHAPTER -> TOPIC -> SUBTOPIC)');
    console.log('================================================================');

    const taxStats = await client.query(`
      SELECT 
        COUNT(*)::int as total,
        -- Subject linking
        COUNT(CASE WHEN subject_id IS NOT NULL THEN 1 END)::int as has_subject_id,
        COUNT(CASE WHEN subject IS NOT NULL THEN 1 END)::int as has_subject_legacy,
        COUNT(CASE WHEN section_id IS NOT NULL THEN 1 END)::int as has_section_id,
        COUNT(CASE WHEN section IS NOT NULL AND TRIM(section) != '' THEN 1 END)::int as has_section_text,
        -- Chapter linking
        COUNT(CASE WHEN chapter_id IS NOT NULL THEN 1 END)::int as has_chapter_id,
        COUNT(CASE WHEN chapter IS NOT NULL AND TRIM(chapter) != '' THEN 1 END)::int as has_chapter_text,
        -- Topic linking
        COUNT(CASE WHEN topic_id IS NOT NULL THEN 1 END)::int as has_topic_id,
        COUNT(CASE WHEN topic IS NOT NULL AND TRIM(topic) != '' THEN 1 END)::int as has_topic_text,
        -- Subtopic linking
        COUNT(CASE WHEN subtopic_id IS NOT NULL THEN 1 END)::int as has_subtopic_id,
        -- Concept & Skill linking
        COUNT(CASE WHEN concept_ids IS NOT NULL AND array_length(concept_ids, 1) > 0 THEN 1 END)::int as has_concept_ids
      FROM questions;
    `);
    console.log('Taxonomy Coverage Statistics:', JSON.stringify(taxStats.rows[0], null, 2));

    // Check count in subject_chapters, subject_topics, subject_subtopics
    const subTaxCounts = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM subjects) as total_subjects,
        (SELECT COUNT(*) FROM subject_units) as total_units,
        (SELECT COUNT(*) FROM subject_chapters) as total_chapters,
        (SELECT COUNT(*) FROM subject_topics) as total_topics,
        (SELECT COUNT(*) FROM subject_subtopics) as total_subtopics;
    `);
    console.log('Dedicated Taxonomy Table Rows:', JSON.stringify(subTaxCounts.rows[0], null, 2));

    console.log('\n--- AUDIT COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    console.error('Audit failed:', err);
  } finally {
    await client.end();
  }
})();
