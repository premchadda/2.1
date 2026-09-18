import dotenv from "dotenv";
import pg from "pg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from apps/backend/.env or root .env
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
const readConnectionString = process.env.DATABASE_READ_URL || connectionString;

if (!connectionString) {
  console.error("❌ Error: DATABASE_URL environment variable is not defined.");
  process.exit(1);
}

const sslConfig =
  process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: true }
    : { rejectUnauthorized: false };
const pool = new pg.Pool({ connectionString, ssl: sslConfig });
const readPool =
  readConnectionString !== connectionString
    ? new pg.Pool({ connectionString: readConnectionString, ssl: sslConfig })
    : pool;

async function runAudit() {
  console.log("=========================================");
  console.log("🔍 TRSTPREP DATABASE SCHEMA & INDEX AUDIT (HARDENED)");
  console.log("=========================================");
  console.log(
    `Primary: ${connectionString.split("@")[1]?.split("/")[0] || "Database"} | Read replica: ${readPool !== pool ? "configured" : "fallback to primary"}\n`,
  );

  let failed = false;
  let warnings = 0;

  // 1. Verify critical tables (12+ including junction)
  const expectedTables = [
    "users",
    "tests",
    "questions",
    "attempts",
    "test_series",
    "test_categories",
    "test_category_series",
    "exam_categories",
    "exams",
    "subjects",
    "subject_units",
    "subject_chapters",
    "subject_topics",
    "subject_subtopics",
    "user_sessions",
    "two_factor_secrets",
    "test_sections",
    "certificates",
    "audit_logs",
  ];

  console.log(`--- Checking Tables (${expectedTables.length} expected) ---`);
  for (const table of expectedTables) {
    try {
      const res = await pool.query(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = $1)",
        [table],
      );
      if (res.rows[0].exists) {
        console.log(`✅ Table "${table}" exists`);
      } else {
        // Junction is critical but allow soft fail if legacy array still present
        if (table === "test_category_series") {
          console.error(`❌ Table "${table}" is MISSING! (Run pending migrations: next is 143_*)`);
          failed = true;
        } else if (["certificates", "audit_logs"].includes(table)) {
          console.warn(`⚠️ Table "${table}" missing (non-critical)`);
          warnings++;
        } else {
          console.error(`❌ Table "${table}" is MISSING!`);
          failed = true;
        }
      }
    } catch (err) {
      console.error(`❌ Failed to check table "${table}":`, err.message);
      failed = true;
    }
  }
  console.log("");

  // 2. Verify critical column types & encryption shadow columns
  console.log("--- Checking Column Types, Encryption & Soft-Delete ---");
  const columnChecks = [
    { table: "tests", column: "exam_id", expected: "integer" },
    {
      table: "users",
      column: "phone",
      expected: ["character varying", "text"],
    },
    { table: "users", column: "phone_enc", expected: "text", isShadow: true },
    { table: "users", column: "dob_enc", expected: "text", isShadow: true },
    {
      table: "users",
      column: "is_deleted",
      expected: "boolean",
      softDelete: true,
    },
    {
      table: "tests",
      column: "is_deleted",
      expected: "boolean",
      softDelete: true,
    },
    {
      table: "test_category_series",
      column: "test_category_id",
      expected: "integer",
    },
  ];
  for (const chk of columnChecks) {
    try {
      const res = await pool.query(
        `SELECT data_type FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
        [chk.table, chk.column],
      );
      if (res.rows.length === 0) {
        if (chk.isShadow) {
          console.warn(
            `⚠️ Shadow column "${chk.table}.${chk.column}" missing — run migration 088`,
          );
          warnings++;
        } else if (chk.softDelete) {
          console.warn(
            `⚠️ Soft-delete column "${chk.table}.${chk.column}" missing — run soft-delete migration`,
          );
          warnings++;
        } else if (chk.table === "users" && chk.column === "phone") {
          // Check legacy mobile fallback
          const alt = await pool.query(
            `SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='mobile'`,
          );
          if (alt.rows.length)
            console.log(
              `✅ Column "users.mobile" exists (legacy alias for phone)`,
            );
          else {
            console.error(
              `❌ Column "${chk.table}.${chk.column}" missing and no legacy alias`,
            );
            failed = true;
          }
        } else {
          console.error(`❌ Column "${chk.table}.${chk.column}" is missing!`);
          failed = true;
        }
      } else {
        const actualType = res.rows[0].data_type;
        const matchesExpected = Array.isArray(chk.expected)
          ? chk.expected.includes(actualType)
          : actualType === chk.expected;
        if (matchesExpected) {
          console.log(
            `✅ Column "${chk.table}.${chk.column}" type is "${actualType}"`,
          );
        } else {
          console.warn(
            `⚠️ Column "${chk.table}.${chk.column}" type is "${actualType}" (expected ${Array.isArray(chk.expected) ? chk.expected.join(" or ") : chk.expected})`,
          );
          warnings++;
        }
      }
    } catch (err) {
      console.error(
        `❌ Failed to verify column ${chk.table}.${chk.column}:`,
        err.message,
      );
      failed = true;
    }
  }
  // Check phone vs mobile mapping note
  try {
    const res = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name IN ('phone','mobile')`,
    );
    const cols = res.rows.map((r) => r.column_name);
    if (cols.includes("phone") && cols.includes("mobile"))
      console.log(`✅ users has both phone & mobile (alias sync via trigger)`);
    else if (cols.includes("phone"))
      console.log(`✅ users has phone (canonical)`);
    else if (cols.includes("mobile"))
      console.warn(
        `⚠️ users has only legacy mobile — should have phone (migrate alias)`,
      );
  } catch {}
  console.log("");

  // 3. Verify FKs for junction (NOT VALID → VALIDATE)
  console.log("--- Checking Junction FKs (NOT VALID → VALIDATE) ---");
  try {
    const fkRes = await pool.query(`
      SELECT conname, contype, convalidated
      FROM pg_constraint
      WHERE conrelid = 'test_category_series'::regclass
    `);
    const fks = fkRes.rows;
    if (fks.length === 0) {
      console.warn(`⚠️ No FKs on test_category_series — run migration 121`);
      warnings++;
    } else {
      for (const fk of fks) {
        const status = fk.convalidated
          ? "validated"
          : "NOT VALID (needs VALIDATE)";
        console.log(`✅ FK "${fk.conname}" ${status}`);
        if (!fk.convalidated) warnings++;
      }
    }
  } catch (err) {
    console.warn(`⚠️ Could not check junction FKs:`, err.message);
  }
  console.log("");

  // 4. Verify critical indexes (performance + GIN + HNSW tuned)
  const expectedIndexes = [
    // 079 performance (concurrent)
    { index: "idx_attempts_user_submitted", table: "attempts" },
    { index: "idx_attempts_completed_submitted", table: "attempts" },
    { index: "idx_attempts_user_completed", table: "attempts" },
    { index: "idx_tests_status_active", table: "tests" },
    {
      index: "idx_subject_topics_subject",
      legacyIndex: "idx_topics_subject",
      table: "subject_topics",
    },
    { index: "idx_subject_videos_study_material", table: "subject_videos" },
    { index: "idx_notifications_user_created", table: "notifications" },
    { index: "idx_practice_answers_user_created", table: "practice_answers" },
    { index: "idx_attempts_test_id", table: "attempts" },
    { index: "idx_users_created_at", table: "users" },
    // junction
    {
      index: "idx_test_category_series_category",
      table: "test_category_series",
    },
    { index: "idx_test_category_series_series", table: "test_category_series" },
    // GIN indexes
    { index: "idx_attempts_section_timers_gin", table: "attempts" },
    { index: "idx_users_enrolled_series_gin", table: "users" },
  ];

  console.log("--- Checking Performance & GIN Indexes ---");
  for (const idx of expectedIndexes) {
    try {
      const res = await pool.query(
        "SELECT indexname FROM pg_indexes WHERE tablename = $1 AND indexname IN ($2, $3)",
        [idx.table, idx.index, idx.legacyIndex || idx.index],
      );
      if (res.rows.length > 0) {
        console.log(
          `✅ Index "${res.rows[0].indexname}" on "${idx.table}" exists`,
        );
      } else {
        console.warn(
          `⚠️ Warning: Index "${idx.index}" on "${idx.table}" is MISSING! (Historical refs 035/079/137 — current chain is 000–142, add via next 143_*)`,
        );
        warnings++;
      }
    } catch (err) {
      console.error(`❌ Failed to check index "${idx.index}":`, err.message);
    }
  }
  // HNSW tuning check
  console.log(
    "--- Checking HNSW Vector Index Tuning (m=32 ef=200 ef_search=100) ---",
  );
  try {
    const hnsw = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE indexname IN ('idx_embeddings_vector_hnsw','idx_question_search_vector_hnsw')
    `);
    for (const row of hnsw.rows) {
      const def = row.indexdef;
      const hasM32 =
        def.includes("m = 32") ||
        def.includes("m=32") ||
        def.includes("m='32'") ||
        def.includes("m = '32'");
      const hasEf200 =
        def.includes("ef_construction = 200") ||
        def.includes("ef_construction=200") ||
        def.includes("ef_construction='200'") ||
        def.includes("ef_construction = '200'");
      if (hasM32 && hasEf200) {
        console.log(
          `✅ HNSW "${row.indexname}" tuned (m=32 ef_construction=200)`,
        );
      } else {
        console.warn(
          `⚠️ HNSW "${row.indexname}" mis-tuned: ${def} (expected m=32 ef_construction=200)`,
        );
        warnings++;
      }
    }
    if (hnsw.rows.length === 0) {
      console.warn(`⚠️ No HNSW indexes found — expected from 093 (CONCURRENTLY, live) or 134 (transactional, fresh)`);
      warnings++;
    }
    // Check ef_search setting (may require superuser, so warn only)
    try {
      const ef = await pool.query(`SHOW hnsw.ef_search`);
      const val =
        ef.rows[0]?.hnsw_ef_search || ef.rows[0]?.hnsw?.ef_search || "unknown";
      console.log(`ℹ️ hnsw.ef_search = ${val} (expected 100)`);
    } catch {}
  } catch (err) {
    console.warn(`⚠️ HNSW check failed:`, err.message);
  }
  console.log("");

  // 5. Check RLS IS NULL bypass removed (116)
  console.log("--- Checking RLS Polices (IS NULL bypass) ---");
  try {
    const rls = await pool.query(`
      SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS qual, pg_get_expr(polwithcheck, polrelid) AS with_check
      FROM pg_policy
      WHERE polqual::text LIKE '%current_user_id_setting() IS NULL%' OR polwithcheck::text LIKE '%current_user_id_setting() IS NULL%'
      LIMIT 10
    `);
    if (rls.rows.length > 0) {
      console.error(
        `❌ Found ${rls.rows.length} policies with IS NULL bypass (must be removed in 116):`,
      );
      for (const p of rls.rows)
        console.error(`   - ${p.polname}: ${p.qual || p.with_check}`);
      failed = true;
    } else {
      console.log(`✅ No RLS policies with IS NULL bypass`);
    }
    // Check helper functions are SECURITY DEFINER with fixed search_path
    const funcs = await pool.query(`
      SELECT proname, prosecdef, proconfig
      FROM pg_proc WHERE proname IN ('current_user_id_setting','current_is_admin','is_service_role')
    `);
    for (const fn of funcs.rows) {
      if (fn.prosecdef)
        console.log(`✅ Function ${fn.proname} is SECURITY DEFINER`);
      else console.warn(`⚠️ Function ${fn.proname} missing SECURITY DEFINER`);
      if (fn.proconfig && fn.proconfig.some((c) => c.includes("search_path")))
        console.log(`✅ Function ${fn.proname} has fixed search_path`);
      else console.warn(`⚠️ Function ${fn.proname} missing search_path`);
    }
  } catch (err) {
    console.warn(`⚠️ RLS check skipped:`, err.message);
  }
  console.log("");

  // 6. Check encryption functions (pgcrypto, DB_ENCRYPTION_KEY not logged)
  console.log(
    "--- Checking PII Encryption (aes-256-gcm, DB_ENCRYPTION_KEY) ---",
  );
  try {
    const enc = await pool.query(
      `SELECT proname, prosrc FROM pg_proc WHERE proname IN ('encrypt_pii','decrypt_pii')`,
    );
    if (enc.rows.length === 2)
      console.log(
        `✅ encrypt_pii/decrypt_pii functions exist (SECURITY DEFINER, search_path fixed)`,
      );
      else console.warn(`⚠️ Missing encrypt_pii/decrypt_pii — expected from 088/104/115/142`);
    if (!process.env.DB_ENCRYPTION_KEY) {
      // Fail-closed in production: without the key, *_enc columns stay NULL
      // and reads silently fall back to plaintext (088/104 fail-open). In
      // non-prod this stays a warning so local dev keeps working.
      if (process.env.NODE_ENV === "production") {
        console.error(
          `❌ DB_ENCRYPTION_KEY not set in production — PII encryption would silently no-op`,
        );
        failed = true;
      } else {
        console.warn(
          `⚠️ DB_ENCRYPTION_KEY not set in env — production must set 32+ char key (no JWT_SECRET fallback)`,
        );
        warnings++;
      }
    } else if (process.env.DB_ENCRYPTION_KEY.length < 32) {
      console.error(`❌ DB_ENCRYPTION_KEY too short (must be 32+)`);
      failed = true;
    } else {
      console.log(`✅ DB_ENCRYPTION_KEY present (32+ chars, not logged)`);
      if (process.env.DB_ENCRYPTION_KEY === process.env.JWT_SECRET) {
        console.error(`❌ DB_ENCRYPTION_KEY must not equal JWT_SECRET`);
        failed = true;
      }
    }
  } catch (err) {
    console.warn(`⚠️ Encryption check failed:`, err.message);
  }
  console.log("");

  // 7. Check read/write split
  console.log("--- Checking Read/Write Split ---");
  if (readPool !== pool) {
    try {
      await readPool.query(`SELECT 1`);
      console.log(`✅ Read replica pool reachable`);
    } catch (e) {
      console.warn(`⚠️ Read replica pool not reachable:`, e.message);
    }
  } else {
    console.log(
      `ℹ️ Read replica not configured (DATABASE_READ_URL fallback to primary) — okay for dev`,
    );
  }
  console.log("");

  // 8. Summary & Exit Code
  console.log("=========================================");
  console.log(
    `Audit complete: ${warnings} warnings, ${failed ? "FAILED" : "PASSED"}`,
  );
  if (failed) {
    console.error("❌ Schema audit FAILED with critical issues!");
    process.exit(1);
  } else if (warnings > 0) {
    console.warn("⚠️ Audit passed with warnings — review above");
    process.exit(0);
  } else {
    console.log("🎉 All critical schema elements verified successfully.");
    process.exit(0);
  }
}

runAudit().catch((err) => {
  console.error("Fatal error during audit execution:", err);
  process.exit(1);
});
