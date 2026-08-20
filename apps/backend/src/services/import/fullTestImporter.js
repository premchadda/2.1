import { pool } from "../../infrastructure/database/postgres-helpers.js";
import { saveTestContent } from "./testContentStorage.js";

// ─── Slug → ID resolution helpers (with upsert) ─────────────────────────────

// Table-specific: which column(s) to search for existing rows, and display name column
const TABLE_CONFIG = {
  exam_categories: {
    findCols: ["category_id", "slug", "label"],
    nameCol: "label",
    extraCols: ["is_active"],
  },
  exams: {
    findCols: ["slug", "title"],
    nameCol: "title",
    extraCols: ["is_active"],
  },
  stages: {
    findCols: ["slug", "name"],
    nameCol: "name",
    extraCols: ["is_active"],
  },
  test_categories: {
    findCols: ["slug", "name"],
    nameCol: "name",
    extraCols: ["is_deleted"],
  },
  test_series: {
    findCols: ["slug", "title"],
    nameCol: "title",
    extraCols: ["is_active"],
  },
  subjects: {
    findCols: ["slug", "name"],
    nameCol: "name",
    extraCols: ["is_active"],
  },
  chapters: {
    findCols: ["slug", "title"],
    nameCol: "title",
    extraCols: ["is_active"],
  },
  topics: {
    findCols: ["slug", "name"],
    nameCol: "name",
    extraCols: ["is_active"],
  },
  subtopics: {
    findCols: ["slug", "name"],
    nameCol: "name",
    extraCols: ["is_active"],
  },
};

const slugCache = new Map();

// ─── Find-only resolver (no auto-create) ────────────────────────────────────

async function findSlug(client, table, slug) {
  const cacheKey = `find:${table}:${slug}`;
  if (slugCache.has(cacheKey)) return slugCache.get(cacheKey);

  const cfg = TABLE_CONFIG[table] || {
    findCols: ["slug", "name"],
    nameCol: "name",
  };
  const existingCols = await getTableColumns(client, table);

  let resultId = null;
  for (const col of cfg.findCols) {
    if (!existingCols.has(col)) continue;
    const { rows } = await client.query(
      `SELECT id FROM ${table} WHERE ${col} = $1 LIMIT 1`,
      [slug],
    );
    if (rows[0]?.id) {
      resultId = rows[0].id;
      break;
    }
  }

  if (!resultId) {
    // Fuzzy: try matching normalized slug against title/name/label
    const normalizedSlug = slug.replace(/[-_]/g, " ").toLowerCase().trim();
    for (const nameCol of ["title", "name", "label"]) {
      if (!existingCols.has(nameCol)) continue;
      const { rows } = await client.query(
        `SELECT id FROM ${table} WHERE LOWER(REPLACE(REPLACE(${nameCol}, '-', ' '), '_', ' ')) = $1 LIMIT 1`,
        [normalizedSlug],
      );
      if (rows[0]?.id) {
        resultId = rows[0].id;
        break;
      }
    }
  }

  slugCache.set(cacheKey, resultId);
  return resultId;
}

// ─── Upsert resolver (creates missing taxonomy rows) ─────────────────────────

async function upsertSlug(client, table, slug, extra = {}) {
  const cacheKey = `upsert:${table}:${slug}:${JSON.stringify(extra)}`;
  if (slugCache.has(cacheKey)) return slugCache.get(cacheKey);

  const cfg = TABLE_CONFIG[table] || {
    findCols: ["slug", "name"],
    nameCol: "name",
    extraCols: [],
  };

  // Check which columns actually exist on this table
  const existingCols = await getTableColumns(client, table);

  let resultId = null;
  // Try to find existing row by any of the findCols that exist
  for (const col of cfg.findCols) {
    if (!existingCols.has(col)) continue;
    const { rows } = await client.query(
      `SELECT id FROM ${table} WHERE ${col} = $1 LIMIT 1`,
      [slug],
    );
    if (rows[0]?.id) {
      resultId = rows[0].id;
      break;
    }
  }

  if (!resultId) {
    // Fuzzy: try matching normalized slug against title/name columns
    const normalizedSlug = slug.replace(/[-_]/g, " ").toLowerCase().trim();
    for (const nameCol of ["title", "name", "label"]) {
      if (!existingCols.has(nameCol)) continue;
      const { rows } = await client.query(
        `SELECT id FROM ${table} WHERE LOWER(REPLACE(REPLACE(${nameCol}, '-', ' '), '_', ' ')) = $1 LIMIT 1`,
        [normalizedSlug],
      );
      if (rows[0]?.id) {
        resultId = rows[0].id;
        break;
      }
    }
  }

  if (!resultId) {
    // Not found — insert new row with only columns that exist
    const displayName = slug
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
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

    if (insertCols.length > 0) {
      const placeholders = insertCols.map((_, i) => `$${i + 1}`);
      const ins = `INSERT INTO ${table} (${insertCols.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING id`;
      const insResult = await client.query(ins, insertVals);
      resultId = insResult.rows[0]?.id ?? null;
    }
  }

  slugCache.set(cacheKey, resultId);
  return resultId;
}

async function resolveExamCategoryId(client, slug, strict = false) {
  return strict
    ? findSlug(client, "exam_categories", slug)
    : upsertSlug(client, "exam_categories", slug);
}

async function resolveExamId(client, slug, examCategorySlug, strict = false) {
  const extra = examCategorySlug ? { category_id: examCategorySlug } : {};
  return strict
    ? findSlug(client, "exams", slug)
    : upsertSlug(client, "exams", slug, extra);
}

async function resolveStageId(client, slug, examId, strict = false) {
  const STAGE_ALIASES = {
    "tier-1": "tier-1-pre",
    "tier-2": "tier-2-mains",
    tier1: "tier-1-pre",
    tier2: "tier-2-mains",
    prelims: "tier-1-pre",
    mains: "tier-2-mains",
    "phase-1": "tier-1-pre",
    "phase-2": "tier-2-mains",
  };
  const resolved = STAGE_ALIASES[slug] || slug;
  const extra = examId ? { exam_id: examId } : {};
  // Try exact match first, then try without prefix (e.g. "tier-1-pre" matches "tier-1")
  let id = strict
    ? await findSlug(client, "stages", resolved)
    : await upsertSlug(client, "stages", resolved, extra);
  if (!id) {
    // Fuzzy: try matching by name containing the slug
    const cols = await getTableColumns(client, "stages");
    if (cols.has("name") || cols.has("slug")) {
      const searchCol = cols.has("slug") ? "slug" : "name";
      const { rows } = await client.query(
        `SELECT id FROM stages WHERE ${searchCol} ILIKE $1 LIMIT 1`,
        [`%${resolved}%`],
      );
      if (rows[0]?.id) id = rows[0].id;
    }
  }
  return id;
}

async function resolveTestCategoryId(client, slug, strict = false) {
  if (!slug) return null;
  const CATEGORY_ALIASES = {
    pyqs: "pyps",
    pyq: "pyps",
  };
  const resolved = CATEGORY_ALIASES[slug.toLowerCase()] || slug;

  if (/^\d{4}$/.test(resolved)) {
    const parentId =
      (await findSlug(client, "test_categories", "year-based")) || 7;
    const extra = { parent_id: parentId };
    return strict
      ? findSlug(client, "test_categories", resolved)
      : upsertSlug(client, "test_categories", resolved, extra);
  }

  return strict
    ? findSlug(client, "test_categories", resolved)
    : upsertSlug(client, "test_categories", resolved);
}

async function resolveTestSeriesId(
  client,
  slug,
  stageId,
  categorySlug,
  strict = false,
) {
  const extra = {};
  if (stageId) extra.stage_id = stageId;
  if (categorySlug) extra.category = categorySlug;
  return strict
    ? findSlug(client, "test_series", slug)
    : upsertSlug(client, "test_series", slug, extra);
}

async function resolveSubjectId(client, slug, strict = false) {
  return strict
    ? findSlug(client, "subjects", slug)
    : upsertSlug(client, "subjects", slug);
}

async function resolveChapterId(client, slug, subjectId, strict = false) {
  if (!slug) return null;
  const extra = {};
  if (subjectId) extra.subject_id = subjectId;
  return strict
    ? findSlug(client, "chapters", slug)
    : upsertSlug(client, "chapters", slug, extra);
}

async function resolveTopicId(
  client,
  slug,
  subjectSlug,
  subjectId,
  strict = false,
) {
  if (!slug) return null;
  const extra = {};
  if (subjectSlug) extra.subject = subjectSlug;
  if (subjectId) extra.subject_id = subjectId;
  return strict
    ? findSlug(client, "topics", slug)
    : upsertSlug(client, "topics", slug, extra);
}

async function resolveSubtopicId(client, slug, topicId, strict = false) {
  if (!slug) return null;
  const extra = {};
  if (topicId) extra.topic_id = topicId;
  return strict
    ? findSlug(client, "subtopics", slug)
    : upsertSlug(client, "subtopics", slug, extra);
}

// ─── Unique slug check ────────────────────────────────────────────────────────

async function ensureUniqueSlug(client, slug) {
  const { rows } = await client.query(
    `SELECT id FROM tests WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  if (rows.length === 0) return slug;
  return `${slug}-${Date.now()}`;
}

// ─── Pre-commit validation ────────────────────────────────────────────────────

function validateBeforeCommit(json, result) {
  const totalQuestionsFromSections = (json.sections || []).reduce(
    (sum, s) => sum + (s.questions || []).length,
    0,
  );

  if (
    json.totalQuestions &&
    totalQuestionsFromSections > 0 &&
    json.totalQuestions !== totalQuestionsFromSections
  ) {
    result.warnings.push(
      `totalQuestions (${json.totalQuestions}) does not match actual questions in sections (${totalQuestionsFromSections})`,
    );
  }

  for (const section of json.sections || []) {
    if (
      section.questionCount &&
      section.questions &&
      section.questionCount !== section.questions.length
    ) {
      result.warnings.push(
        `Section "${section.name}" questionCount (${section.questionCount}) does not match actual questions (${section.questions.length})`,
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
    [table],
  );
  const cols = new Set(rows.map((r) => r.column_name));
  columnCache.set(table, cols);
  return cols;
}

async function hasColumn(client, table, column) {
  const cols = await getTableColumns(client, table);
  return cols.has(column);
}

// ─── Standard section ordering for SSC CGL exams ──────────────────────────────
// Maps section/subject names to their standard display order in the actual exam
const SECTION_ORDER_MAP = {
  "logical reasoning": 1,
  reasoning: 1,
  "general intelligence and reasoning": 1,
  "general intelligence": 1,
  "general awareness": 2,
  "general knowledge": 2,
  "general studies": 2,
  gk: 2,
  gs: 2,
  "quantitative aptitude": 3,
  mathematics: 3,
  math: 3,
  maths: 3,
  "english language": 4,
  "english comprehension": 4,
  english: 4,
};

function getSectionDisplayOrder(sectionName, fallbackOrder) {
  const key = String(sectionName || "")
    .toLowerCase()
    .trim();
  return SECTION_ORDER_MAP[key] ?? fallbackOrder;
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

const categoryPathCache = new Map();

async function getCategoryPath(client, categoryId) {
  if (!categoryId) return { pathIds: [], pathNames: [] };
  if (categoryPathCache.has(categoryId))
    return categoryPathCache.get(categoryId);

  const pathIds = [];
  const pathNames = [];
  let currentId = categoryId;

  while (currentId) {
    const res = await client.query(
      "SELECT id, name, parent_id FROM test_categories WHERE id = $1",
      [currentId],
    );
    if (res.rows.length > 0) {
      const cat = res.rows[0];
      pathIds.unshift(cat.id);
      pathNames.unshift(cat.name);
      currentId = cat.parent_id;
    } else {
      break;
    }
  }
  const result = { pathIds, pathNames };
  categoryPathCache.set(categoryId, result);
  return result;
}

// ─── Helper: build INSERT dynamically based on existing columns ────────────────

async function safeInsert(client, table, row, columns) {
  const existingCols = await getTableColumns(client, table);
  const cols = columns.filter((c) => existingCols.has(c));
  const vals = cols.map((c) => row[c]);
  const placeholders = cols.map((_, i) => `$${i + 1}`);

  const sql = `
    INSERT INTO ${table} (${cols.map((c) => `"${c}"`).join(", ")})
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
  const {
    userId = null,
    fileName = "unknown.json",
    dryRun = false,
    skipDuplicates = true,
    strict = false,
    storageMode = "database",
  } = config;

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

  // Reset column cache and slug cache per import (tables may have changed)
  columnCache.clear();
  slugCache.clear();

  try {
    await client.query("BEGIN");

    // ── 1. Resolve FKs from slugs ──────────────────────────────────────────

    const examCategoryId = json.examCategoryId
      ? await resolveExamCategoryId(client, json.examCategoryId, strict)
      : null;
    if (json.examCategoryId && !examCategoryId) {
      result.warnings.push(
        `examCategoryId "${json.examCategoryId}" not found${strict ? " — create it first" : " — proceeding without it"}`,
      );
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

    const subCatSlug =
      json.subCategoryId || json.subCategory || json.subcategory;
    if (subCatSlug) {
      // Try to extract a year from slugs like "pyqs-year-based-2019"
      const yearMatch = String(subCatSlug).match(/(\d{4})/);
      const resolvedSub = await resolveTestCategoryId(
        client,
        yearMatch ? yearMatch[1] : subCatSlug,
        strict,
      );
      if (resolvedSub) {
        testCategoryId = resolvedSub;
      }
    }

    const seriesId = json.testSeriesId
      ? await resolveTestSeriesId(
          client,
          json.testSeriesId,
          stageId,
          json.examCategoryId,
          strict,
        )
      : null;

    if (json.examId && !examId) {
      result.warnings.push(
        `examId "${json.examId}" not found${strict ? " — create it first" : " — proceeding without it"}`,
      );
    }
    if (json.stageId && !stageId) {
      result.warnings.push(
        `stageId "${json.stageId}" not found${strict ? " — create it first" : " — proceeding without it"}`,
      );
    }
    if (json.categoryId && !testCategoryId) {
      result.warnings.push(
        `categoryId "${json.categoryId}" not found${strict ? " — create it first" : " — proceeding without it"}`,
      );
    }
    if (json.testSeriesId && !seriesId) {
      result.warnings.push(
        `testSeriesId "${json.testSeriesId}" not found${strict ? " — create it first" : " — proceeding without it"}`,
      );
    }

    // ── 1b. Pre-commit validation ─────────────────────────────────────────

    validateBeforeCommit(json, result);

    // ── 2. Build test INSERT ───────────────────────────────────────────────

    let slug =
      json.slug ||
      `${(json.title || "test")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}`;
    if (!dryRun) {
      slug = await ensureUniqueSlug(client, slug);
    }
    const year = extractYear(json);

    const { pathIds, pathNames } = await getCategoryPath(
      client,
      testCategoryId,
    );

    const testRow = {
      title: json.title || "Untitled",
      short_title: json.shortTitle || null,
      slug,
      description: json.description || "",
      thumbnail: json.thumbnail || null,
      banner: json.banner || null,
      category: json.category || (json.isPyq || year ? "PYPs" : "Mock Tests"),
      sub_category:
        json.subCategory ||
        (year
          ? String(year)
          : json.subCategoryId
            ? String(json.subCategoryId)
                .replace(/[-_]/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase())
            : null),
      exam_category_id: examCategoryId || null,
      test_type: json.testType || "full-length",
      status: json.status ? mapStatus(json.status) : "published",
      difficulty: json.difficulty || "medium",
      duration: json.duration || 60,
      total_questions: json.totalQuestions || 0,
      total_marks: json.totalMarks || 0,
      negative_marking:
        json.negativeMarking ??
        json.negative_marking ??
        json.negativeMarks ??
        0,
      is_active: true,
      is_pro: json.access?.type === "paid" || false,
      is_pyq: json.isPyq || (year ? true : false),
      year:
        year ||
        (json.year ? Number(json.year) : null) ||
        (json.title
          ? Number((String(json.title).match(/\b(19\d\d|20\d\d)\b/) || [])[0])
          : null),
      pyq_year:
        year ||
        (json.year ? Number(json.year) : null) ||
        (json.title
          ? Number((String(json.title).match(/\b(19\d\d|20\d\d)\b/) || [])[0])
          : null),
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
      category_path_ids: JSON.stringify(pathIds),
      category_path_names: JSON.stringify(pathNames),
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
      instructions: Array.isArray(json.instructions)
        ? json.instructions.join("\n")
        : json.instructions || null,
      version: json.version || 1,
      imported_from: "full-test-json",
      source_test_id: String(json.id || ""),
      content_source: storageMode === "json-file" ? "json-file" : "database",
      content_path: null,
    };

    // Dynamic columns list (skip columns that don't exist in DB yet)
    const testCols = Object.keys(testRow);

    const testPlaceholders = testCols.map((_, i) => `$${i + 1}`);
    const testSql = `
      INSERT INTO tests (${testCols.map((c) => `"${c}"`).join(", ")})
      VALUES (${testPlaceholders.join(", ")})
      RETURNING id, title, slug
    `;

    let testResult;
    if (dryRun) {
      testResult = {
        rows: [{ id: -1, title: testRow.title, slug: testRow.slug }],
      };
    } else {
      // Filter out columns that don't exist in the actual DB
      const cols = await getTableColumns(client, "tests");
      const validCols = testCols.filter((c) => cols.has(c));
      const validVals = validCols.map((c) => testRow[c]);
      const validPlaceholders = validCols.map((_, i) => `$${i + 1}`);
      const dynamicSql = `
          INSERT INTO tests (${validCols.map((c) => `"${c}"`).join(", ")})
          VALUES (${validPlaceholders.join(", ")})
          RETURNING id, title, slug
        `;
      testResult = await client.query(dynamicSql, validVals);
    }

    const testDbId = testResult.rows[0].id;
    result.testId = testDbId;

    // ── JSON-FILE MODE: save content to file, skip DB inserts for sections/questions ──

    if (storageMode === "json-file" && !dryRun) {
      const contentPayload = {
        testId: testDbId,
        title: json.title || "Untitled",
        slug,
        duration: json.duration || 60,
        totalQuestions: json.totalQuestions || 0,
        totalMarks: json.totalMarks || 0,
        negativeMarking:
          json.negativeMarking ??
          json.negative_marking ??
          json.negativeMarks ??
          0,
        sections: (json.sections || []).map((section, sIdx) => ({
          name: section.name || "Untitled Section",
          subjectId: section.subjectId || null,
          description: section.description || null,
          duration: section.duration || null,
          questionCount:
            section.questionCount || (section.questions || []).length,
          maxMarks: section.maxMarks || 0,
          negativeMarking:
            section.negativeMarking ??
            section.negative_marking ??
            section.negativeMarks ??
            0,
          mandatory: section.mandatory ?? true,
          optional: section.optional ?? false,
          qualifying: section.qualifying ?? false,
          displayOrder: getSectionDisplayOrder(
            section.name,
            section.order ?? sIdx + 1,
          ),
          instructions: section.instructions || [],
          questions: (section.questions || []).map((q, qi) => {
            const qText = q.text?.en || q.question || "";
            const qTextHi =
              q.text?.hi ||
              q.text?.hn ||
              q.text?.hin ||
              q.question_text_hi ||
              null;
            const qOptions = q.options_bilingual?.en || q.options || [];
            const qOptionsHi =
              q.options_bilingual?.hi ||
              q.options_bilingual?.hn ||
              q.options_bilingual?.hin ||
              null;
            const qExplanation =
              q.solution_bilingual?.en || q.solution || q.explanation || "";
            const qExplanationHi =
              q.solution_bilingual?.hi ||
              q.solution_bilingual?.hn ||
              q.solution_bilingual?.hin ||
              null;
            let qCorrect =
              typeof q.correctAnswer === "number"
                ? q.correctAnswer - 1
                : typeof q.correct_option_id === "number"
                  ? q.correct_option_id
                  : 0;
            return {
              id: q.id || `q-${sIdx}-${qi}`,
              externalQuestionId: String(q.id || ""),
              questionText: qText,
              questionTextHi: qTextHi,
              options: qOptions,
              optionsHi: qOptionsHi,
              correctOption: qCorrect,
              explanation: qExplanation,
              explanationHi: qExplanationHi,
              difficulty: q.difficulty || "medium",
              marks: q.marks || 2,
              negativeMarks:
                q.negativeMarks ?? q.negativeMarking ?? q.negative ?? 0,
              type: q.questionType || "mcq",
              subjectId: q.subjectId || section.subjectId || null,
              chapterId: q.chapterId || null,
              topicId: q.topicId || null,
              subtopicId: q.subtopicId || null,
              tags: q.tags || [],
              estimatedTime: q.estimatedTime || null,
              questionNumber: qi + 1,
            };
          }),
        })),
      };

      const totalQs = contentPayload.sections.reduce(
        (sum, s) => sum + s.questions.length,
        0,
      );
      contentPayload.totalQuestions = totalQs;

      const relPath = await saveTestContent(testDbId, contentPayload);

      await client.query(
        `UPDATE tests SET content_path = $1, total_questions = $2, total_marks = $3, updated_at = NOW() WHERE id = $4`,
        [relPath, totalQs, json.totalMarks || 0, testDbId],
      );

      result.sectionsCreated = contentPayload.sections.length;
      result.questionsCreated = totalQs;
      result.contentPath = relPath;

      // Log the import
      await client.query(
        `INSERT INTO import_logs (imported_by, source, file_name, imported, failed, errors, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          userId,
          "full-test-json-file",
          fileName,
          totalQs,
          0,
          JSON.stringify([]),
          JSON.stringify({
            testId: testDbId,
            testTitle: result.testTitle,
            sectionsCreated: result.sectionsCreated,
            contentPath: relPath,
            warnings: result.warnings,
          }),
        ],
      );

      await client.query("COMMIT");
      return result;
    }

    // ── 3. Process sections ────────────────────────────────────────────────

    const sections = json.sections || [];
    let globalQuestionNumber = 0;

    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const section = sections[sIdx];
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
        display_order: getSectionDisplayOrder(
          section.name,
          section.order ?? sIdx + 1,
        ),
        question_count: section.questionCount || 0,
        total_marks: section.maxMarks || 0,
        negative_marking:
          section.negativeMarking ??
          section.negative_marking ??
          section.negativeMarks ??
          0,
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
        const validCols = Object.keys(sectionRow).filter((c) => cols.has(c));
        const validVals = validCols.map((c) => sectionRow[c]);
        const validPlaceholders = validCols.map((_, i) => `$${i + 1}`);
        const sectionSql = `
          INSERT INTO test_sections (${validCols.map((c) => `"${c}"`).join(", ")})
          VALUES (${validPlaceholders.join(", ")})
          RETURNING id, name
        `;
        sectionResult = await client.query(sectionSql, validVals);
      }

      const sectionDbId = sectionResult.rows[0].id;
      result.sectionsCreated++;

      // ── 4. Process questions in this section (Batch Multi-Row Insert) ───

      const questions = section.questions || [];
      const validQRows = [];
      const seenExternalIds = new Set();

      for (let qi = 0; qi < questions.length; qi++) {
        const q = questions[qi];
        try {
          // ── Resolve subjectId on question level (may differ from section)
          const qSubjectSlug = q.subjectId || section.subjectId || "general";
          const qSubjectId = q.subjectId
            ? await resolveSubjectId(client, q.subjectId, strict)
            : subjectId;

          // ── Resolve chapter/topic/subtopic slugs to INT FK IDs
          const chapterId = q.chapterId
            ? await resolveChapterId(client, q.chapterId, qSubjectId, strict)
            : null;
          const topicId = q.topicId
            ? await resolveTopicId(
                client,
                q.topicId,
                qSubjectSlug,
                qSubjectId,
                strict,
              )
            : null;
          const subtopicId = q.subtopicId
            ? await resolveSubtopicId(client, q.subtopicId, topicId, strict)
            : null;

          // ── Bilingual text extraction (support Hindi-only questions)
          const questionText = q.text?.en || q.question || "";
          const questionTextHi =
            q.text?.hi ||
            q.text?.hn ||
            q.text?.hin ||
            q.question_text_hi ||
            null;

          const options = q.options_bilingual?.en || q.options || [];
          const optionsHi =
            q.options_bilingual?.hi ||
            q.options_bilingual?.hn ||
            q.options_bilingual?.hin ||
            null;

          const explanation =
            q.solution_bilingual?.en || q.solution || q.explanation || "";
          const explanationHi =
            q.solution_bilingual?.hi ||
            q.solution_bilingual?.hn ||
            q.solution_bilingual?.hin ||
            null;

          // ── correctAnswer: JSON is 1-indexed, DB is 0-indexed
          let correctOption =
            typeof q.correctAnswer === "number"
              ? q.correctAnswer - 1
              : typeof q.correct_option_id === "number"
                ? q.correct_option_id
                : 0;

          // ── Skip if no question text in either language
          if (!questionText && !questionTextHi) {
            result.questionsSkipped++;
            continue;
          }
          if (
            questionText &&
            questionText.trim().length < 3 &&
            (!questionTextHi || questionTextHi.trim().length < 3)
          ) {
            result.questionsSkipped++;
            continue;
          }

          // ── In-memory Dedup check
          const externalQId = String(q.id || "");
          if (skipDuplicates && externalQId) {
            if (seenExternalIds.has(externalQId)) {
              result.questionsSkipped++;
              continue;
            }
            seenExternalIds.add(externalQId);
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
            negative_marks:
              q.negativeMarks ?? q.negativeMarking ?? q.negative ?? 0,
            type: q.questionType || "mcq",
            status: mapStatus(q.status),
            section: q.section || section.name || null,
            subject_id: qSubjectId,
            test_id: testDbId,
            external_question_id: externalQId,
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

          validQRows.push({ qRow, qi, originalQ: q });
        } catch (qPrepErr) {
          result.errors.push({
            questionId: q.id || "unknown",
            sectionId: section.name || "unknown",
            message: qPrepErr.message,
          });
          result.questionsSkipped++;
        }
      }

      if (dryRun) {
        result.questionsCreated += validQRows.length;
      } else if (validQRows.length > 0) {
        const batchSavepoint = `batch_sec_${sIdx}`;
        try {
          await client.query(`SAVEPOINT ${batchSavepoint}`);

          // Batch Multi-Row Insert into questions
          const cols = await getTableColumns(client, "questions");
          const validColNames = Object.keys(validQRows[0].qRow).filter((c) =>
            cols.has(c),
          );

          const allVals = [];
          const rowPlaceholders = [];

          validQRows.forEach((item) => {
            const placeholders = [];
            validColNames.forEach((col) => {
              allVals.push(item.qRow[col]);
              placeholders.push(`$${allVals.length}`);
            });
            rowPlaceholders.push(`(${placeholders.join(", ")})`);
          });

          const batchQSql = `
            INSERT INTO questions (${validColNames.map((c) => `"${c}"`).join(", ")})
            VALUES ${rowPlaceholders.join(",\n")}
            RETURNING id, external_question_id, question_number
          `;

          const qInsertResult = await client.query(batchQSql, allVals);

          // Batch Link Questions via test_questions junction table
          const junctionVals = [];
          const junctionPlaceholders = [];

          qInsertResult.rows.forEach((insertedRow, rIdx) => {
            const qDbId = insertedRow.id;
            const qNum =
              validQRows[rIdx]?.qi !== undefined
                ? validQRows[rIdx].qi + 1
                : rIdx + 1;

            junctionVals.push(testDbId, qDbId, sectionDbId, qNum);
            const base = junctionVals.length - 3;
            junctionPlaceholders.push(
              `($${base}, $${base + 1}, $${base + 2}, $${base + 3}, NOW())`,
            );
          });

          if (junctionPlaceholders.length > 0) {
            const batchJunctionSql = `
              INSERT INTO test_questions (test_id, question_id, section_id, question_number, created_at)
              VALUES ${junctionPlaceholders.join(",\n")}
              ON CONFLICT DO NOTHING
            `;
            await client.query(batchJunctionSql, junctionVals);
          }

          await client.query(`RELEASE SAVEPOINT ${batchSavepoint}`);
          result.questionsCreated += qInsertResult.rows.length;
        } catch (batchErr) {
          try {
            await client.query(`ROLLBACK TO SAVEPOINT ${batchSavepoint}`);
          } catch (_) {
            void _;
          }
          console.warn(
            `[FullTestImporter] Batch insertion failed for section "${section.name}", falling back to sequential insert:`,
            batchErr.message,
          );

          // Safe fallback: insert sequentially with savepoints if batch failed

          for (let vi = 0; vi < validQRows.length; vi++) {
            const { qRow, qi, originalQ } = validQRows[vi];
            try {
              await client.query(`SAVEPOINT q_fb_${qi}`);
              const cols = await getTableColumns(client, "questions");
              const validCols = Object.keys(qRow).filter((c) => cols.has(c));
              const validVals = validCols.map((c) => qRow[c]);
              const validPlaceholders = validCols.map((_, i) => `$${i + 1}`);
              const qSql = `
                INSERT INTO questions (${validCols.map((c) => `"${c}"`).join(", ")})
                VALUES (${validPlaceholders.join(", ")})
                RETURNING id
              `;
              const qResult = await client.query(qSql, validVals);
              const questionDbId = qResult.rows[0].id;

              await client.query(
                `INSERT INTO test_questions (test_id, question_id, section_id, question_number, created_at)
                 VALUES ($1, $2, $3, $4, NOW())
                 ON CONFLICT DO NOTHING`,
                [testDbId, questionDbId, sectionDbId, qi + 1],
              );
              result.questionsCreated++;
            } catch (qErr) {
              try {
                await client.query(`ROLLBACK TO SAVEPOINT q_fb_${qi}`);
              } catch (_) {
                void _;
              }
              result.errors.push({
                questionId: originalQ.id || "unknown",
                sectionId: section.name || "unknown",
                message: qErr.message,
              });
              result.questionsSkipped++;
            }
          }
        }
      }

      // ── Update section question_count and total_marks
      if (!dryRun) {
        await client.query(
          `UPDATE test_sections
           SET question_count = $1, total_marks = $2, updated_at = NOW()
           WHERE id = $3`,
          [
            section.questionCount || questions.length,
            section.maxMarks || 0,
            sectionDbId,
          ],
        );
      }
    }

    // ── 5. Update test totals ──────────────────────────────────────────────

    if (!dryRun) {
      await client.query(
        `UPDATE tests
         SET total_questions = $1, total_marks = $2, updated_at = NOW()
         WHERE id = $3`,
        [result.questionsCreated, json.totalMarks || 0, testDbId],
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
        ],
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

/**
 * Validates the schema of the uploaded JSON file against the expected schema of tests, sections, and questions.
 * @param {object|array} json - The parsed JSON test data (single test or array of tests)
 * @returns {object} - An object containing { extraFields, missingFields }
 */
export function validateJsonSchema(json) {
  const sample = Array.isArray(json) ? json[0] : json;

  const extraFields = { test: [], section: [], question: [] };
  const missingFields = { test: [], section: [], question: [] };

  if (!sample) {
    return { extraFields, missingFields };
  }

  // Core expected fields
  const expectedTest = [
    "title",
    "duration",
    "totalQuestions",
    "totalMarks",
    "examCategoryId",
    "examId",
    "stageId",
    "testSeriesId",
    "categoryId",
  ];
  const expectedSection = ["name", "subjectId", "questions"];

  // Check Test level
  expectedTest.forEach((f) => {
    if (!(f in sample)) {
      missingFields.test.push(f);
    }
  });

  const knownTestKeys = new Set([
    ...expectedTest,
    "id",
    "shortTitle",
    "short_title",
    "slug",
    "description",
    "thumbnail",
    "banner",
    "testType",
    "test_type",
    "itemType",
    "item_type",
    "status",
    "difficulty",
    "isPyq",
    "is_pyq",
    "pyqYear",
    "pyq_year",
    "year",
    "pyqShift",
    "pyq_shift",
    "isLive",
    "is_live",
    "isComingSoon",
    "is_coming_soon",
    "isFeatured",
    "is_featured",
    "isActive",
    "is_active",
    "isPro",
    "is_pro",
    "isFree",
    "is_free",
    "passingMarks",
    "passing_marks",
    "cutoffMarks",
    "cutoff_marks",
    "negativeMarking",
    "negative_marking",
    "negativeMarks",
    "negMarks",
    "marksPerQuestion",
    "marks_per_question",
    "questionLanguageMode",
    "question_language_mode",
    "languages",
    "tags",
    "category",
    "subCategory",
    "sub_category",
    "subcategory",
    "subCategoryId",
    "sub_category_id",
    "examCategoryId",
    "exam_category_id",
    "examId",
    "exam_id",
    "stageId",
    "stage_id",
    "testSeriesId",
    "test_series_id",
    "categoryId",
    "category_id",
    "scheduledAt",
    "scheduled_at",
    "startTime",
    "start_time",
    "endTime",
    "end_time",
    "windowTime",
    "window_time",
    "price",
    "discountPrice",
    "discount_price",
    "currency",
    "accessType",
    "access_type",
    "showCalculator",
    "showQuestionPalette",
    "showSectionPalette",
    "showTimer",
    "allowBookmark",
    "allowReportIssue",
    "timingConfig",
    "optionalSectionConfig",
    "attemptRules",
    "analysisConfig",
    "access",
    "availability",
    "seo",
    "proctoringEnabled",
    "cameraMonitoring",
    "tabSwitchLimit",
    "copyPasteDisabled",
    "adaptiveTest",
    "adaptiveAlgorithm",
    "certificateEnabled",
    "leaderboardEnabled",
    "shuffleQuestions",
    "shuffleOptions",
    "allowReview",
    "instructions",
    "version",
    "sections",
    "createdAt",
    "updatedAt",
    "createdBy",
    "updatedBy",
    "statistics",
    "resultPublished",
    "analysisPublished",
    "recommendedFor",
    "aiGenerated",
    "aiAlgorithm",
    "cameraProctoring",
  ]);

  Object.keys(sample).forEach((k) => {
    if (!knownTestKeys.has(k)) {
      extraFields.test.push(k);
    }
  });

  // Check Section level
  const section = sample.sections?.[0];
  if (section) {
    expectedSection.forEach((f) => {
      if (!(f in section)) {
        missingFields.section.push(f);
      }
    });

    const knownSectionKeys = new Set([
      ...expectedSection,
      "id",
      "order",
      "sectionOrder",
      "section_order",
      "displayOrder",
      "display_order",
      "questionCount",
      "question_count",
      "totalQuestions",
      "total_questions",
      "maxMarks",
      "max_marks",
      "totalMarks",
      "total_marks",
      "negativeMarking",
      "negative_marking",
      "negativeMarks",
      "negMarks",
      "marksPerQuestion",
      "marks_per_question",
      "duration",
      "timeLimit",
      "time_limit",
      "mandatory",
      "optional",
      "qualifying",
      "isQualifying",
      "is_qualifying",
      "allowNavigation",
      "allow_navigation",
      "isLocked",
      "is_locked",
      "shuffleQuestions",
      "shuffle_questions",
      "instructions",
      "description",
      "subjectId",
      "subject_id",
    ]);

    Object.keys(section).forEach((k) => {
      if (!knownSectionKeys.has(k)) {
        extraFields.section.push(k);
      }
    });

    // Check Question level
    const q = section.questions?.[0];
    if (q) {
      // Check for question text (english or bilingual)
      if (
        !q.question &&
        !q.text?.en &&
        !q.text?.hn &&
        !q.question_text_hi &&
        !q.questionText
      ) {
        missingFields.question.push("question (or text)");
      }
      // Check for options
      if (
        !q.options &&
        !q.options_bilingual?.en &&
        !q.options_bilingual?.hn &&
        !q.options_hi
      ) {
        missingFields.question.push("options (or options_bilingual)");
      }
      // Check for correct answer
      if (
        q.correctAnswer === undefined &&
        q.correct_option_id === undefined &&
        q.correctOption === undefined &&
        q.correct_option === undefined
      ) {
        missingFields.question.push("correctAnswer (or correct_option_id)");
      }

      const knownQuestionKeys = new Set([
        "id",
        "questionType",
        "question_type",
        "type",
        "question",
        "questionText",
        "question_text",
        "options",
        "correctAnswer",
        "correct_answer",
        "correct_option_id",
        "correct_option",
        "correctOption",
        "solution",
        "solution_text",
        "solutionText",
        "explanation",
        "explanation_text",
        "explanationText",
        "difficulty",
        "estimatedTime",
        "estimated_time",
        "marks",
        "marksPerQuestion",
        "marks_per_question",
        "negativeMarks",
        "negative_marks",
        "negativeMarking",
        "negative_marking",
        "negative",
        "negMarks",
        "languages",
        "examCategoryIds",
        "exam_category_ids",
        "examIds",
        "exam_ids",
        "stageIds",
        "stage_ids",
        "subjectId",
        "subject_id",
        "chapterId",
        "chapter_id",
        "topicId",
        "topic_id",
        "subtopicId",
        "subtopic_id",
        "conceptIds",
        "skillIds",
        "tags",
        "chapterIds",
        "topicIds",
        "subtopicIds",
        "aiGenerated",
        "source",
        "text",
        "options_bilingual",
        "solution_bilingual",
        "section",
        "status",
        "questionTextHi",
        "question_text_hi",
        "optionsHi",
        "options_hi",
        "explanationHi",
        "explanation_hi",
        "solutionHi",
        "solution_hi",
        "questionNumber",
        "question_number",
        "externalQuestionId",
        "external_question_id",
      ]);

      Object.keys(q).forEach((k) => {
        if (!knownQuestionKeys.has(k)) {
          extraFields.question.push(k);
        }
      });
    }
  }

  return { extraFields, missingFields };
}
