import { pool } from "../../infrastructure/database/postgres-helpers.js";

// ─── Slug → ID resolution helpers (with upsert) ─────────────────────────────

// Table-specific: which column(s) to search for existing rows, and display name column
const TABLE_CONFIG = {
  exam_categories: { findCols: ["category_id", "slug", "label"], nameCol: "label", extraCols: ["is_active"] },
  exams:           { findCols: ["slug", "title"],                 nameCol: "title", extraCols: ["is_active"] },
  stages:          { findCols: ["slug", "name"],                  nameCol: "name",  extraCols: ["is_active"] },
  test_categories: { findCols: ["slug", "name"],                  nameCol: "name",  extraCols: ["is_deleted"] },
  test_series:     { findCols: ["slug", "title"],                 nameCol: "title", extraCols: ["is_active"] },
  subjects:        { findCols: ["slug", "name"],                  nameCol: "name",  extraCols: ["is_active"] },
  chapters:        { findCols: ["slug", "title"],                 nameCol: "title", extraCols: ["is_active"] },
  topics:          { findCols: ["slug", "name"],                  nameCol: "name",  extraCols: ["is_active"] },
  subtopics:       { findCols: ["slug", "name"],                  nameCol: "name",  extraCols: ["is_active"] },
};

// ─── Find-only resolver (no auto-create) ────────────────────────────────────

async function findSlug(client, table, slug) {
  const cfg = TABLE_CONFIG[table] || { findCols: ["slug", "name"], nameCol: "name" };
  const existingCols = await getTableColumns(client, table);
  for (const col of cfg.findCols) {
    if (!existingCols.has(col)) continue;
    const { rows } = await client.query(`SELECT id FROM ${table} WHERE ${col} = $1 LIMIT 1`, [slug]);
    if (rows[0]?.id) return rows[0].id;
  }
  // Fuzzy: try matching normalized slug against title/name/label
  const normalizedSlug = slug.replace(/[-_]/g, " ").toLowerCase().trim();
  for (const nameCol of ["title", "name", "label"]) {
    if (!existingCols.has(nameCol)) continue;
    const { rows } = await client.query(
      `SELECT id FROM ${table} WHERE LOWER(REPLACE(REPLACE(${nameCol}, '-', ' '), '_', ' ')) = $1 LIMIT 1`,
      [normalizedSlug]
    );
    if (rows[0]?.id) return rows[0].id;
  }
  return null;
}

// ─── Upsert resolver (creates missing taxonomy rows) ─────────────────────────

async function upsertSlug(client, table, slug, extra = {}) {
  const cfg = TABLE_CONFIG[table] || { findCols: ["slug", "name"], nameCol: "name", extraCols: [] };

  // Check which columns actually exist on this table
  const existingCols = await getTableColumns(client, table);

  // Try to find existing row by any of the findCols that exist
  for (const col of cfg.findCols) {
    if (!existingCols.has(col)) continue;
    const { rows } = await client.query(`SELECT id FROM ${table} WHERE ${col} = $1 LIMIT 1`, [slug]);
    if (rows[0]?.id) return rows[0].id;
  }

  // Fuzzy: try matching normalized slug against title/name columns
  const normalizedSlug = slug.replace(/[-_]/g, " ").toLowerCase().trim();
  for (const nameCol of ["title", "name", "label"]) {
    if (!existingCols.has(nameCol)) continue;
    const { rows } = await client.query(
      `SELECT id FROM ${table} WHERE LOWER(REPLACE(REPLACE(${nameCol}, '-', ' '), '_', ' ')) = $1 LIMIT 1`,
      [normalizedSlug]
    );
    if (rows[0]?.id) return rows[0].id;
  }

  // Not found — insert new row with only columns that exist
  const displayName = slug.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const insertCols = [];
  const insertVals = [];

  const addCol = (col, val) => {
    if (existingCols.has(col)) {
      insertCols.push(col);
      insertVals.push(val);
    }
  };

  addCol("slug", slug);
  addCol(cfg.nameCol, displayName);
  for (const ec of cfg.extraCols) addCol(ec, true);
  for (const [k, v] of Object.entries(extra)) addCol(k, v);

  if (insertCols.length === 0) return null;

  const placeholders = insertCols.map((_, i) => `$${i + 1}`);
  const ins = `INSERT INTO ${table} (${insertCols.map(c => `"${c}"`).join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING id`;
  const insResult = await client.query(ins, insertVals);
  return insResult.rows[0]?.id ?? null;
}

async function resolveExamCategoryId(client, slug, strict = false) {
  return strict ? findSlug(client, "exam_categories", slug) : upsertSlug(client, "exam_categories", slug);
}

async function resolveExamId(client, slug, examCategorySlug, strict = false) {
  const extra = examCategorySlug ? { category_id: examCategorySlug } : {};
  return strict ? findSlug(client, "exams", slug) : upsertSlug(client, "exams", slug, extra);
}

async function resolveStageId(client, slug, examId, strict = false) {
  const STAGE_ALIASES = {
    "tier-1": "tier-1-pre",
    "tier-2": "tier-2-mains",
    "tier1": "tier-1-pre",
    "tier2": "tier-2-mains",
    "prelims": "tier-1-pre",
    "mains": "tier-2-mains",
    "phase-1": "tier-1-pre",
    "phase-2": "tier-2-mains",
  };
  const resolved = STAGE_ALIASES[slug] || slug;
  const extra = examId ? { exam_id: examId } : {};
  // Try exact match first, then try without prefix (e.g. "tier-1-pre" matches "tier-1")
  let id = strict ? await findSlug(client, "stages", resolved) : await upsertSlug(client, "stages", resolved, extra);
  if (!id) {
    // Fuzzy: try matching by name containing the slug
    const cols = await getTableColumns(client, "stages");
    if (cols.has("name") || cols.has("slug")) {
      const searchCol = cols.has("slug") ? "slug" : "name";
      const { rows } = await client.query(
        `SELECT id FROM stages WHERE ${searchCol} ILIKE $1 LIMIT 1`,
        [`%${resolved}%`]
      );
      if (rows[0]?.id) id = rows[0].id;
    }
  }
  return id;
}

async function resolveTestCategoryId(client, slug, strict = false) {
  return strict ? findSlug(client, "test_categories", slug) : upsertSlug(client, "test_categories", slug);
}

async function resolveTestSeriesId(client, slug, stageId, categorySlug, strict = false) {
  const extra = {};
  if (stageId) extra.stage_id = stageId;
  if (categorySlug) extra.category = categorySlug;
  return strict ? findSlug(client, "test_series", slug) : upsertSlug(client, "test_series", slug, extra);
}

async function resolveSubjectId(client, slug, strict = false) {
  return strict ? findSlug(client, "subjects", slug) : upsertSlug(client, "subjects", slug);
}

async function resolveChapterId(client, slug, strict = false) {
  if (!slug) return null;
  return strict ? findSlug(client, "chapters", slug) : upsertSlug(client, "chapters", slug);
}

async function resolveTopicId(client, slug, strict = false) {
  if (!slug) return null;
  return strict ? findSlug(client, "topics", slug) : upsertSlug(client, "topics", slug);
}

async function resolveSubtopicId(client, slug, strict = false) {
  if (!slug) return null;
  return strict ? findSlug(client, "subtopics", slug) : upsertSlug(client, "subtopics", slug);
}

// ─── Unique slug check ────────────────────────────────────────────────────────

async function ensureUniqueSlug(client, slug) {
  const { rows } = await client.query(`SELECT id FROM tests WHERE slug = $1 LIMIT 1`, [slug]);
  if (rows.length === 0) return slug;
  return `${slug}-${Date.now()}`;
}

// ─── Pre-commit validation ────────────────────────────────────────────────────

function validateBeforeCommit(json, result) {
  const totalQuestionsFromSections = (json.sections || []).reduce(
    (sum, s) => sum + (s.questions || []).length, 0
  );

  if (json.totalQuestions && totalQuestionsFromSections > 0 && json.totalQuestions !== totalQuestionsFromSections) {
    result.warnings.push(
      `totalQuestions (${json.totalQuestions}) does not match actual questions in sections (${totalQuestionsFromSections})`
    );
  }

  for (const section of json.sections || []) {
    if (section.questionCount && section.questions && section.questionCount !== section.questions.length) {
      result.warnings.push(
        `Section "${section.name}" questionCount (${section.questionCount}) does not match actual questions (${section.questions.length})`
      );
    }
  }
}

// ─── Table column cache (prevents repeated info_schema queries) ──────────────

const columnCache = new Map();

async function getTableColumns(client, table) {
  if (columnCache.has(table)) return columnCache.get(table);
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
    [table]
  );
  const cols = new Set(rows.map(r => r.column_name));
  columnCache.set(table, cols);
  return cols;
}

async function hasColumn(client, table, column) {
  const cols = await getTableColumns(client, table);
  return cols.has(column);
}

// ─── Year extraction ───────────────────────────────────────────────────────────

function extractYear(json) {
  if (!json.isPyq) return null;
  if (json.pyqYear) return json.pyqYear;
  const seriesMatch = String(json.testSeriesId || "").match(/(\d{4})/);
  if (seriesMatch) return parseInt(seriesMatch[1], 10);
  const titleMatch = String(json.title || "").match(/(\d{4})/);
  if (titleMatch) return parseInt(titleMatch[1], 10);
  return null;
}

// ─── Status mapping ────────────────────────────────────────────────────────────

function mapStatus(jsonStatus) {
  const map = { published: "active", draft: "draft", archived: "archived" };
  return map[jsonStatus] || "draft";
}

// ─── Helper: build INSERT dynamically based on existing columns ────────────────

async function safeInsert(client, table, row, columns) {
  const existingCols = await getTableColumns(client, table);
  const cols = columns.filter(c => existingCols.has(c));
  const vals = cols.map(c => row[c]);
  const placeholders = cols.map((_, i) => `$${i + 1}`);

  const sql = `
    INSERT INTO ${table} (${cols.map(c => `"${c}"`).join(", ")})
    VALUES (${placeholders.join(", ")})
    RETURNING id, ${cols.includes("title") ? "title, slug" : "name"}
  `;
  return client.query(sql, vals);
}

// ─── Main import function ─────────────────────────────────────────────────────

/**
 * Import a full-test JSON file (with nested sections and questions).
 *
 * @param {object} json       - The parsed JSON test object
 * @param {object} config     - Import config (userId, fileName, dryRun, skipDuplicates)
 * @returns {object}          - Import result with counts and errors
 */
export async function importFullTest(json, config = {}) {
  const { userId = null, fileName = "unknown.json", dryRun = false, skipDuplicates = true, strict = false } = config;

  const client = await pool.connect();
  const result = {
    testId: null,
    testTitle: json.title || "Untitled",
    sectionsCreated: 0,
    questionsCreated: 0,
    questionsSkipped: 0,
    errors: [],
    warnings: [],
  };

  // Reset column cache per import (tables may have changed)
  columnCache.clear();

  try {
    await client.query("BEGIN");

    // ── 1. Resolve FKs from slugs ──────────────────────────────────────────

    const examCategoryId = json.examCategoryId
      ? await resolveExamCategoryId(client, json.examCategoryId, strict)
      : null;
    if (json.examCategoryId && !examCategoryId) {
      result.warnings.push(`examCategoryId "${json.examCategoryId}" not found${strict ? ' — create it first' : ' — proceeding without it'}`);
    }

    const examId = json.examId
      ? await resolveExamId(client, json.examId, examCategoryId, strict)
      : null;

    const stageId = json.stageId
      ? await resolveStageId(client, json.stageId, examId, strict)
      : null;

    let testCategoryId = json.categoryId
      ? await resolveTestCategoryId(client, json.categoryId, strict)
      : null;

    const subCatSlug = json.subCategoryId || json.subCategory;
    if (subCatSlug) {
      const resolvedSub = await resolveTestCategoryId(client, subCatSlug, strict);
      if (resolvedSub) {
        testCategoryId = resolvedSub;
      }
    }

    const seriesId = json.testSeriesId
      ? await resolveTestSeriesId(client, json.testSeriesId, stageId, json.examCategoryId, strict)
      : null;

    if (json.examId && !examId) {
      result.warnings.push(`examId "${json.examId}" not found${strict ? ' — create it first' : ' — proceeding without it'}`);
    }
    if (json.stageId && !stageId) {
      result.warnings.push(`stageId "${json.stageId}" not found${strict ? ' — create it first' : ' — proceeding without it'}`);
    }
    if (json.categoryId && !testCategoryId) {
      result.warnings.push(`categoryId "${json.categoryId}" not found${strict ? ' — create it first' : ' — proceeding without it'}`);
    }
    if (json.testSeriesId && !seriesId) {
      result.warnings.push(`testSeriesId "${json.testSeriesId}" not found${strict ? ' — create it first' : ' — proceeding without it'}`);
    }

    // ── 1b. Pre-commit validation ─────────────────────────────────────────

    validateBeforeCommit(json, result);

    // ── 2. Build test INSERT ───────────────────────────────────────────────

    let slug = json.slug || `${(json.title || "test").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    if (!dryRun) {
      slug = await ensureUniqueSlug(client, slug);
    }
    const year = extractYear(json);

    const testRow = {
      title: json.title || "Untitled",
      short_title: json.shortTitle || null,
      slug,
      description: json.description || "",
      thumbnail: json.thumbnail || null,
      banner: json.banner || null,
      category: json.examCategoryId || null,
      sub_category: json.subCategory || (json.subCategoryId ? String(json.subCategoryId).replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : null),
      exam_category_id: examCategoryId || null,
      test_type: json.testType || "full-length",
      status: json.status ? mapStatus(json.status) : "active",
      difficulty: json.difficulty || "medium",
      duration: json.duration || 60,
      total_questions: json.totalQuestions || 0,
      total_marks: json.totalMarks || 0,
      negative_marking: json.negativeMarking || 0,
      is_active: true,
      is_pro: json.access?.type === "paid" || false,
      is_pyq: json.isPyq || false,
      pyq_year: year,
      is_live: json.isLive ?? false,
      is_coming_soon: json.isComingSoon ?? false,
      is_featured: json.isFeatured ?? false,
      passing_marks: json.passingMarks || 0,
      cutoff_marks: json.cutoffMarks ? JSON.stringify(json.cutoffMarks) : null,
      question_language_mode: json.questionLanguageMode || "bilingual",
      languages: JSON.stringify(json.languages || ["en"]),
      series_id: seriesId,
      stage_id: stageId,
      test_category_id: testCategoryId,
      exam_id: examId ? String(examId) : null,
      tags: json.tags || [],
      // Config JSONB blocks
      show_config: JSON.stringify({
        calculator: json.showCalculator ?? false,
        questionPalette: json.showQuestionPalette ?? true,
        sectionPalette: json.showSectionPalette ?? true,
        timer: json.showTimer ?? true,
        bookmark: json.allowBookmark ?? true,
        reportIssue: json.allowReportIssue ?? true,
      }),
      timing_config: JSON.stringify(json.timingConfig || {}),
      optional_section_config: JSON.stringify(json.optionalSectionConfig || {}),
      attempt_rules: JSON.stringify(json.attemptRules || {}),
      analysis_config: JSON.stringify(json.analysisConfig || {}),
      access_config: JSON.stringify(json.access || { type: "free" }),
      availability: JSON.stringify(json.availability || {}),
      seo: JSON.stringify(json.seo || {}),
      proctoring: JSON.stringify({
        enabled: json.proctoringEnabled ?? false,
        cameraMonitoring: json.cameraMonitoring ?? false,
        tabSwitchLimit: json.tabSwitchLimit ?? 0,
        copyPasteDisabled: json.copyPasteDisabled ?? false,
      }),
      adaptive: JSON.stringify({
        enabled: json.adaptiveTest ?? false,
        algorithm: json.adaptiveAlgorithm || null,
      }),
      features: JSON.stringify({
        certificate: json.certificateEnabled ?? false,
        leaderboard: json.leaderboardEnabled ?? true,
      }),
      // Legacy fields
      shuffle_questions: json.shuffleQuestions ?? false,
      shuffle_options: json.shuffleOptions ?? true,
      allow_review: json.allowReview ?? true,
      max_attempts: json.attemptRules?.maxAttempts || 0,
      instructions: Array.isArray(json.instructions) ? json.instructions.join("\n") : (json.instructions || null),
      version: json.version || 1,
      imported_from: "full-test-json",
      source_test_id: String(json.id || ""),
    };

    // Dynamic columns list (skip columns that don't exist in DB yet)
    const testCols = Object.keys(testRow);

    const testPlaceholders = testCols.map((_, i) => `$${i + 1}`);
    const testSql = `
      INSERT INTO tests (${testCols.map(c => `"${c}"`).join(", ")})
      VALUES (${testPlaceholders.join(", ")})
      RETURNING id, title, slug
    `;

    let testResult;
    if (dryRun) {
      testResult = { rows: [{ id: -1, title: testRow.title, slug: testRow.slug }] };
    } else {
      // Filter out columns that don't exist in the actual DB
      const cols = await getTableColumns(client, "tests");
        const validCols = testCols.filter(c => cols.has(c));
        const validVals = validCols.map(c => testRow[c]);
        const validPlaceholders = validCols.map((_, i) => `$${i + 1}`);
        const dynamicSql = `
          INSERT INTO tests (${validCols.map(c => `"${c}"`).join(", ")})
          VALUES (${validPlaceholders.join(", ")})
          RETURNING id, title, slug
        `;
        testResult = await client.query(dynamicSql, validVals);
    }

    const testDbId = testResult.rows[0].id;
    result.testId = testDbId;

    // ── 3. Process sections ────────────────────────────────────────────────

    const sections = json.sections || [];
    let globalQuestionNumber = 0;

    for (const section of sections) {
      const subjectId = section.subjectId
        ? await resolveSubjectId(client, section.subjectId, strict)
        : null;

      const sectionRow = {
        name: section.name || "Untitled Section",
        category_id: testCategoryId,
        test_id: testDbId,
        description: section.description || null,
        duration: section.duration ? Math.round(section.duration / 60) : null,
        time_limit: section.duration || null,
        display_order: section.order || 0,
        question_count: section.questionCount || 0,
        total_marks: section.maxMarks || 0,
        negative_marking: section.negativeMarking || 0,
        subject_id: subjectId,
        mandatory: section.mandatory ?? true,
        optional: section.optional ?? false,
        qualifying: section.qualifying ?? false,
        is_qualifying: section.qualifying ?? false,
        allow_navigation: section.allowNavigation ?? true,
        is_locked: section.isLocked ?? false,
        shuffle_questions: section.shuffleQuestions ?? false,
        instructions: JSON.stringify(section.instructions || []),
        section_code: section.id || null,
        is_active: true,
      };

      let sectionResult;
      if (dryRun) {
        sectionResult = { rows: [{ id: -1, name: sectionRow.name }] };
      } else {
        const cols = await getTableColumns(client, "test_sections");
        const validCols = Object.keys(sectionRow).filter(c => cols.has(c));
        const validVals = validCols.map(c => sectionRow[c]);
        const validPlaceholders = validCols.map((_, i) => `$${i + 1}`);
        const sectionSql = `
          INSERT INTO test_sections (${validCols.map(c => `"${c}"`).join(", ")})
          VALUES (${validPlaceholders.join(", ")})
          RETURNING id, name
        `;
        sectionResult = await client.query(sectionSql, validVals);
      }

      const sectionDbId = sectionResult.rows[0].id;
      result.sectionsCreated++;

      // ── 4. Process questions in this section ─────────────────────────────

      const questions = section.questions || [];

      for (let qi = 0; qi < questions.length; qi++) {
        const q = questions[qi];
        try {
          if (!dryRun) await client.query(`SAVEPOINT q${globalQuestionNumber}`);

          // ── Resolve subjectId on question level (may differ from section)
          const qSubjectId = q.subjectId
            ? await resolveSubjectId(client, q.subjectId, strict)
            : subjectId;

          // ── Resolve chapter/topic/subtopic slugs to INT FK IDs
          const chapterId = q.chapterId ? await resolveChapterId(client, q.chapterId, strict) : null;
          const topicId = q.topicId ? await resolveTopicId(client, q.topicId, strict) : null;
          const subtopicId = q.subtopicId ? await resolveSubtopicId(client, q.subtopicId, strict) : null;

          // ── Bilingual text extraction (support Hindi-only questions)
          const questionText = q.text?.en || q.question || "";
          const questionTextHi = q.text?.hn || q.question_text_hi || null;

          const options = q.options_bilingual?.en || q.options || [];
          const optionsHi = q.options_bilingual?.hn || null;

          const explanation = q.solution_bilingual?.en || q.solution || q.explanation || "";
          const explanationHi = q.solution_bilingual?.hn || null;

          // ── correctAnswer: JSON is 1-indexed, DB is 0-indexed
          let correctOption = typeof q.correctAnswer === "number"
            ? q.correctAnswer - 1
            : (typeof q.correct_option_id === "number" ? q.correct_option_id : 0);

          // ── Skip if no question text in either language
          if (!questionText && !questionTextHi) {
            result.questionsSkipped++;
            continue;
          }
          if (questionText && questionText.trim().length < 3 && (!questionTextHi || questionTextHi.trim().length < 3)) {
            result.questionsSkipped++;
            continue;
          }

          // ── Dedup check
          if (skipDuplicates && q.id) {
            const dupCheck = await client.query(
              `SELECT id FROM questions WHERE external_question_id = $1 AND test_id = $2 AND is_deleted = false LIMIT 1`,
              [String(q.id), testDbId]
            );
            if (dupCheck.rows.length > 0) {
              result.questionsSkipped++;
              continue;
            }
          }

          const qRow = {
            question_text: questionText || questionTextHi || "",
            question_text_hi: questionTextHi,
            options: options,
            options_hi: optionsHi || [],
            correct_option: correctOption,
            explanation,
            explanation_hi: explanationHi,
            difficulty: q.difficulty || "medium",
            marks: q.marks || 2,
            negative_marks: q.negativeMarks || q.negative || 0,
            type: q.questionType || "mcq",
            status: mapStatus(q.status),
            section: q.section || section.name || null,
            subject_id: qSubjectId,
            test_id: testDbId,
            external_question_id: String(q.id || ""),
            estimated_time: q.estimatedTime || null,
            language: (q.languages || ["en"])[0] || "en",
            languages: q.languages || ["en"],
            source_config: q.source || {},
            exam_category_ids: q.examCategoryIds || [],
            exam_ids: q.examIds || [],
            question_stage_ids: q.stageIds || [],
            chapter_id: chapterId,
            topic_id: topicId,
            subtopic_id: subtopicId,
            concept_ids: q.conceptIds || [],
            skill_ids: q.skillIds || [],
            tags: q.tags || [],
            chapter_ids: q.chapterIds || [],
            topic_ids: q.topicIds || [],
            subtopic_ids: q.subtopicIds || [],
            ai_generated: q.aiGenerated ?? false,
            question_number: ++globalQuestionNumber,
            is_active: true,
          };

          let qResult;
          if (dryRun) {
            qResult = { rows: [{ id: -1 }] };
          } else {
            const cols = await getTableColumns(client, "questions");
            const validCols = Object.keys(qRow).filter(c => cols.has(c));
            const validVals = validCols.map(c => qRow[c]);
            const validPlaceholders = validCols.map((_, i) => `$${i + 1}`);
            const qSql = `
              INSERT INTO questions (${validCols.map(c => `"${c}"`).join(", ")})
              VALUES (${validPlaceholders.join(", ")})
              RETURNING id
            `;
            qResult = await client.query(qSql, validVals);
          }

          const questionDbId = qResult.rows[0].id;

          // ── Link question to test via junction table
          if (!dryRun) {
            await client.query(
              `INSERT INTO test_questions (test_id, question_id, section_id, question_number, created_at)
               VALUES ($1, $2, $3, $4, NOW())
               ON CONFLICT DO NOTHING`,
              [testDbId, questionDbId, sectionDbId, qi + 1]
            );
          }

          result.questionsCreated++;
        } catch (qErr) {
          if (!dryRun) {
            try { await client.query(`ROLLBACK TO SAVEPOINT q${globalQuestionNumber}`); } catch (rollbackErr) { /* ignore rollback errors */ }
          }
          result.errors.push({
            questionId: q.id || "unknown",
            sectionId: section.name || "unknown",
            message: qErr.message,
          });
          result.questionsSkipped++;
        }
      }

      // ── Update section question_count and total_marks
      if (!dryRun) {
        await client.query(
          `UPDATE test_sections
           SET question_count = $1, total_marks = $2, updated_at = NOW()
           WHERE id = $3`,
          [section.questionCount || questions.length, section.maxMarks || 0, sectionDbId]
        );
      }
    }

    // ── 5. Update test totals ──────────────────────────────────────────────

    if (!dryRun) {
      await client.query(
        `UPDATE tests
         SET total_questions = $1, total_marks = $2, updated_at = NOW()
         WHERE id = $3`,
        [result.questionsCreated, json.totalMarks || 0, testDbId]
      );
    }

    // ── 6. Log the import ──────────────────────────────────────────────────

    if (!dryRun) {
      await client.query(
        `INSERT INTO import_logs (imported_by, source, file_name, imported, failed, errors, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          userId,
          "full-test-json",
          fileName,
          result.questionsCreated,
          result.questionsSkipped,
          JSON.stringify(result.errors),
          JSON.stringify({
            testId: testDbId,
            testTitle: result.testTitle,
            sectionsCreated: result.sectionsCreated,
            warnings: result.warnings,
          }),
        ]
      );
    }

    if (dryRun) {
      await client.query("ROLLBACK");
    } else {
      await client.query("COMMIT");
    }
  } catch (err) {
    await client.query("ROLLBACK");
    result.errors.push({ message: err.message, stack: err.stack });
    throw err;
  } finally {
    client.release();
  }

  return result;
}
