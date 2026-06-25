import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import pg from 'pg';

const { Pool } = pg;

// Load env vars
dotenv.config();

// Determine paths for the mock JSON file
let jsonFilePath = 'SSC_CGL_Tier_I_2026_Free_Mock_Test.json';
if (!fs.existsSync(jsonFilePath)) {
  jsonFilePath = path.join('..', jsonFilePath);
}
if (!fs.existsSync(jsonFilePath)) {
  jsonFilePath = path.join('..', jsonFilePath);
}

if (!fs.existsSync(jsonFilePath)) {
  console.error(`Error: Could not find ${jsonFilePath}`);
  process.exit(1);
}

console.log(`Reading input JSON file from: ${path.resolve(jsonFilePath)}`);
const json = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : { rejectUnauthorized: false }
});

const TABLE_CONFIG = {
  exam_categories: { findCols: ["category_id", "slug", "label"], nameCol: "label" },
  exams:           { findCols: ["slug", "title"],                 nameCol: "title" },
  stages:          { findCols: ["slug", "name"],                  nameCol: "name" },
  test_categories: { findCols: ["slug", "name"],                  nameCol: "name" },
  test_series:     { findCols: ["slug", "title"],                 nameCol: "title" },
  subjects:        { findCols: ["slug", "name"],                  nameCol: "name" },
};

async function getTableColumns(client, table) {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
    [table]
  );
  return new Set(rows.map(r => r.column_name));
}

async function findSlug(client, table, slug) {
  if (!slug) return null;
  const cfg = TABLE_CONFIG[table] || { findCols: ["slug", "name"], nameCol: "name" };
  const existingCols = await getTableColumns(client, table);
  for (const col of cfg.findCols) {
    if (!existingCols.has(col)) continue;
    const { rows } = await client.query(`SELECT id FROM ${table} WHERE "${col}" = $1 LIMIT 1`, [slug]);
    if (rows[0]?.id) return rows[0].id;
  }
  // Fuzzy match
  const normalizedSlug = slug.replace(/[-_]/g, " ").toLowerCase().trim();
  for (const nameCol of ["title", "name", "label"]) {
    if (!existingCols.has(nameCol)) continue;
    const { rows } = await client.query(
      `SELECT id FROM ${table} WHERE LOWER(REPLACE(REPLACE("${nameCol}", '-', ' '), '_', ' ')) = $1 LIMIT 1`,
      [normalizedSlug]
    );
    if (rows[0]?.id) return rows[0].id;
  }
  return null;
}

async function main() {
  const client = await pool.connect();
  try {
    console.log("Resolving database relations...");

    // 1. Resolve examCategoryId
    const examCategoryId = await findSlug(client, "exam_categories", json.examCategoryId);
    console.log(`Resolved examCategoryId: ${json.examCategoryId} -> ${examCategoryId}`);

    // 2. Resolve examId
    // In database, exams.id might be numeric or slug. Let's find it.
    let examIdVal = null;
    if (json.examId) {
      const examRowId = await findSlug(client, "exams", json.examId);
      if (examRowId) {
        // If exams has id as numeric, we can query its slug/id representation
        const { rows } = await client.query(`SELECT slug FROM exams WHERE id = $1`, [examRowId]);
        examIdVal = rows[0]?.slug || String(json.examId);
      } else {
        examIdVal = String(json.examId);
      }
    }
    console.log(`Resolved examId: ${json.examId} -> ${examIdVal}`);

    // 3. Resolve stageId
    const STAGE_ALIASES = {
      "tier-1": "tier-1-pre",
      "tier-2": "tier-2-mains",
      "tier1": "tier-1-pre",
      "tier2": "tier-2-mains",
      "prelims": "tier-1-pre",
      "mains": "tier-2-mains",
    };
    const stageSlug = STAGE_ALIASES[json.stageId] || json.stageId;
    const stageId = await findSlug(client, "stages", stageSlug);
    console.log(`Resolved stageId: ${json.stageId} (alias: ${stageSlug}) -> ${stageId}`);

    // 4. Resolve testCategoryId (test_categories)
    let testCategoryId = await findSlug(client, "test_categories", json.categoryId);
    const subCatSlug = json.subCategoryId || json.subCategory;
    if (subCatSlug) {
      const resolvedSub = await findSlug(client, "test_categories", subCatSlug);
      if (resolvedSub) {
        testCategoryId = resolvedSub;
      }
    }
    console.log(`Resolved testCategoryId: ${subCatSlug || json.categoryId} -> ${testCategoryId}`);

    // 5. Resolve seriesId (test_series)
    const seriesId = await findSlug(client, "test_series", json.testSeriesId);
    console.log(`Resolved seriesId: ${json.testSeriesId} -> ${seriesId}`);

    // Create unique public ID UUID
    const testUUID = crypto.randomUUID();
    const testId = parseInt(json.id, 10) || 3323285;

    const dbTest = {
      id: testId,
      series_id: seriesId,
      slug: json.slug || "ssc-cgl-tier-i-2026---free-mock-test",
      title: json.title || "SSC CGL Tier I 2026 - Free Mock Test",
      category: json.examCategoryId || "ssc",
      sub_category: json.subCategory || "Full Mock Tests",
      type: json.testType || "full-length",
      total_questions: json.totalQuestions || 100,
      total_marks: json.totalMarks || 200,
      duration: json.duration || 60,
      passing_marks: json.passingMarks || 0,
      negative_marking: json.negativeMarking || 0.5,
      tags: json.tags || ["ssc-cgl", "tier-1", "mock-test"],
      is_live: json.isLive || false,
      live_schedule: json.liveSchedule || null,
      scheduled_at: json.scheduledAt || null,
      difficulty: json.difficulty || "medium",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      subject_id: null,
      is_pro: json.access?.type === 'paid' || false,
      stage_id: stageId,
      banner_asset_id: null,
      promotion_banner_asset_id: null,
      is_coming_soon: json.isComingSoon || false,
      public_id_uuid: testUUID,
      public_id: `tst_${testUUID}`,
      category_path_ids: [1, 21],
      category_path_names: ["Mock Tests", "Full Mock Tests"],
      languages: json.languages || ["en", "hi"],
      coming_soon_date: json.availability?.availableFrom || null,
      test_category_id: testCategoryId,
      exam_id: examIdVal,
      stage_ids: stageId ? [stageId] : [],
      section_id: null,
      status: "active",
      year: 2026,
      is_deleted: false,
      instructions: "Each question carries 2 marks.\n0.5 marks deducted for every wrong answer.\nNo deduction for unattempted questions.",
      test_type: json.testType || "full-length",
      start_time: null,
      end_time: null,
      shuffle_questions: json.shuffleQuestions || false,
      shuffle_options: json.shuffleOptions || true,
      allow_review: json.allowReview || true,
      max_attempts: json.attemptRules?.maxAttempts || 0,
      version: json.version || 1,
      attempt_count: 0,
      imported_from: "full-test-json",
      source_test_id: String(json.id || "3323285"),
      ai_explanation_enabled: true,
      short_title: json.shortTitle || "SSC CGL Tier I 2026 ",
      question_language_mode: json.questionLanguageMode || "bilingual",
      is_pyq: json.isPyq || false,
      pyq_year: json.pyqYear || null,
      show_config: {
        calculator: json.showCalculator ?? false,
        questionPalette: json.showQuestionPalette ?? true,
        sectionPalette: json.showSectionPalette ?? true,
        timer: json.showTimer ?? true,
        bookmark: json.allowBookmark ?? true,
        reportIssue: json.allowReportIssue ?? true
      },
      timing_config: json.timingConfig || {},
      optional_section_config: json.optionalSectionConfig || {},
      attempt_rules: json.attemptRules || {},
      analysis_config: json.analysisConfig || {},
      access_config: json.access || { type: "free" },
      availability: json.availability || {},
      is_featured: json.isFeatured || false,
      seo: json.seo || {},
      proctoring: {
        enabled: json.proctoringEnabled ?? false,
        cameraMonitoring: json.cameraMonitoring ?? false,
        tabSwitchLimit: json.tabSwitchLimit ?? 0,
        copyPasteDisabled: json.copyPasteDisabled ?? false
      },
      adaptive: {
        enabled: json.adaptiveTest ?? false,
        algorithm: json.adaptiveAlgorithm || null
      },
      features: {
        certificate: json.certificateEnabled ?? false,
        leaderboard: json.leaderboardEnabled ?? true
      }
    };

    const dbSections = [];
    const dbQuestions = [];
    let sectionCounter = 1;
    let questionCounter = 1;

    for (const section of json.sections || []) {
      const sectionId = sectionCounter++;
      const subjectId = await findSlug(client, "subjects", section.subjectId);
      console.log(`Resolved section subject: ${section.subjectId} -> ${subjectId}`);

      dbSections.push({
        id: sectionId,
        name: section.name || "Untitled Section",
        category_id: testCategoryId,
        description: section.description || null,
        duration: section.duration ? Math.round(section.duration / 60) : 60,
        time_limit: section.duration || 3600,
        passing_marks: 0,
        is_active: true,
        display_order: section.order || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        test_id: testId,
        marks_per_question: section.questions?.[0]?.marks || 2.0,
        negative_marks: section.questions?.[0]?.negativeMarks || 0.5,
        shuffle_questions: section.shuffleQuestions || false,
        shuffle_options: section.shuffleOptions || true,
        expected_questions: section.questionCount || 25,
        total_marks: section.maxMarks || 50.0,
        section_code: section.id || null,
        is_qualifying: section.qualifying || false,
        is_deleted: false,
        total_questions: section.questions?.length || 25,
        subject_id: subjectId,
        question_count: section.questions?.length || 25,
        negative_marking: section.negativeMarking || 0.5,
        mandatory: section.mandatory ?? true,
        optional: section.optional ?? false,
        qualifying: section.qualifying ?? false,
        allow_navigation: section.allowNavigation ?? true,
        is_locked: section.isLocked ?? false
      });

      for (const q of section.questions || []) {
        const qId = questionCounter++;
        const qUUID = crypto.randomUUID();

        // 1-indexed (JSON) to 0-indexed (DB)
        let correctOption = typeof q.correctAnswer === "number"
          ? q.correctAnswer - 1
          : (typeof q.correct_option_id === "number" ? q.correct_option_id : 0);

        dbQuestions.push({
          id: qId,
          test_id: testId,
          question_number: qId,
          question_text: q.text?.en || q.question || "",
          question_text_hi: q.text?.hn || q.question_text_hi || null,
          options: q.options_bilingual?.en || q.options || [],
          options_hi: q.options_bilingual?.hn || [],
          correct_option: correctOption,
          marks: q.marks || 2.0,
          negative_marks: q.negativeMarks || q.negative || 0.5,
          section: q.section || section.name || null,
          explanation: q.solution_bilingual?.en || q.solution || q.explanation || "",
          explanation_hi: q.solution_bilingual?.hn || null,
          difficulty: q.difficulty || "medium",
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          subject_id: subjectId,
          chapter_id: null,
          topic_id: null,
          subtopic_id: null,
          series_id: seriesId,
          category_id: String(json.categoryId || "mock-tests"),
          sub_category_id: String(subCatSlug || "full-mock-tests"),
          public_id_uuid: qUUID,
          public_id: `qst_${qUUID}`,
          type: q.questionType || "mcq",
          status: "active",
          tags: q.tags || [],
          is_deleted: false,
          external_question_id: String(q.id || ""),
          estimated_time: q.estimatedTime || null,
          source_config: q.source || {},
          exam_category_ids: q.examCategoryIds || [json.examCategoryId || "ssc"],
          exam_ids: q.examIds || [json.examId || "ssc-cgl"],
          question_stage_ids: q.stageIds || [stageSlug || "tier-1-pre"],
          concept_ids: q.conceptIds || [],
          skill_ids: q.skillIds || []
        });
      }
    }

    // Ensure output directories exist and write files
    const rootScratchDir = path.resolve('../../scratch');
    const localScratchDir = './scratch';

    for (const scratchDir of [rootScratchDir, localScratchDir]) {
      if (!fs.existsSync(scratchDir)) {
        fs.mkdirSync(scratchDir, { recursive: true });
      }
      fs.writeFileSync(path.join(scratchDir, 'db_tests.json'), JSON.stringify([dbTest], null, 2));
      fs.writeFileSync(path.join(scratchDir, 'db_test_sections.json'), JSON.stringify(dbSections, null, 2));
      fs.writeFileSync(path.join(scratchDir, 'db_questions.json'), JSON.stringify(dbQuestions, null, 2));
    }

    console.log("\nSuccessfully generated relational database-compatible JSON files:");
    console.log("- scratch/db_tests.json");
    console.log("- scratch/db_test_sections.json");
    console.log("- scratch/db_questions.json");

  } catch (error) {
    console.error("Conversion failed:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
