import dotenv from "dotenv";
import pg from "pg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendEnvPath = path.join(__dirname, "../apps/backend/.env");
const rootEnvPath = path.join(__dirname, "../.env");

if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else {
  dotenv.config();
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ Error: DATABASE_URL environment variable is not defined.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : { rejectUnauthorized: false }
});

async function runCascadeNullAudit() {
  console.log("================================================================");
  console.log("🔍 TRSTPREP DATABASE CASCADE & RELATIVE FOREIGN KEY AUDIT");
  console.log("================================================================\n");

  const client = await pool.connect();

  try {
    // 1. Fetch foreign keys mapping with delete/update rules
    const fkRes = await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name,
        rc.delete_rule,
        rc.update_rule,
        c.is_nullable
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
        AND rc.constraint_schema = tc.table_schema
      JOIN information_schema.columns AS c
        ON c.table_name = tc.table_name
        AND c.column_name = kcu.column_name
        AND c.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `);

    const fkMap = new Map();
    fkRes.rows.forEach(fk => {
      const key = `${fk.table_name}.${fk.column_name}`;
      fkMap.set(key, fk);
    });

    // 2. Dynamic SQL audit of all foreign key / relative columns ending in _id or parent_id
    const dynamicSql = `
      DO $$ 
      DECLARE 
        r RECORD;
        total INT;
        null_c INT;
      BEGIN 
        CREATE TEMP TABLE temp_audit_results (
          table_name TEXT,
          column_name TEXT,
          is_nullable TEXT,
          total_rows INT,
          null_rows INT
        ) ON COMMIT DROP;

        FOR r IN 
          SELECT c.table_name, c.column_name, c.is_nullable
          FROM information_schema.columns c
          JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
          WHERE c.table_schema = 'public' 
            AND t.table_type = 'BASE TABLE'
            AND (c.column_name LIKE '%_id' OR c.column_name = 'parent_id' OR c.column_name LIKE '%_ids')
            AND c.column_name != 'id'
        LOOP
          EXECUTE format('SELECT COUNT(*), COUNT(*) - COUNT(%I) FROM %I', r.column_name, r.table_name) INTO total, null_c;
          IF total > 0 THEN
            INSERT INTO temp_audit_results VALUES (r.table_name, r.column_name, r.is_nullable, total, null_c);
          END IF;
        END LOOP;
      END $$;

      SELECT * FROM temp_audit_results ORDER BY null_rows DESC, table_name, column_name;
    `;

    const auditCountsRes = await client.query(dynamicSql);
    const auditCounts = auditCountsRes[1].rows;

    const fullResults = auditCounts.map(row => {
      const fkInfo = fkMap.get(`${row.table_name}.${row.column_name}`);
      return {
        table_name: row.table_name,
        column_name: row.column_name,
        is_nullable: row.is_nullable,
        total_rows: row.total_rows,
        null_rows: row.null_rows,
        non_null_rows: row.total_rows - row.null_rows,
        null_pct: ((row.null_rows / row.total_rows) * 100).toFixed(1) + "%",
        has_fk: !!fkInfo,
        foreign_table: fkInfo ? fkInfo.foreign_table_name : "NO_FK_CONSTRAINT",
        delete_rule: fkInfo ? fkInfo.delete_rule : "NO_FK_CONSTRAINT"
      };
    });

    console.log("----------------------------------------------------------------");
    console.log("1. AUDIT OF NULL VALUES IN FOREIGN KEYS & RELATIVE COLUMNS");
    console.log("----------------------------------------------------------------\n");

    const columnsWithNulls = fullResults.filter(r => r.null_rows > 0);
    console.log(`Found ${columnsWithNulls.length} relative/foreign key columns containing NULL values:\n`);

    console.table(columnsWithNulls.map(r => ({
      "Table": r.table_name,
      "Column": r.column_name,
      "Nullable": r.is_nullable,
      "Total Rows": r.total_rows,
      "NULL Count": r.null_rows,
      "NULL %": r.null_pct,
      "FK Target": r.foreign_table,
      "On Delete Action": r.delete_rule
    })));

    console.log("\n----------------------------------------------------------------");
    console.log("2. AUDIT OF COLUMNS WITH NO FOREIGN KEY OR NO CASCADE");
    console.log("----------------------------------------------------------------\n");

    const missingFkOrCascade = fullResults.filter(r => !r.has_fk || (r.delete_rule !== "CASCADE" && r.delete_rule !== "SET NULL"));
    console.log(`Found ${missingFkOrCascade.length} foreign key / relative columns lacking FK or ON DELETE CASCADE:\n`);

    console.table(missingFkOrCascade.slice(0, 30).map(r => ({
      "Table": r.table_name,
      "Column": r.column_name,
      "Nullable": r.is_nullable,
      "Total Rows": r.total_rows,
      "NULL Count": r.null_rows,
      "FK Target": r.foreign_table,
      "On Delete Action": r.delete_rule
    })));

    console.log("\n----------------------------------------------------------------");
    console.log("3. DEEP DERIVATION ANALYSIS FOR NULL RELATIVE FIELDS");
    console.log("----------------------------------------------------------------\n");

    // Questions Table Null Hierarchy
    const qAnalysis = await client.query(`
      SELECT 
        COUNT(*) as total_questions,
        COUNT(*) FILTER (WHERE category_id IS NULL) as null_category,
        COUNT(*) FILTER (WHERE subject_id IS NULL) as null_subject,
        COUNT(*) FILTER (WHERE chapter_id IS NULL) as null_chapter,
        COUNT(*) FILTER (WHERE topic_id IS NULL) as null_topic,
        COUNT(*) FILTER (WHERE subtopic_id IS NULL) as null_subtopic,
        COUNT(*) FILTER (WHERE section_id IS NULL) as null_section
      FROM questions;
    `);
    console.log("📌 Questions Null Summary:", qAnalysis.rows[0]);

    // Questions derivable subject_id from subject_chapters
    const qDeriveSubjectFromChapter = await client.query(`
      SELECT 
        COUNT(DISTINCT q.id) as questions_with_null_subject_and_valid_chapter,
        COUNT(DISTINCT CASE WHEN c.subject_id IS NOT NULL THEN q.id END) as derivable_subject_from_chapter
      FROM questions q
      JOIN subject_chapters c ON q.chapter_id = c.id
      WHERE q.subject_id IS NULL;
    `).catch(err => ({ error: err.message }));
    console.log("📌 Questions Derivable Subject from Chapter:", qDeriveSubjectFromChapter.rows ? qDeriveSubjectFromChapter.rows[0] : qDeriveSubjectFromChapter.error);

    // Questions derivable subject_id / chapter_id from subject_topics
    const qDeriveChapterFromTopic = await client.query(`
      SELECT 
        COUNT(DISTINCT q.id) as questions_with_null_chapter_and_valid_topic,
        COUNT(DISTINCT CASE WHEN t.chapter_id IS NOT NULL THEN q.id END) as derivable_chapter_from_topic
      FROM questions q
      JOIN subject_topics t ON q.topic_id = t.id
      WHERE q.chapter_id IS NULL;
    `).catch(err => ({ error: err.message }));
    console.log("📌 Questions Derivable Chapter from Topic:", qDeriveChapterFromTopic.rows ? qDeriveChapterFromTopic.rows[0] : qDeriveChapterFromTopic.error);

    // Questions derivable category_id / series_id from test_questions -> tests
    const qDeriveFromTests = await client.query(`
      SELECT 
        COUNT(DISTINCT q.id) as questions_in_test_questions,
        COUNT(DISTINCT CASE WHEN q.category_id IS NULL AND t.category_id IS NOT NULL THEN q.id END) as derivable_category_from_tests,
        COUNT(DISTINCT CASE WHEN q.series_id IS NULL AND t.series_id IS NOT NULL THEN q.id END) as derivable_series_from_tests
      FROM questions q
      JOIN test_questions tq ON q.id = tq.question_id
      JOIN tests t ON tq.test_id = t.id;
    `).catch(err => ({ error: err.message }));
    console.log("📌 Questions Derivable Relative Values from Tests:", qDeriveFromTests.rows ? qDeriveFromTests.rows[0] : qDeriveFromTests.error);

    // Test_sections derivable category_id / series_id / stage_id from tests
    const secDeriveFromTests = await client.query(`
      SELECT 
        COUNT(DISTINCT ts.id) as sections_with_null_category,
        COUNT(DISTINCT CASE WHEN t.category_id IS NOT NULL THEN ts.id END) as derivable_category_from_tests
      FROM test_sections ts
      JOIN tests t ON ts.test_id = t.id
      WHERE ts.category_id IS NULL;
    `).catch(err => ({ error: err.message }));
    console.log("📌 Test Sections Derivable Category from Parent Test:", secDeriveFromTests.rows ? secDeriveFromTests.rows[0] : secDeriveFromTests.error);

    // Subject_topics derivable chapter_id / subject_id from parent_topic_id
    const topicDeriveFromParentTopic = await client.query(`
      SELECT 
        COUNT(DISTINCT t.id) as topics_with_null_chapter,
        COUNT(DISTINCT CASE WHEN pt.chapter_id IS NOT NULL THEN t.id END) as derivable_chapter_from_parent_topic
      FROM subject_topics t
      JOIN subject_topics pt ON t.parent_topic_id = pt.id
      WHERE t.chapter_id IS NULL;
    `).catch(err => ({ error: err.message }));
    console.log("📌 Topics Derivable Chapter from Parent Topic:", topicDeriveFromParentTopic.rows ? topicDeriveFromParentTopic.rows[0] : topicDeriveFromParentTopic.error);

  } finally {
    client.release();
    await pool.end();
  }
}

runCascadeNullAudit().catch(err => {
  console.error("Fatal error in cascade null audit:", err);
  process.exit(1);
});
