import express from "express";
import {
  pool,
  ensureTestSectionsSchema,
  dbHelpers,
} from "../../infrastructure/database/postgres-helpers.js";
import { protect, admin } from "../../middleware/auth.middleware.js";
import logger from "../../infrastructure/logger/logger.js";
import { responseCache } from "../../middleware/responseCache.middleware.js";

const router = express.Router();

router.use(protect);
router.use(admin);

let schemaEnsured = false;
let schemaEnsuringPromise = null;

const ensureSchema = async () => {
  if (schemaEnsured) return;
  if (!schemaEnsuringPromise) {
    schemaEnsuringPromise = (async () => {
      try {
        await ensureTestSectionsSchema();

        await pool
          .query(
            `
          ALTER TABLE test_sections
            ADD COLUMN IF NOT EXISTS test_id INTEGER REFERENCES tests(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS test_series_id INTEGER REFERENCES test_series(id) ON DELETE CASCADE,
            ADD COLUMN IF NOT EXISTS stage_id INTEGER REFERENCES stages(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS marks_per_question NUMERIC(5,2) DEFAULT 2,
            ADD COLUMN IF NOT EXISTS negative_marks NUMERIC(5,2) DEFAULT 0.5,
            ADD COLUMN IF NOT EXISTS time_limit INTEGER DEFAULT 900,
            ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS instructions TEXT,
            ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20) DEFAULT 'medium',
            ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS shuffle_options BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS expected_questions INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS total_marks NUMERIC(7,2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS exam_stage VARCHAR(50),
            ADD COLUMN IF NOT EXISTS paper VARCHAR(100),
            ADD COLUMN IF NOT EXISTS session VARCHAR(100),
            ADD COLUMN IF NOT EXISTS section_code VARCHAR(50),
            ADD COLUMN IF NOT EXISTS is_qualifying BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS exam_alias VARCHAR(150)
        `,
          )
          .catch(() => {});

        await pool.query(`
          CREATE TABLE IF NOT EXISTS section_aliases (
            id SERIAL PRIMARY KEY,
            canonical_name VARCHAR(150) NOT NULL,
            alias_name VARCHAR(150) NOT NULL UNIQUE
          )
        `);

        const aliases = [
          [
            "General Intelligence & Reasoning",
            "General Intelligence & Reasoning",
          ],
          [
            "General Intelligence & Reasoning",
            "Reasoning & General Intelligence",
          ],
          [
            "General Intelligence & Reasoning",
            "Reasoning Ability & Problem Solving",
          ],
          ["General Intelligence & Reasoning", "Logical Reasoning"],
          ["General Awareness", "General Awareness"],
          ["General Awareness", "General Knowledge & General Awareness"],
          ["General Awareness", "General Awareness & Current Affairs"],
          ["Quantitative Aptitude", "Quantitative Aptitude"],
          ["Quantitative Aptitude", "Mathematics"],
          ["Quantitative Aptitude", "Mathematical Abilities"],
          ["Quantitative Aptitude", "Numerical & Mathematical Ability"],
          ["Quantitative Aptitude", "Elementary Mathematics"],
          ["Quantitative Aptitude", "Arithmetic"],
          ["English Language & Comprehension", "English"],
          ["English Language & Comprehension", "English Comprehension"],
          ["English Language & Comprehension", "English Language"],
          [
            "English Language & Comprehension",
            "English Language & Comprehension",
          ],
          ["English Language & Comprehension", "English / Hindi"],
          ["General Science", "General Science"],
          ["General Science", "Basic Science & Engineering"],
          ["Computer Knowledge Test", "Computer Knowledge Test"],
          ["Statistics", "Statistics"],
          [
            "General Engineering",
            "General Engineering (Civil/Electrical/Mechanical)",
          ],
          ["Trade Specific", "Trade Specific (as per trade)"],
          ["Data Entry Speed Test", "Data Entry Speed Test (DEST)"],
        ];

        // Single batch INSERT for aliases
        const canonList = aliases.map((a) => a[0]);
        const aliasList = aliases.map((a) => a[1]);
        await pool
          .query(
            `INSERT INTO section_aliases (canonical_name, alias_name)
           SELECT * FROM UNNEST($1::text[], $2::text[])
           ON CONFLICT (alias_name) DO UPDATE SET canonical_name = EXCLUDED.canonical_name`,
            [canonList, aliasList],
          )
          .catch(() => {});
        invalidateAliasCache();

        schemaEnsured = true;
      } catch (error) {
        logger.error("[Sections] Schema ensure error:", error);
      } finally {
        schemaEnsuringPromise = null;
      }
    })();
  }
  return schemaEnsuringPromise;
};

// Initialize schema in background without blocking incoming HTTP requests
ensureSchema().catch(() => {});

const VALID_DIFFICULTIES = ["easy", "medium", "hard"];

let sectionAliasCache = null;
let sectionAliasCacheAt = 0;
const ALIAS_CACHE_TTL_MS = 60_000;

async function loadSectionAliases() {
  const now = Date.now();
  if (sectionAliasCache && now - sectionAliasCacheAt < ALIAS_CACHE_TTL_MS) {
    return sectionAliasCache;
  }
  try {
    const { rows } = await pool.query(
      `SELECT canonical_name, alias_name FROM section_aliases ORDER BY canonical_name`,
    );
    const map = {};
    for (const row of rows) {
      map[row.alias_name.toLowerCase()] = row.canonical_name;
    }
    sectionAliasCache = map;
    sectionAliasCacheAt = now;
    return map;
  } catch {
    return {};
  }
}

async function resolveCanonical(alias) {
  const map = await loadSectionAliases();
  return map[(alias || "").toLowerCase()] || alias;
}

function invalidateAliasCache() {
  sectionAliasCache = null;
}

function validateSectionInput(body, isUpdate = false) {
  const errors = [];
  const { name, difficulty, time_limit, marks_per_question, negative_marks } =
    body;

  if (!isUpdate) {
    if (!name || !String(name).trim()) errors.push("name is required");
  } else if (name !== undefined && !String(name).trim()) {
    errors.push("name cannot be empty");
  }

  if (difficulty !== undefined && !VALID_DIFFICULTIES.includes(difficulty)) {
    errors.push(`difficulty must be one of: ${VALID_DIFFICULTIES.join(", ")}`);
  }

  if (time_limit !== undefined && time_limit !== null) {
    const tl = Number(time_limit);
    if (isNaN(tl) || tl < 0)
      errors.push("time_limit must be a non-negative number");
  }

  if (marks_per_question !== undefined && marks_per_question !== null) {
    const mpq = Number(marks_per_question);
    if (isNaN(mpq) || mpq < 0)
      errors.push("marks_per_question must be a non-negative number");
  }

  if (negative_marks !== undefined && negative_marks !== null) {
    const nm = Number(negative_marks);
    if (isNaN(nm) || nm < 0)
      errors.push("negative_marks must be a non-negative number");
    if (marks_per_question !== undefined && nm > Number(marks_per_question)) {
      errors.push("negative_marks cannot exceed marks_per_question");
    }
  }

  return errors;
}

async function resolveSectionIds(body) {
  const result = { ...body };
  const resolveId = async (table, value) => {
    if (!value) return null;
    if (/^\d+$/.test(String(value))) return Number(value);
    const { rows } = await pool.query(
      `SELECT id FROM "${table}" WHERE public_id = $1 LIMIT 1`,
      [value],
    );
    return rows[0]?.id || null;
  };
  if (result.test_series_id) {
    const resolved = await resolveId("test_series", result.test_series_id);
    if (resolved !== null) result.test_series_id = resolved;
  }
  if (result.stage_id) {
    const resolved = await resolveId("stages", result.stage_id);
    if (resolved !== null) result.stage_id = resolved;
  }
  if (result.test_id) {
    const resolved = await resolveId("tests", result.test_id);
    if (resolved !== null) result.test_id = resolved;
  }
  return result;
}

// GET /batch — fetch all sections-related data in one request (reduces connection pressure)
router.get(
  "/batch",
  protect,
  admin,
  responseCache("admin-sections-batch", 60),
  async (req, res) => {
    try {
      const { scope, testSeriesId, stageId, testId } = req.query;

      const resolveId = async (table, value) => {
        if (!value) return null;
        if (/^\d+$/.test(String(value))) return Number(value);
        const { rows } = await pool.query(
          `SELECT id FROM "${table}" WHERE public_id = $1 LIMIT 1`,
          [value],
        );
        return rows[0]?.id || null;
      };

      let resolvedTestSeriesId = testSeriesId
        ? await resolveId("test_series", testSeriesId)
        : null;
      let resolvedStageId = stageId ? await resolveId("stages", stageId) : null;
      let resolvedTestId = testId ? await resolveId("tests", testId) : null;

      const batchData = await Promise.allSettled([
        dbHelpers.find("testCategories"),
        dbHelpers.find("tests"),
        dbHelpers.find("testSeries"),
        dbHelpers.find("stages"),
        dbHelpers.find("examCategories"),
        dbHelpers.find("exams"),
      ]).then((results) => ({
        categories: results[0].status === "fulfilled" ? results[0].value : [],
        tests: results[1].status === "fulfilled" ? results[1].value : [],
        series: results[2].status === "fulfilled" ? results[2].value : [],
        stages: results[3].status === "fulfilled" ? results[3].value : [],
        examCategories:
          results[4].status === "fulfilled" ? results[4].value : [],
        exams: results[5].status === "fulfilled" ? results[5].value : [],
      }));

      res.json({ success: true, data: batchData });
    } catch (error) {
      logger.error("[Sections] Batch error:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

// GET / — list sections (supports scope, testId, testSeriesId, stageId filters)
router.get(
  "/",
  protect,
  admin,
  responseCache("admin-sections", 60),
  async (req, res) => {
    try {
      let { testId, testSeriesId, stageId, scope, onlyLinked } = req.query;

      // Resolve public_ids (like ser_xxx, stg_xxx, tst_xxx) to numeric ids
      const resolveId = async (table, value) => {
        if (!value) return null;
        if (/^\d+$/.test(value)) return Number(value);
        const { rows } = await pool.query(
          `SELECT id FROM "${table}" WHERE public_id = $1 LIMIT 1`,
          [value],
        );
        return rows[0]?.id || null;
      };

      if (testId) testId = await resolveId("tests", testId);
      if (testSeriesId)
        testSeriesId = await resolveId("test_series", testSeriesId);
      if (stageId) stageId = await resolveId("stages", stageId);

      // Optimized CTEs: aggregate question counts and linked exams using fast set operations
      let query = `
      WITH deduped AS (
        SELECT ts.*,
               ROW_NUMBER() OVER (
                 PARTITION BY LOWER(name), COALESCE(test_id, 0), COALESCE(test_series_id, 0), COALESCE(stage_id, 0)
                 ORDER BY id
               ) as rn
        FROM test_sections ts
      ),
      section_aliases_agg AS (
        SELECT canonical_name, string_agg(alias_name, ', ') as aliases_list
        FROM section_aliases
        GROUP BY canonical_name
      ),
      raw_question_counts AS (
        SELECT q.section, COUNT(*)::int as cnt
        FROM questions q
        WHERE q.is_active = true AND q.section IS NOT NULL
          ${testId ? "AND q.test_id = $1" : ""}
        GROUP BY q.section
      ),
      question_counts AS (
        SELECT
          COALESCE(sa.canonical_name, rqc.section) as resolved_name,
          SUM(rqc.cnt)::int as cnt
        FROM raw_question_counts rqc
        LEFT JOIN section_aliases sa ON LOWER(sa.alias_name) = LOWER(rqc.section)
        GROUP BY COALESCE(sa.canonical_name, rqc.section)
      ),
      linked_exams_agg AS (
        SELECT
          COALESCE(sa2.canonical_name, ts2.name) as resolved_name,
          string_agg(DISTINCT COALESCE(e.title, tsr.title, t.title), ', ') as linked_exams
        FROM test_sections ts2
        LEFT JOIN section_aliases sa2 ON LOWER(sa2.alias_name) = LOWER(ts2.name)
        LEFT JOIN test_series tsr ON ts2.test_series_id = tsr.id
        LEFT JOIN tests t ON ts2.test_id = t.id
        LEFT JOIN exams e ON e.id = COALESCE(tsr.exam_id, t.exam_id)
        WHERE (ts2.test_id IS NOT NULL OR ts2.test_series_id IS NOT NULL)
        GROUP BY COALESCE(sa2.canonical_name, ts2.name)
      )
      SELECT d.*,
             tc.name as category_name,
             tc.slug as category_slug,
             t.title as test_title,
             tsr.title as test_series_title,
             st.name as stage_name,
             COALESCE(qc.cnt, 0) as question_count,
             saa.aliases_list,
             lea.linked_exams
      FROM deduped d
      LEFT JOIN test_categories tc ON d.category_id = tc.id
      LEFT JOIN tests t ON d.test_id = t.id
      LEFT JOIN test_series tsr ON d.test_series_id = tsr.id
      LEFT JOIN stages st ON d.stage_id = st.id
      LEFT JOIN question_counts qc ON qc.resolved_name = d.name
      LEFT JOIN section_aliases_agg saa ON saa.canonical_name = d.name
      LEFT JOIN linked_exams_agg lea ON lea.resolved_name = d.name
    `;

      const params = [];
      const where = ["d.rn = 1"];
      const pushParam = (value) => {
        params.push(value);
        return `$${params.length}`;
      };

      if (testId) {
        where.push(`d.test_id = ${pushParam(testId)}`);
      }

      if (testSeriesId && stageId) {
        where.push(
          `(d.test_series_id = ${pushParam(testSeriesId)} AND (d.stage_id = ${pushParam(stageId)} OR d.stage_id IS NULL))`,
        );
      } else if (testSeriesId) {
        where.push(`d.test_series_id = ${pushParam(testSeriesId)}`);
      } else if (stageId) {
        where.push(`d.stage_id = ${pushParam(stageId)}`);
      }

      if (scope === "templates") {
        where.push(
          "d.test_id IS NULL AND d.test_series_id IS NULL AND d.stage_id IS NULL",
        );
      } else if (scope === "linking") {
        where.push(
          "d.test_id IS NULL AND (d.test_series_id IS NOT NULL OR d.stage_id IS NOT NULL)",
        );
      } else if (onlyLinked === "true") {
        where.push(
          "d.test_series_id IS NOT NULL OR d.stage_id IS NOT NULL OR d.test_id IS NOT NULL",
        );
      }

      if (where.length) {
        query += ` WHERE ${where.join(" AND ")}`;
      }

      query += ` ORDER BY d.test_series_id NULLS FIRST, d.stage_id NULLS FIRST, d.display_order, d.id`;

      const { rows } = await pool.query(query, params);
      res.json({ success: true, data: rows });
    } catch (error) {
      logger.error("[Sections] Get error:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

// GET /for-test — resolve sections for a test via fallback chain
// MUST be before /:id to avoid being caught by the param route
router.get("/for-test", protect, admin, async (req, res) => {
  try {
    let { testId, testSeriesId, stageId } = req.query;

    // Resolve public_ids to numeric ids
    const resolveId = async (table, value) => {
      if (!value) return null;
      if (/^\d+$/.test(value)) return Number(value);
      const { rows } = await pool.query(
        `SELECT id FROM "${table}" WHERE public_id = $1 LIMIT 1`,
        [value],
      );
      return rows[0]?.id || null;
    };

    if (testId) testId = await resolveId("tests", testId);
    if (testSeriesId)
      testSeriesId = await resolveId("test_series", testSeriesId);
    if (stageId) stageId = await resolveId("stages", stageId);

    let seriesId = testSeriesId ? Number(testSeriesId) : null;
    let stage = stageId ? Number(stageId) : null;
    if (testId && (!seriesId || !stage)) {
      const { rows } = await pool.query(
        "SELECT series_id, stage_id FROM tests WHERE id = $1",
        [testId],
      );
      if (rows[0]) {
        if (!seriesId) seriesId = rows[0].series_id || null;
        if (!stage) stage = rows[0].stage_id || null;
      }
    }

    // 1) Test-specific sections (highest priority).
    let scoped = [];
    if (testId) {
      const { rows } = await pool.query(
        `SELECT ts.*, 'test'::text as source
         FROM test_sections ts
         WHERE ts.test_id = $1`,
        [testId],
      );
      scoped = rows;
    }

    // 2) Series+stage sections (default template for that scope).
    if (seriesId) {
      const { rows } = await pool.query(
        `SELECT ts.*, 'series_stage'::text as source
         FROM test_sections ts
         WHERE ts.test_series_id = $1
           AND (ts.stage_id = $2 OR ts.stage_id IS NULL)
           AND ts.test_id IS NULL`,
        [seriesId, stage],
      );
      scoped = scoped.concat(rows);
    }

    // 3) Pure defaults (no linkage at all) — always included as last fallback.
    const { rows: defaults } = await pool.query(
      `SELECT ts.*, 'default'::text as source
       FROM test_sections ts
       WHERE ts.test_id IS NULL AND ts.test_series_id IS NULL AND ts.stage_id IS NULL`,
    );
    scoped = scoped.concat(defaults);

    res.json({ success: true, data: scoped });
  } catch (error) {
    logger.error("[Sections] for-test error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /preset — apply a preset section scheme
// MUST be before /:id to avoid being caught by the param route
router.post("/preset", protect, admin, async (req, res) => {
  try {
    let { testId, testSeriesId, stageId, sections: presetSections } = req.body;

    const resolveId = async (table, value) => {
      if (!value) return null;
      if (/^\d+$/.test(String(value))) return Number(value);
      const { rows } = await pool.query(
        `SELECT id FROM "${table}" WHERE public_id = $1 LIMIT 1`,
        [value],
      );
      return rows[0]?.id || null;
    };

    if (testId) {
      const resolved = await resolveId("tests", testId);
      if (resolved !== null) testId = resolved;
    }
    if (testSeriesId) {
      const resolved = await resolveId("test_series", testSeriesId);
      if (resolved !== null) testSeriesId = resolved;
    }
    if (stageId) {
      const resolved = await resolveId("stages", stageId);
      if (resolved !== null) stageId = resolved;
    }

    if (!Array.isArray(presetSections) || presetSections.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "sections array required" });
    }
    if (!testId && !(testSeriesId && stageId)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Either testId or (testSeriesId + stageId) is required",
        });
    }

    const results = { linked: [], created: [], skipped: [] };

    const matchExisting = async (canonicalName) => {
      if (testId) {
        const { rows } = await pool.query(
          "SELECT id, test_id FROM test_sections WHERE LOWER(name) = LOWER($1) ORDER BY id LIMIT 1",
          [canonicalName],
        );
        return rows[0] || null;
      }
      const { rows } = await pool.query(
        `SELECT id, test_id FROM test_sections
         WHERE LOWER(name) = LOWER($1)
           AND test_series_id = $2 AND stage_id = $3
         ORDER BY id LIMIT 1`,
        [canonicalName, testSeriesId, stageId],
      );
      return rows[0] || null;
    };

    for (const section of presetSections) {
      const { name: alias } = section;
      if (!alias) continue;

      const canonicalName = await resolveCanonical(alias);
      const examAlias = alias !== canonicalName ? alias : null;

      const existing = await matchExisting(canonicalName);

      if (existing) {
        if (testId && String(existing.test_id) === String(testId)) {
          results.skipped.push({
            id: existing.id,
            name: canonicalName,
            alias: examAlias,
            reason: "already linked",
          });
          continue;
        }
        if (testId) {
          await pool.query(
            `UPDATE test_sections SET test_id = $1, updated_at = NOW() WHERE id = $2`,
            [testId, existing.id],
          );
          results.linked.push({
            id: existing.id,
            name: canonicalName,
            alias: examAlias,
          });
        } else {
          results.skipped.push({
            id: existing.id,
            name: canonicalName,
            alias: examAlias,
            reason: "already in scope",
          });
        }
      } else {
        const { rows: inserted } = await pool.query(
          `
          INSERT INTO test_sections (
            name, exam_alias, test_id, test_series_id, stage_id, description, duration, passing_marks,
            is_active, display_order, marks_per_question, negative_marks,
            time_limit, is_locked, instructions, difficulty,
            shuffle_questions, shuffle_options, expected_questions, total_marks,
            exam_stage, paper, session, section_code, is_qualifying
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
          RETURNING id, name, exam_alias
        `,
          [
            canonicalName,
            examAlias,
            testId || null,
            testSeriesId || null,
            stageId || null,
            section.description || "",
            section.duration || 15,
            section.passing_marks || 0,
            true,
            section.display_order || 0,
            section.marks_per_question ?? 2,
            section.negative_marks ?? 0.5,
            section.time_limit ?? 900,
            false,
            section.instructions || "",
            "medium",
            false,
            false,
            section.expected_questions ?? 0,
            section.total_marks ?? 0,
            section.exam_stage || null,
            section.paper || null,
            section.session || null,
            section.section_code || null,
            section.is_qualifying || false,
          ],
        );
        results.created.push({
          id: inserted[0].id,
          name: canonicalName,
          alias: examAlias,
        });
      }
    }

    res.json({ success: true, data: results });
  } catch (error) {
    logger.error("[Sections] Apply preset error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /dedup — remove duplicate sections, keeping the oldest (lowest id) of each name+scope group
// Also removes logical duplicates of the 10 canonical template names
router.post("/dedup", protect, admin, async (req, res) => {
  try {
    // Canonical template names (lowercase)
    const CANONICAL = new Set([
      "general intelligence & reasoning",
      "general awareness",
      "english language & comprehension",
      "quantitative aptitude",
      "general science",
      "computer knowledge test",
      "statistics",
      "general engineering",
      "trade specific",
      "data entry speed test",
    ]);

    // Fetch all sections
    const { rows: allSections } = await pool.query(`
      SELECT id, LOWER(name) as name_lower, test_id, test_series_id, stage_id
      FROM test_sections
      ORDER BY id
    `);

    // 1. Group exact name + scope duplicates
    const exactGroups = {};
    for (const sec of allSections) {
      const scopeKey = `${sec.test_id || 0}_${sec.test_series_id || 0}_${sec.stage_id || 0}`;
      const nameKey = String(sec.name_lower || "").trim();
      const key = `${scopeKey}::${nameKey}`;
      if (!exactGroups[key]) exactGroups[key] = [];
      exactGroups[key].push(sec.id);
    }

    // 2. Group logical template duplicates
    const aliasMap = await loadSectionAliases();
    const templates = allSections.filter(
      (s) =>
        s.test_id === null && s.test_series_id === null && s.stage_id === null,
    );
    const templateGroups = {};
    for (const t of templates) {
      const canonical =
        aliasMap[t.name_lower] ||
        (CANONICAL.has(t.name_lower) ? t.name_lower : null);
      if (canonical) {
        const canonicalKey = canonical.toLowerCase().trim();
        if (!templateGroups[canonicalKey]) templateGroups[canonicalKey] = [];
        templateGroups[canonicalKey].push(t.id);
      }
    }

    // Combine into a merge instructions map: duplicate_id -> keeper_id
    const mergeMap = {};

    // Process exact duplicates
    for (const [, ids] of Object.entries(exactGroups)) {
      if (ids.length > 1) {
        const keeper = ids[0];
        for (let i = 1; i < ids.length; i++) {
          mergeMap[ids[i]] = keeper;
        }
      }
    }

    // Process logical template duplicates
    for (const [, ids] of Object.entries(templateGroups)) {
      if (ids.length > 1) {
        const keeper = ids[0];
        for (let i = 1; i < ids.length; i++) {
          mergeMap[ids[i]] = keeper;
        }
      }
    }

    const allDupesToDelete = Object.keys(mergeMap).map(Number);

    if (allDupesToDelete.length === 0) {
      return res.json({
        success: true,
        data: { deleted: 0, message: "No duplicates found" },
      });
    }

    // Discover all tables in public schema with section_id column to update them
    const { rows: tables } = await pool.query(`
      SELECT table_name
      FROM information_schema.columns
      WHERE column_name = 'section_id'
        AND table_schema = 'public'
    `);
    const tableNames = tables
      .map((t) => t.table_name)
      .filter((t) => t !== "test_sections");

    // Re-link duplicate section_id references to their keepers
    for (const [dupeIdStr, keeperId] of Object.entries(mergeMap)) {
      const dupeId = Number(dupeIdStr);
      for (const tableName of tableNames) {
        await pool
          .query(
            `UPDATE "${tableName}" SET section_id = $1 WHERE section_id = $2`,
            [keeperId, dupeId],
          )
          .catch((e) =>
            logger.error(`[Dedup] Re-linking error in "${tableName}":`, e),
          );
      }
    }

    // Delete the duplicates from test_sections
    const deleteRes = await pool.query(
      "DELETE FROM test_sections WHERE id = ANY($1::int[])",
      [allDupesToDelete],
    );

    res.json({ success: true, data: { deleted: deleteRes.rowCount } });
  } catch (error) {
    logger.error("[Sections] Dedup error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /seed-templates — create the 10 unique template sections (idempotent)
router.post("/seed-templates", protect, admin, async (req, res) => {
  try {
    const TEMPLATES = [
      {
        name: "General Intelligence & Reasoning",
        display_order: 1,
        expected_questions: 25,
        total_marks: 50,
        marks_per_question: 2,
        negative_marks: 0.5,
        time_limit: 900,
      },
      {
        name: "General Awareness",
        display_order: 2,
        expected_questions: 25,
        total_marks: 50,
        marks_per_question: 2,
        negative_marks: 0.5,
        time_limit: 900,
      },
      {
        name: "English Language & Comprehension",
        display_order: 3,
        expected_questions: 25,
        total_marks: 50,
        marks_per_question: 2,
        negative_marks: 0.5,
        time_limit: 900,
      },
      {
        name: "Quantitative Aptitude",
        display_order: 4,
        expected_questions: 25,
        total_marks: 50,
        marks_per_question: 2,
        negative_marks: 0.5,
        time_limit: 900,
      },
      {
        name: "General Science",
        display_order: 5,
        expected_questions: 25,
        total_marks: 50,
        marks_per_question: 2,
        negative_marks: 0.5,
        time_limit: 900,
      },
      {
        name: "Computer Knowledge Test",
        display_order: 6,
        expected_questions: 20,
        total_marks: 60,
        marks_per_question: 3,
        negative_marks: 1,
        time_limit: 900,
        is_qualifying: true,
      },
      {
        name: "Statistics",
        display_order: 7,
        expected_questions: 100,
        total_marks: 200,
        marks_per_question: 2,
        negative_marks: 0.5,
        time_limit: 7200,
      },
      {
        name: "General Engineering",
        display_order: 8,
        expected_questions: 100,
        total_marks: 100,
        marks_per_question: 1,
        negative_marks: 0.25,
        time_limit: 7200,
      },
      {
        name: "Trade Specific",
        display_order: 9,
        expected_questions: 75,
        total_marks: 75,
        marks_per_question: 1,
        negative_marks: 0.33,
        time_limit: 3600,
      },
      {
        name: "Data Entry Speed Test",
        display_order: 10,
        expected_questions: 0,
        total_marks: 0,
        marks_per_question: 0,
        negative_marks: 0,
        time_limit: 900,
        is_qualifying: true,
      },
    ];

    // Only insert templates that don't already exist (by name, no scope)
    const { rows: existing } = await pool.query(
      `SELECT LOWER(name) as name FROM test_sections WHERE test_id IS NULL AND test_series_id IS NULL AND stage_id IS NULL`,
    );
    const existingNames = new Set(existing.map((r) => r.name));

    const toInsert = TEMPLATES.filter(
      (t) => !existingNames.has(t.name.toLowerCase()),
    );
    if (toInsert.length === 0) {
      return res.json({
        success: true,
        data: { created: 0, message: "All templates already exist" },
      });
    }

    const created = [];
    for (const t of toInsert) {
      const { rows } = await pool.query(
        `INSERT INTO test_sections (name, description, duration, passing_marks, is_active, display_order, marks_per_question, negative_marks, time_limit, is_locked, instructions, difficulty, shuffle_questions, shuffle_options, expected_questions, total_marks, is_qualifying)
         VALUES ($1, $2, $3, 0, true, $4, $5, $6, $7, false, '', 'medium', false, false, $8, $9, $10)
         RETURNING id, name`,
        [
          t.name,
          `Template section — ${t.name}`,
          Math.round(t.time_limit / 60),
          t.display_order,
          t.marks_per_question,
          t.negative_marks,
          t.time_limit,
          t.expected_questions,
          t.total_marks,
          t.is_qualifying || false,
        ],
      );
      created.push(rows[0]);
    }

    res.json({
      success: true,
      data: { created: created.length, sections: created },
    });
  } catch (error) {
    logger.error("[Sections] Seed templates error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /aliases — list all aliases grouped by canonical name
router.get(
  "/aliases",
  protect,
  admin,
  responseCache("admin-section-aliases", 60),
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        "SELECT id, canonical_name, alias_name FROM section_aliases ORDER BY canonical_name, alias_name",
      );
      res.json({ success: true, data: rows });
    } catch (error) {
      logger.error("[Sections] Get aliases error:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

// POST /aliases — create a new alias
router.post("/aliases", protect, admin, async (req, res) => {
  try {
    const { canonical_name, alias_name } = req.body;
    if (!canonical_name?.trim() || !alias_name?.trim()) {
      return res
        .status(400)
        .json({
          success: false,
          message: "canonical_name and alias_name are required",
        });
    }
    const { rows } = await pool.query(
      "INSERT INTO section_aliases (canonical_name, alias_name) VALUES ($1, $2) RETURNING *",
      [canonical_name.trim(), alias_name.trim()],
    );
    invalidateAliasCache();
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ success: false, message: "Alias already exists" });
    }
    logger.error("[Sections] Create alias error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// PUT /aliases/:id — update an alias
router.put("/aliases/:id", protect, admin, async (req, res) => {
  try {
    const { id } = req.params;
    const { canonical_name, alias_name } = req.body;
    if (!canonical_name?.trim() || !alias_name?.trim()) {
      return res
        .status(400)
        .json({
          success: false,
          message: "canonical_name and alias_name are required",
        });
    }
    const { rows } = await pool.query(
      "UPDATE section_aliases SET canonical_name = $1, alias_name = $2 WHERE id = $3 RETURNING *",
      [canonical_name.trim(), alias_name.trim(), id],
    );
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Alias not found" });
    }
    invalidateAliasCache();
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ success: false, message: "Alias already exists" });
    }
    logger.error("[Sections] Update alias error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// DELETE /aliases/:id — delete an alias
router.delete("/aliases/:id", protect, admin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM section_aliases WHERE id = $1", [id]);
    invalidateAliasCache();
    res.json({ success: true, message: "Alias deleted" });
  } catch (error) {
    logger.error("[Sections] Delete alias error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /:id — single section by ID (MUST be after /aliases, /for-test, /preset, /dedup, /seed-templates)
router.get("/:id", protect, admin, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `
      SELECT ts.*,
             tc.name as category_name,
             tc.slug as category_slug
      FROM test_sections ts
      LEFT JOIN test_categories tc ON ts.category_id = tc.id
      WHERE ts.id = $1
    `,
      [id],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Section not found" });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    logger.error("[Sections] Get by ID error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST / — create a new section
router.post("/", protect, admin, async (req, res) => {
  try {
    const validationErrors = validateSectionInput(req.body, false);
    if (validationErrors.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: validationErrors.join("; ") });
    }

    const resolved = await resolveSectionIds(req.body);

    const {
      name,
      category_id,
      test_id,
      test_series_id,
      stage_id,
      description,
      duration,
      passing_marks,
      is_active,
      display_order,
      marks_per_question,
      negative_marks,
      time_limit,
      is_locked,
      instructions,
      difficulty,
      shuffle_questions,
      shuffle_options,
      expected_questions,
      total_marks,
      exam_stage,
      paper,
      session,
      section_code,
      is_qualifying,
      exam_alias,
    } = resolved;

    const { rows } = await pool.query(
      `
      INSERT INTO test_sections (
        name, category_id, test_id, test_series_id, stage_id, description,
        duration, passing_marks, is_active, display_order,
        marks_per_question, negative_marks, time_limit, is_locked,
        instructions, difficulty, shuffle_questions, shuffle_options,
        expected_questions, total_marks, exam_stage, paper, session,
        section_code, is_qualifying, exam_alias
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
      RETURNING *
    `,
      [
        name,
        category_id || null,
        test_id || null,
        test_series_id || null,
        stage_id || null,
        description || null,
        duration || 60,
        passing_marks || 0,
        is_active !== false,
        display_order || 0,
        marks_per_question ?? 2,
        negative_marks ?? 0.5,
        time_limit ?? 900,
        is_locked || false,
        instructions || "",
        difficulty || "medium",
        shuffle_questions || false,
        shuffle_options || false,
        expected_questions ?? 0,
        total_marks ?? 0,
        exam_stage || null,
        paper || null,
        session || null,
        section_code || null,
        is_qualifying || false,
        exam_alias || null,
      ],
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    logger.error("[Sections] Create error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// PUT /:id — update a section
router.put("/:id", protect, admin, async (req, res) => {
  try {
    const { id } = req.params;

    const validationErrors = validateSectionInput(req.body, true);
    if (validationErrors.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: validationErrors.join("; ") });
    }

    const resolved = await resolveSectionIds(req.body);

    const {
      name,
      category_id,
      test_id,
      test_series_id,
      stage_id,
      description,
      duration,
      passing_marks,
      is_active,
      display_order,
      marks_per_question,
      negative_marks,
      time_limit,
      is_locked,
      instructions,
      difficulty,
      shuffle_questions,
      shuffle_options,
      expected_questions,
      total_marks,
      exam_stage,
      paper,
      session,
      section_code,
      is_qualifying,
      exam_alias,
    } = resolved;

    const { rows } = await pool.query(
      `
      UPDATE test_sections
      SET name = COALESCE($1, name),
          category_id = COALESCE($2, category_id),
          test_id = COALESCE($3, test_id),
          test_series_id = COALESCE($4, test_series_id),
          stage_id = COALESCE($5, stage_id),
          description = COALESCE($6, description),
          duration = COALESCE($7, duration),
          passing_marks = COALESCE($8, passing_marks),
          is_active = COALESCE($9, is_active),
          display_order = COALESCE($10, display_order),
          marks_per_question = COALESCE($11, marks_per_question),
          negative_marks = COALESCE($12, negative_marks),
          time_limit = COALESCE($13, time_limit),
          is_locked = COALESCE($14, is_locked),
          instructions = COALESCE($15, instructions),
          difficulty = COALESCE($16, difficulty),
          shuffle_questions = COALESCE($17, shuffle_questions),
          shuffle_options = COALESCE($18, shuffle_options),
          expected_questions = COALESCE($19, expected_questions),
          total_marks = COALESCE($20, total_marks),
          exam_stage = COALESCE($21, exam_stage),
          paper = COALESCE($22, paper),
          session = COALESCE($23, session),
          section_code = COALESCE($24, section_code),
          is_qualifying = COALESCE($25, is_qualifying),
          exam_alias = COALESCE($27, exam_alias),
          updated_at = NOW()
      WHERE id = $26
      RETURNING *
    `,
      [
        name,
        category_id,
        test_id,
        test_series_id,
        stage_id,
        description,
        duration,
        passing_marks,
        is_active,
        display_order,
        marks_per_question,
        negative_marks,
        time_limit,
        is_locked,
        instructions,
        difficulty,
        shuffle_questions,
        shuffle_options,
        expected_questions,
        total_marks,
        exam_stage,
        paper,
        session,
        section_code,
        is_qualifying,
        id,
        exam_alias || null,
      ],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Section not found" });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    logger.error("[Sections] Update error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// DELETE /:id — delete a section
router.delete("/:id", protect, admin, async (req, res) => {
  try {
    const { id } = req.params;

    const { rows: sectionRows } = await pool.query(
      "SELECT id, name FROM test_sections WHERE id = $1",
      [id],
    );
    if (sectionRows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Section not found" });
    }

    const { rows: questionRows } = await pool.query(
      "SELECT COUNT(*)::int as count FROM questions WHERE (section::text = $1 OR section = $2) AND is_active = true",
      [String(id), sectionRows[0].name],
    );
    const questionCount = questionRows[0]?.count || 0;

    await pool.query("DELETE FROM test_sections WHERE id = $1", [id]);

    res.json({
      success: true,
      message: "Section deleted",
      data: { deletedQuestions: questionCount },
    });
  } catch (error) {
    logger.error("[Sections] Delete error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ─── Section Alias CRUD ───────────────────────────────────────────
export default router;
