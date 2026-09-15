import dotenv from "dotenv";
dotenv.config({ path: "apps/backend/.env" });

(async () => {
  const { pool } =
    await import("./apps/backend/src/infrastructure/database/postgres-helpers.js");

  const query = `
      WITH deduped AS (
        SELECT ts.*,
               ROW_NUMBER() OVER (
                 PARTITION BY LOWER(name), COALESCE(test_id, 0), COALESCE(test_series_id, 0), COALESCE(stage_id, 0)
                 ORDER BY id
               ) as rn
        FROM test_sections ts
      ),
      section_aliases_agg AS (
        SELECT sa.canonical_name, string_agg(sa.alias_name, ', ') as aliases_list
        FROM section_aliases sa
        GROUP BY sa.canonical_name
      ),
      question_counts AS (
        SELECT
          COALESCE(
            (SELECT sa.canonical_name FROM section_aliases sa WHERE LOWER(sa.alias_name) = LOWER(q.section) LIMIT 1),
            q.section
          ) as resolved_name,
          COUNT(*)::int as cnt
        FROM questions q
        WHERE q.is_active = true
        GROUP BY resolved_name
      ),
      linked_exams_agg AS (
        SELECT
          COALESCE(
            (SELECT sa2.canonical_name FROM section_aliases sa2 WHERE LOWER(sa2.alias_name) = LOWER(ts2.name) LIMIT 1),
            ts2.name
          ) as resolved_name,
          string_agg(DISTINCT COALESCE(e2.title, tsr2.title, t2.title), ', ') as linked_exams
        FROM test_sections ts2
        LEFT JOIN test_series tsr2 ON ts2.test_series_id = tsr2.id
        LEFT JOIN tests t2 ON ts2.test_id = t2.id
        LEFT JOIN test_series tsr3 ON t2.series_id = tsr3.id
        LEFT JOIN exams e2 ON (
          (ts2.test_series_id IS NOT NULL AND tsr2.exam_id::text = e2.id::text)
          OR
          (ts2.test_id IS NOT NULL AND (
            t2.exam_id::text = e2.id::text 
            OR t2.exam_id::text = e2.slug::text 
            OR t2.exam_id::text = e2.public_id::text
            OR tsr3.exam_id::text = e2.id::text
          ))
        )
        WHERE (ts2.test_id IS NOT NULL OR ts2.test_series_id IS NOT NULL)
        GROUP BY resolved_name
      )
      SELECT d.*,
             COALESCE(qc.cnt, 0) as question_count,
             saa.aliases_list,
             lea.linked_exams
      FROM deduped d
      LEFT JOIN question_counts qc ON qc.resolved_name = d.name
      LEFT JOIN section_aliases_agg saa ON saa.canonical_name = d.name
      LEFT JOIN linked_exams_agg lea ON lea.resolved_name = d.name
      WHERE d.rn = 1
      ORDER BY d.test_series_id NULLS FIRST, d.stage_id NULLS FIRST, d.display_order, d.id
  `;

  try {
    const res = await pool.query(query);
    console.log("Success:", res.rows.length);
  } catch (err) {
    console.error("Error Details:", err);
  } finally {
    process.exit(0);
  }
})();
