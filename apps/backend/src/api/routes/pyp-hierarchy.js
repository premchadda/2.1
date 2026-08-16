import express from 'express';
import { pool, dbHelpers } from '../../infrastructure/database/postgres-helpers.js';
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = express.Router();

const PYP_WHERE = `(is_pyq = true OR category = 'PYPs' OR 'pyp' = ANY(tags) OR 'previous-year' = ANY(tags))`;

function toCamel(row) {
  return dbHelpers.toCamel(row);
}

function formatAttemptCount(count) {
  const n = parseInt(count, 10) || 0;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function parseShiftFromTitle(title) {
  if (!title) return null;
  const m = title.match(/shift\s*[-:]?\s*(\d+)/i);
  return m ? m[1] : null;
}

function parseDateFromTitle(title) {
  if (!title) return null;
  const m = title.match(/(\d{1,2}\s+\w+\s+\d{4})/i);
  return m ? m[1] : null;
}

function extractYear(test) {
  if (test.pyqYear) return test.pyqYear;
  if (test.year) return test.year;
  if (test.subCategory && /^\d{4}$/.test(String(test.subCategory))) return parseInt(test.subCategory, 10);
  if (test.title) {
    const m = test.title.match(/\b(20\d{2})\b/);
    if (m) return parseInt(m[1], 10);
  }
  if (Array.isArray(test.tags)) {
    for (const t of test.tags) {
      if (/^20\d{2}$/.test(String(t))) return parseInt(t, 10);
    }
  }
  return null;
}

function normalizePyp(row) {
  const t = toCamel(row);
  return {
    ...t,
    pyqYear: extractYear(t),
    shift: t.shift || parseShiftFromTitle(t.title),
    examDate: parseDateFromTitle(t.title),
    attemptCountFormatted: formatAttemptCount(t.attemptCount || 0),
  };
}

// ============================================================
// L0/L1: GET /api/pyps and GET /api/pyps/categories
// Returns exam categories with PYP paper counts + year ranges
// ============================================================
const getPypCategoriesHandler = async (req, res) => {
  try {
    const catsRes = await pool.query(`
      SELECT ec.id, ec.slug, ec.label, ec.icon, ec.description, ec.category_id,
             COUNT(t.id) AS paper_count,
             MIN(t.pyq_year) AS min_year,
             MAX(t.pyq_year) AS max_year,
             COALESCE(SUM(t.attempt_count), 0) AS total_attempts
      FROM exam_categories ec
      LEFT JOIN tests t ON t.exam_category_id = ec.id
        AND t.is_active = true
        AND (t.is_pyq = true OR t.category = 'PYPs' OR 'pyp' = ANY(t.tags) OR 'previous-year' = ANY(t.tags))
      WHERE ec.is_active = true OR ec.is_active IS NULL
      GROUP BY ec.id, ec.slug, ec.label, ec.icon, ec.description, ec.category_id
      ORDER BY COUNT(t.id) DESC, ec.order ASC NULLS LAST
    `);

    const categories = catsRes.rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.label,
      categoryId: r.category_id,
      icon: r.icon,
      description: r.description,
      paperCount: parseInt(r.paper_count, 10) || 0,
      yearRange: r.min_year && r.max_year ? `${r.min_year}–${r.max_year}` : null,
      totalAttempts: parseInt(r.total_attempts, 10) || 0,
      totalAttemptsFormatted: formatAttemptCount(r.total_attempts),
    }));

    const totalPapers = categories.reduce((s, c) => s + c.paperCount, 0);
    const totalAttempts = categories.reduce((s, c) => s + c.totalAttempts, 0);

    res.json({
      success: true,
      data: categories,
      totalPapers,
      totalAttempts,
      totalAttemptsFormatted: formatAttemptCount(totalAttempts),
    });
  } catch (error) {
    console.error('PYP categories error:', error);
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
};

router.get('/', getPypCategoriesHandler);
router.get('/categories', getPypCategoriesHandler);

// ============================================================
// L2: GET /api/pyps/categories/:catSlug/exams
// Returns ALL exams in a category (including those with 0 PYPs)
// Matches by exam_categories.slug, exam_categories.category_id,
// or exams.category_id
// ============================================================
router.get('/categories/:catSlug/exams', async (req, res) => {
  try {
    const { catSlug } = req.params;
    const examsRes = await pool.query(`
      SELECT e.id, e.slug, e.title, e.full_name, e.category_id,
             COUNT(t.id) AS paper_count,
             MIN(t.pyq_year) AS min_year,
             MAX(t.pyq_year) AS max_year,
             COALESCE(SUM(t.attempt_count), 0) AS total_attempts,
             COUNT(DISTINCT t.stage_id) AS stage_count,
             MAX(t.pyq_year) AS latest_year
      FROM exams e
      LEFT JOIN tests t ON (t.exam_id::text = e.id::text OR t.exam_id::text = e.slug OR t.exam_id::text = e.public_id)
        AND t.is_active = true
        AND (t.is_pyq = true OR t.category = 'PYPs' OR 'pyp' = ANY(t.tags) OR 'previous-year' = ANY(t.tags))
      WHERE (e.category_id::text = $1 OR e.category_id = (SELECT ec.category_id FROM exam_categories ec WHERE ec.slug = $1 LIMIT 1) OR $1 = 'all')
        AND (e.is_active = true OR e.is_active IS NULL)
      GROUP BY e.id, e.slug, e.title, e.full_name, e.category_id
      ORDER BY COUNT(t.id) DESC, e.title ASC
    `, [catSlug]);

    // Compute new_count (papers from the latest year) per exam in JS
    const exams = examsRes.rows.map((r) => {
      const latestYear = r.latest_year;
      // Generate slug from title if null (e.g. "SSC CGL" -> "ssc-cgl")
      const slug = r.slug || (r.title ? r.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : String(r.id));
      return {
        id: r.id,
        slug,
        title: r.title,
        fullName: r.full_name,
        categoryId: r.category_id,
        paperCount: parseInt(r.paper_count, 10) || 0,
        yearRange: r.min_year && r.max_year ? `${r.min_year}–${r.max_year}` : null,
        totalAttempts: parseInt(r.total_attempts, 10) || 0,
        totalAttemptsFormatted: formatAttemptCount(r.total_attempts),
        stageCount: parseInt(r.stage_count, 10) || 0,
        latestYear,
        newCount: 0,
      };
    });

    // Fill newCount via a second lightweight query
    if (exams.length > 0) {
      const examIds = exams.map((e) => e.id);
      const newCountRes = await pool.query(`
        SELECT t.exam_id::int AS exam_id, COUNT(*) AS new_count
        FROM tests t
        WHERE t.is_active = true
          AND (t.is_pyq = true OR t.category = 'PYPs' OR 'pyp' = ANY(t.tags) OR 'previous-year' = ANY(t.tags))
          AND t.exam_id::int = ANY($1::int[])
          AND t.pyq_year = (SELECT MAX(pyq_year) FROM tests WHERE exam_id::int = t.exam_id::int AND is_active = true AND (is_pyq = true OR category = 'PYPs' OR 'pyp' = ANY(tags) OR 'previous-year' = ANY(tags)))
        GROUP BY t.exam_id::int
      `, [examIds]);
      const newCountMap = {};
      for (const r of newCountRes.rows) {
        newCountMap[parseInt(r.exam_id, 10)] = parseInt(r.new_count, 10) || 0;
      }
      for (const e of exams) {
        e.newCount = newCountMap[e.id] || 0;
      }
    }

    res.json({
      success: true,
      data: exams,
      count: exams.length,
    });
  } catch (error) {
    console.error('PYP category exams error:', error);
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ============================================================
// L3: GET /api/pyps/exams/:examSlug?tier=&year=&page=&limit=
// Returns year-grouped PYPs for a specific exam
// examSlug can be: exam id (e.g. "1"), exam slug, or exam public_id
// ============================================================
router.get('/exams/:examSlug', async (req, res) => {
  try {
    const { examSlug } = req.params;
    const { tier, year, testCategoryId, page = 1, limit = 50 } = req.query;
    const parsedLimit = parseInt(limit, 10) || 50;
    const offset = ((parseInt(page, 10) || 1) - 1) * parsedLimit;

    // Build exam match condition — examSlug could be:
    // numeric id, DB slug, generated title-slug (e.g. "ssc-cgl"), or public_id
    const examMatch = `(
      t.exam_id = (
        SELECT id FROM exams
        WHERE id::text = $1::text
           OR slug = $1::text
           OR public_id = $1::text
           OR LOWER(REPLACE(title, ' ', '-')) = $1::text
        LIMIT 1
      )
    )`;

    const conditions = [
      't.is_active = true',
      '(t.is_pyq = true OR t.category = \'PYPs\' OR \'pyp\' = ANY(t.tags) OR \'previous-year\' = ANY(t.tags))',
      examMatch,
    ];
    const params = [examSlug];
    let paramIndex = 2;

    if (year && year !== 'all') {
      conditions.push(`t.pyq_year = $${paramIndex}`);
      params.push(parseInt(year, 10));
      paramIndex++;
    }

    if (tier && tier !== 'all') {
      if (/^\d+$/.test(tier)) {
        // Match either the single stage_id column OR the stage_ids array
        conditions.push(`(t.stage_id = $${paramIndex} OR $${paramIndex} = ANY(t.stage_ids))`);
        params.push(parseInt(tier, 10));
        paramIndex++;
      } else {
        conditions.push(`(LOWER(t.sub_category) LIKE LOWER('%' || $${paramIndex} || '%') OR EXISTS (SELECT 1 FROM stages s WHERE s.id = t.stage_id AND LOWER(s.name) LIKE LOWER('%' || $${paramIndex} || '%')))`);
        params.push(tier);
        paramIndex++;
      }
    }

    // Filter by test_category_id — matches the category OR any descendant (for hierarchy filtering)
    if (testCategoryId && testCategoryId !== 'all') {
      const catId = parseInt(testCategoryId, 10);
      // Match tests where test_category_id = $N OR test_category_id is a descendant of $N
      conditions.push(`(
        t.test_category_id = $${paramIndex}
        OR t.test_category_id IN (
          WITH RECURSIVE cat_tree AS (
            SELECT id FROM test_categories WHERE id = $${paramIndex}
            UNION ALL
            SELECT tc.id FROM test_categories tc
            JOIN cat_tree ct ON tc.parent_id = ct.id
          )
          SELECT id FROM cat_tree WHERE id != $${paramIndex}
        )
        OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(t.category_path_ids) AS elem WHERE elem::int = $${paramIndex})
      )`);
      params.push(catId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Total count
    const countRes = await pool.query(
      `SELECT COUNT(*) as total FROM tests t WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countRes.rows[0].total, 10) || 0;

    // Fetch papers
    const testsRes = await pool.query(
      `SELECT t.*, s.name AS stage_name
       FROM tests t
       LEFT JOIN stages s ON s.id = t.stage_id
       WHERE ${whereClause}
       ORDER BY t.pyq_year DESC NULLS LAST, t.shift ASC NULLS LAST, t.title ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parsedLimit, offset],
    );

    const papers = testsRes.rows.map(normalizePyp);

    // Available years for this exam
    const yearsRes = await pool.query(`
      SELECT DISTINCT t.pyq_year
      FROM tests t
      WHERE t.is_active = true
        AND (t.is_pyq = true OR t.category = 'PYPs' OR 'pyp' = ANY(t.tags) OR 'previous-year' = ANY(t.tags))
        AND ${examMatch}
        AND t.pyq_year IS NOT NULL
      ORDER BY t.pyq_year DESC
    `, [examSlug]);
    const availableYears = yearsRes.rows.map((r) => r.pyq_year).filter(Boolean);

    // Available tiers (stages) for this exam.
    // Show ALL tiers linked to the exam (via stages.exam_ids), even if a tier
    // currently has no papers. Also include any tier that has papers here.
    const examIdSub = `(SELECT id FROM exams WHERE id::text = $1::text OR slug = $1::text OR public_id = $1::text OR LOWER(REPLACE(title, ' ', '-')) = $1::text LIMIT 1)`
    const tiersRes = await pool.query(`
      SELECT DISTINCT s.id, s.name
      FROM stages s
      WHERE s.is_active = true
        AND (
          s.exam_ids::text[] && ARRAY[(${examIdSub})::text]
          OR s.id IN (
            SELECT DISTINCT COALESCE(t.stage_id, sid.sid) AS sid_val
            FROM tests t
            LEFT JOIN LATERAL unnest(COALESCE(t.stage_ids, ARRAY[]::integer[])) AS sid(sid) ON true
            WHERE t.is_active = true
              AND (t.is_pyq = true OR t.category = 'PYPs' OR 'pyp' = ANY(t.tags) OR 'previous-year' = ANY(t.tags))
              AND ${examMatch}
          )
        )
      ORDER BY s.name ASC
    `, [examSlug]);
    const availableTiers = tiersRes.rows.map((r) => ({ id: r.id, name: r.name }));

    // Available test categories (PYP subcategories: Full PYP, Year Based, Sectional, Chapter-wise, etc.)
    // Counts are scoped to the selected stage/year so the UI can default to a path that actually has papers.
    const testCatConditions = [
      't.is_active = true',
      PYP_WHERE.replace(/\b(is_pyq|category|tags)\b/g, 't.$1'),
      examMatch,
    ];
    const testCatParams = [examSlug];
    let testCatParamIndex = 2;

    if (year && year !== 'all') {
      testCatConditions.push(`t.pyq_year = $${testCatParamIndex}`);
      testCatParams.push(parseInt(year, 10));
      testCatParamIndex++;
    }

    if (tier && tier !== 'all') {
      if (/^\d+$/.test(tier)) {
        testCatConditions.push(`(t.stage_id = $${testCatParamIndex} OR $${testCatParamIndex} = ANY(t.stage_ids))`);
        testCatParams.push(parseInt(tier, 10));
        testCatParamIndex++;
      } else {
        testCatConditions.push(`(LOWER(t.sub_category) LIKE LOWER('%' || $${testCatParamIndex} || '%') OR EXISTS (SELECT 1 FROM stages s WHERE s.id = t.stage_id AND LOWER(s.name) LIKE LOWER('%' || $${testCatParamIndex} || '%')))`);
        testCatParams.push(tier);
        testCatParamIndex++;
      }
    }

    const testCatWhereClause = testCatConditions.join(' AND ');

    const testCatsRes = await pool.query(`
      WITH RECURSIVE pyp_tree AS (
        -- Find the PYPs root category (slug = 'pyps')
        SELECT id, name, slug, parent_id, 0 AS depth FROM test_categories WHERE slug = 'pyps' AND (is_active = true OR is_active IS NULL)
        UNION ALL
        SELECT tc.id, tc.name, tc.slug, tc.parent_id, pt.depth + 1
        FROM test_categories tc
        JOIN pyp_tree pt ON tc.parent_id = pt.id
        WHERE tc.is_active = true OR tc.is_active IS NULL
      )
      SELECT pt.id, pt.name, pt.slug, pt.parent_id, pt.depth,
             COUNT(t.id) AS test_count
      FROM pyp_tree pt
      LEFT JOIN tests t ON (t.test_category_id = pt.id
        OR t.test_category_id IN (SELECT id FROM pyp_tree WHERE parent_id = pt.id)
        OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(t.category_path_ids) AS elem WHERE elem::int = pt.id)
      )
        AND ${testCatWhereClause}
      GROUP BY pt.id, pt.name, pt.slug, pt.parent_id, pt.depth
      ORDER BY pt.depth, pt.name
    `, testCatParams);
    const availableTestCategories = testCatsRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      parentId: r.parent_id,
      depth: r.depth,
      testCount: parseInt(r.test_count, 10) || 0,
    }));

    // Group papers by year
    const grouped = {};
    for (const p of papers) {
      const y = p.pyqYear || 'Unknown';
      if (!grouped[y]) grouped[y] = [];
      grouped[y].push(p);
    }
    const yearGroups = Object.keys(grouped)
      .sort((a, b) => {
        const an = parseInt(a, 10);
        const bn = parseInt(b, 10);
        if (isNaN(an) && isNaN(bn)) return 0;
        if (isNaN(an)) return 1;
        if (isNaN(bn)) return -1;
        return bn - an;
      })
      .map((y) => ({ year: y, papers: grouped[y], count: grouped[y].length }));

    // Exam metadata — match by id, slug, public_id, or title-derived slug
    let examMeta = null;
    try {
      const examRes = await pool.query(
        `SELECT id, slug, title, full_name, category_id FROM exams WHERE id::text = $1 OR slug = $1 OR public_id = $1 OR LOWER(REPLACE(title, ' ', '-')) = $1 LIMIT 1`,
        [examSlug],
      );
      if (examRes.rows[0]) {
        examMeta = toCamel(examRes.rows[0]);
        // Generate slug if null
        if (!examMeta.slug) {
          examMeta.slug = examMeta.title ? examMeta.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : String(examMeta.id);
        }
      }
    } catch {} // eslint-disable-line no-empty -- best-effort metadata enrichment

    res.json({
      success: true,
      data: {
        exam: examMeta,
        yearGroups,
        papers,
        availableYears,
        availableTiers,
        availableTestCategories,
        total,
        totalFormatted: formatAttemptCount(papers.reduce((s, p) => s + (p.attemptCount || 0), 0)),
      },
      pagination: {
        page: parseInt(page, 10) || 1,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    console.error('PYP exam papers error:', error);
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ============================================================
// GET /api/pyps/exams/:examSlug/insights
// Topic weightage + cutoff trend (best-effort; returns empty if data missing)
// ============================================================
router.get('/exams/:examSlug/insights', async (req, res) => {
  try {
    const { examSlug } = req.params;

    // Cutoff trend from exam_yearly_data if available
    let cutoffTrend = [];
    try {
      const cutoffRes = await pool.query(`
        SELECT e.year, e.cutoff_marks
        FROM exam_yearly_data e
        WHERE e.exam_id = (SELECT id FROM exams WHERE id::text = $1 OR slug = $1 OR public_id = $1 LIMIT 1)
          AND e.cutoff_marks IS NOT NULL
        ORDER BY e.year DESC
        LIMIT 10
      `, [examSlug]);
      cutoffTrend = cutoffRes.rows.map((r) => ({ year: r.year, cutoff: r.cutoff_marks }));
    } catch {} // eslint-disable-line no-empty -- best-effort analytics

    // Topic weightage from question tags (best-effort)
    let topicWeightage = [];
    try {
      const weightRes = await pool.query(`
        SELECT tag, COUNT(*) AS question_count
        FROM questions q
        WHERE q.source_config->>'examId' = $1
          AND q.tags IS NOT NULL
        GROUP BY tag
        ORDER BY question_count DESC
        LIMIT 10
      `, [examSlug]);
      topicWeightage = weightRes.rows.map((r) => ({ topic: r.tag, count: parseInt(r.question_count, 10) }));
    } catch {} // eslint-disable-line no-empty -- best-effort analytics

    res.json({
      success: true,
      data: {
        cutoffTrend,
        topicWeightage,
      },
    });
  } catch (error) {
    console.error('PYP insights error:', error);
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

export default router;
