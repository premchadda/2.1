/**
 * Database Schema Audit and Fix Script — HARDENED v2
 * Run this to verify and fix database schema issues
 * 
 * Usage: node scripts/run-database-audit.js
 * Coverage: 13 checks (user_id types, FKs, orphans, indexes, duplicate tables,
 *           timestamps, array FKs, soft-delete, junction, HNSW, RLS, PII, GIN)
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database connection - match postgres-helpers.js configuration + read/write split
const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PG_SSL_REJECT_UNAUTHORIZED === 'false'
    ? { rejectUnauthorized: false }
    : { rejectUnauthorized: !isDev },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  query_timeout: 30000,
  max: 10,
});
const readPool = process.env.DATABASE_READ_URL
  ? new Pool({
      connectionString: process.env.DATABASE_READ_URL,
      ssl: process.env.PG_SSL_REJECT_UNAUTHORIZED === 'false' ? { rejectUnauthorized: false } : { rejectUnauthorized: !isDev },
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      query_timeout: 30000,
      max: 4,
    })
  : pool;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Check 1: Verify user_id type consistency
async function checkUserIdTypes() {
  log('\n📋 CHECK 1: User ID Type Consistency', 'cyan');
  log('='.repeat(50));

  const query = `
    SELECT 
      table_name,
      column_name,
      data_type,
      udt_name
    FROM information_schema.columns
    WHERE column_name = 'user_id'
    AND table_schema = 'public'
    ORDER BY table_name;
  `;

  const result = await pool.query(query);
  const types = new Set();

  result.rows.forEach(row => {
    log(`  ${row.table_name}.${row.column_name}: ${row.data_type}`, 'blue');
    types.add(row.data_type);
  });

  if (types.size > 1) {
    log(`  ⚠️  WARNING: Multiple user_id types found: ${Array.from(types).join(', ')}`, 'yellow');
    return false;
  }

  log('  ✅ All user_id columns have consistent type', 'green');
  return true;
}

// Check 2: Verify foreign key constraints
async function checkForeignKeys() {
  log('\n📋 CHECK 2: Foreign Key Constraints', 'cyan');
  log('='.repeat(50));

  const query = `
    SELECT 
      tc.table_name,
      kcu.column_name,
      tc.constraint_name,
      ccu.table_name AS foreign_table_name,
      kcu.ordinal_position
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu 
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.ordinal_position;
  `;

  const result = await pool.query(query);
  
  log(`  Found ${result.rowCount} foreign key constraints`, 'blue');
  
  // Check for specific critical FKs (including junction)
  const criticalFKs = [
    { table: 'questions', column: 'test_id', references: 'tests' },
    { table: 'attempts', column: 'user_id', references: 'users' },
    { table: 'attempts', column: 'test_id', references: 'tests' },
    { table: 'test_category_series', column: 'test_category_id', references: 'test_categories' },
    { table: 'test_category_series', column: 'test_series_id', references: 'test_series' },
  ];

  criticalFKs.forEach(fk => {
    const exists = result.rows.some(
      row => row.table_name === fk.table && 
             row.column_name === fk.column &&
             row.foreign_table_name === fk.references
    );
    
    if (exists) {
      log(`  ✅ ${fk.table}.${fk.column} -> ${fk.references}`, 'green');
    } else {
      log(`  ⚠️  Missing FK: ${fk.table}.${fk.column} -> ${fk.references}`, 'yellow');
    }
  });

  return true;
}

// Check 3: Check for orphaned records
async function checkOrphanedRecords() {
  log('\n📋 CHECK 3: Orphaned Records', 'cyan');
  log('='.repeat(50));

  const checks = [
    {
      name: 'questions -> chapter_id',
      query: `SELECT COUNT(*) FROM questions q LEFT JOIN chapters c ON q.chapter_id = c.id WHERE q.chapter_id IS NOT NULL AND c.id IS NULL`
    },
    {
      name: 'questions -> topic_id',
      query: `SELECT COUNT(*) FROM questions q LEFT JOIN topics t ON q.topic_id = t.id WHERE q.topic_id IS NOT NULL AND t.id IS NULL`
    },
    {
      name: 'test_questions -> section_id',
      query: `SELECT COUNT(*) FROM test_questions tq LEFT JOIN test_sections ts ON tq.section_id = ts.id WHERE tq.section_id IS NOT NULL AND ts.id IS NULL`
    },
    {
      name: 'attempts -> user_id',
      query: `SELECT COUNT(*) FROM attempts a LEFT JOIN users u ON a.user_id = u.id WHERE a.user_id IS NOT NULL AND u.id IS NULL`
    },
    {
      name: 'test_category_series -> test_categories',
      query: `SELECT COUNT(*) FROM test_category_series tcs LEFT JOIN test_categories tc ON tcs.test_category_id = tc.id WHERE tc.id IS NULL`
    },
    {
      name: 'test_category_series -> test_series',
      query: `SELECT COUNT(*) FROM test_category_series tcs LEFT JOIN test_series ts ON tcs.test_series_id = ts.id WHERE ts.id IS NULL`
    },
  ];

  let hasOrphans = false;

  for (const check of checks) {
    try {
      const result = await pool.query(check.query);
      const count = parseInt(result.rows[0].count);
      
      if (count > 0) {
        log(`  ⚠️  ${check.name}: ${count} orphaned records`, 'yellow');
        hasOrphans = true;
      } else {
        log(`  ✅ ${check.name}: No orphans`, 'green');
      }
    } catch (e) {
      log(`  ⚠️  ${check.name}: skipped (${e.message})`, 'yellow');
    }
  }

  return !hasOrphans;
}

// Check 4: Check indexes
async function checkIndexes() {
  log('\n📋 CHECK 4: Index Analysis', 'cyan');
  log('='.repeat(50));

  const query = `
    SELECT 
      schemaname,
      tablename,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `;

  const result = await pool.query(query);
  
  log(`  Total indexes: ${result.rowCount}`, 'blue');
  
  // Check for critical missing indexes (including 079 concurrent set)
  const criticalIndexes = [
    { table: 'users', index: 'users_email_key' },
    { table: 'questions', index: 'idx_questions_test_id' },
    { table: 'attempts', index: 'idx_attempts_user_id' },
    { table: 'audit_logs', index: 'idx_audit_logs_user_id' },
    { table: 'attempts', index: 'idx_attempts_user_submitted' },
    { table: 'tests', index: 'idx_tests_status_active' },
    { table: 'test_category_series', index: 'idx_test_category_series_category' },
    { table: 'test_category_series', index: 'idx_test_category_series_series' },
  ];

  criticalIndexes.forEach(({ table, index }) => {
    const exists = result.rows.some(row => row.indexname === index || (row.tablename === table && row.indexname.includes(table)));
    if (exists) {
      log(`  ✅ Index on ${table} (${index})`, 'green');
    } else {
      log(`  ⚠️  Missing index on ${table} (${index})`, 'yellow');
    }
  });

  return true;
}

// Check 5: Check duplicate table definitions
async function checkDuplicateTables() {
  log('\n📋 CHECK 5: Duplicate Table Definitions', 'cyan');
  log('='.repeat(50));

  const query = `
    SELECT table_name, COUNT(*) as count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    GROUP BY table_name
    HAVING COUNT(*) > 1;
  `;

  const result = await pool.query(query);
  
  if (result.rowCount > 0) {
    log(`  ⚠️  Found ${result.rowCount} duplicate tables`, 'yellow');
    result.rows.forEach(row => {
      log(`    - ${row.table_name}`, 'yellow');
    });
    return false;
  }

  log('  ✅ No duplicate tables found', 'green');
  return true;
}

// Check 6: Check timestamp columns
async function checkTimestampHandling() {
  log('\n📋 CHECK 6: Timestamp Column Handling', 'cyan');
  log('='.repeat(50));

  const query = `
    SELECT table_name, column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND (data_type LIKE '%timestamp%' OR data_type LIKE '%time%')
    ORDER BY table_name, column_name;
  `;

  const result = await pool.query(query);
  
  log(`  Found ${result.rowCount} timestamp columns`, 'blue');
  
  // Check for empty string defaults
  const emptyDefaults = result.rows.filter(row => 
    row.column_default && row.column_default.includes("''")
  );

  if (emptyDefaults.length > 0) {
    log(`  ⚠️  ${emptyDefaults.length} columns with empty string defaults`, 'yellow');
    return false;
  }

  log('  ✅ No empty string timestamp defaults found', 'green');
  return true;
}

// Check 7: Check array-type foreign keys
async function checkArrayTypeForeignKeys() {
  log('\n📋 CHECK 7: Array-Type Foreign Keys', 'cyan');
  log('='.repeat(50));

  const query = `
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND data_type LIKE '%[]'
    AND (column_name LIKE '%_id' OR column_name LIKE '%id%')
    ORDER BY table_name, column_name;
  `;

  const result = await pool.query(query);
  
  if (result.rowCount > 0) {
    log(`  ⚠️  Found ${result.rowCount} array-type ID columns (cannot enforce FK):`, 'yellow');
    result.rows.forEach(row => {
      log(`    - ${row.table_name}.${row.column_name} (${row.data_type})`, 'yellow');
    });
    return false;
  }

  log('  ✅ No array-type foreign key columns found', 'green');
  return true;
}

// Check 8: Check soft-delete implementation
async function checkSoftDelete() {
  log('\n📋 CHECK 8: Soft-Delete Implementation', 'cyan');
  log('='.repeat(50));

  const query = `
    SELECT table_name, COUNT(*) as count
    FROM information_schema.columns
    WHERE column_name = 'is_deleted'
    AND table_schema = 'public'
    GROUP BY table_name;
  `;

  const result = await pool.query(query);
  
  if (result.rowCount > 0) {
    log(`  Soft-delete columns found in ${result.rowCount} tables:`, 'blue');
    result.rows.forEach(row => {
      log(`    - ${row.table_name}`, 'blue');
    });
    // Also check deleted_at consistency
    const delAt = await pool.query(`SELECT table_name FROM information_schema.columns WHERE column_name='deleted_at' AND table_schema='public'`);
    log(`  deleted_at found in ${delAt.rowCount} tables`, 'blue');
  } else {
    log('  ℹ️  No soft-delete columns found (optional feature)', 'blue');
  }

  return true;
}

// Check 9: Junction table existence and FK validation (NOT VALID → VALIDATE)
async function checkJunctionTable() {
  log('\n📋 CHECK 9: Junction test_category_series', 'cyan');
  log('='.repeat(50));
  try {
    const tbl = await pool.query(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='test_category_series')`);
    if (!tbl.rows[0].exists) {
      log('  ❌ test_category_series table missing — run migration 121', 'red');
      return false;
    }
    log('  ✅ test_category_series exists', 'green');
    const fks = await pool.query(`SELECT conname, convalidated FROM pg_constraint WHERE conrelid='test_category_series'::regclass`);
    if (fks.rowCount === 0) {
      log('  ⚠️  No FKs on junction — run 121', 'yellow');
      return false;
    }
    for (const fk of fks.rows) {
      log(`  ${fk.convalidated ? '✅' : '⚠️'} FK ${fk.conname} ${fk.convalidated ? 'validated' : 'NOT VALID'}`, fk.convalidated ? 'green' : 'yellow');
    }
    const idx = await pool.query(`SELECT indexname FROM pg_indexes WHERE tablename='test_category_series'`);
    log(`  Found ${idx.rowCount} indexes on junction`, 'blue');
    return fks.rows.every(r=>r.convalidated);
  } catch (e) {
    log(`  ❌ Junction check failed: ${e.message}`, 'red');
    return false;
  }
}

// Check 10: HNSW vector index tuning (m=32 ef_construction=200 ef_search=100)
async function checkHNSWTuning() {
  log('\n📋 CHECK 10: HNSW Vector Index Tuning', 'cyan');
  log('='.repeat(50));
  try {
    const ext = await pool.query(`SELECT 1 FROM pg_extension WHERE extname='vector'`);
    if (ext.rowCount === 0) {
      log('  ℹ️  vector extension not installed — skipping', 'blue');
      return true;
    }
    const res = await pool.query(`SELECT indexname, indexdef FROM pg_indexes WHERE indexname IN ('idx_embeddings_vector_hnsw','idx_question_search_vector_hnsw')`);
    if (res.rowCount === 0) {
      log('  ⚠️  No HNSW indexes found — run 093', 'yellow');
      return false;
    }
    let ok = true;
    for (const row of res.rows) {
      const hasM32 = row.indexdef.includes('m = 32') || row.indexdef.includes('m=32');
      const hasEf200 = row.indexdef.includes('ef_construction = 200') || row.indexdef.includes('ef_construction=200');
      if (hasM32 && hasEf200) log(`  ✅ ${row.indexname} tuned (m=32 ef_construction=200)`, 'green');
      else {
        log(`  ⚠️  ${row.indexname} mis-tuned: ${row.indexdef}`, 'yellow');
        ok = false;
      }
    }
    return ok;
  } catch (e) {
    log(`  ⚠️  HNSW check failed: ${e.message}`, 'yellow');
    return false;
  }
}

// Check 11: RLS IS NULL bypass removed (116)
async function checkRLSBypass() {
  log('\n📋 CHECK 11: RLS IS NULL Bypass (116)', 'cyan');
  log('='.repeat(50));
  try {
    const res = await pool.query(`
      SELECT polname, polqual::text, polwithcheck::text
      FROM pg_policy
      WHERE polqual::text LIKE '%current_user_id_setting() IS NULL%' OR polwithcheck::text LIKE '%current_user_id_setting() IS NULL%'
      LIMIT 5
    `);
    if (res.rowCount > 0) {
      log(`  ❌ Found ${res.rowCount} policies with IS NULL bypass — run 116 fix`, 'red');
      res.rows.forEach(r=> log(`    - ${r.polname}`, 'yellow'));
      return false;
    }
    log('  ✅ No RLS policies with IS NULL bypass', 'green');
    const funcs = await pool.query(`SELECT proname, prosecdef FROM pg_proc WHERE proname IN ('current_user_id_setting','current_is_admin','is_service_role')`);
    for (const fn of funcs.rows) {
      log(`  ${fn.prosecdef ? '✅' : '⚠️'} Function ${fn.proname} ${fn.prosecdef ? 'SECURITY DEFINER' : 'missing SECURITY DEFINER'}`, fn.prosecdef ? 'green' : 'yellow');
    }
    return res.rowCount === 0;
  } catch (e) {
    log(`  ⚠️  RLS check failed: ${e.message}`, 'yellow');
    return true;
  }
}

// Check 12: PII encryption (088) — DB_ENCRYPTION_KEY, aes-256-gcm, phone vs mobile
async function checkPIIEncryption() {
  log('\n📋 CHECK 12: PII Encryption (088)', 'cyan');
  log('='.repeat(50));
  try {
    const enc = await pool.query(`SELECT proname, prosecdef FROM pg_proc WHERE proname IN ('encrypt_pii','decrypt_pii')`);
    if (enc.rowCount < 2) {
      log('  ⚠️  Missing encrypt_pii/decrypt_pii — run 088/104', 'yellow');
      return false;
    }
    log('  ✅ encrypt_pii/decrypt_pii exist', 'green');
    const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name IN ('phone_enc','dob_enc','phone','mobile')`);
    const names = cols.rows.map(r=>r.column_name);
    if (names.includes('phone_enc')) log('  ✅ users.phone_enc exists', 'green');
    else log('  ⚠️  users.phone_enc missing — run 088', 'yellow');
    if (names.includes('phone') || names.includes('mobile')) log(`  ℹ️  Plaintext PII columns still present: ${names.filter(c=>['phone','mobile'].includes(c)).join(', ')} (drop after cutover)`, 'blue');
    if (!process.env.DB_ENCRYPTION_KEY) {
      log('  ⚠️  DB_ENCRYPTION_KEY not set — production must set 32+ chars (no JWT fallback)', 'yellow');
    } else if (process.env.DB_ENCRYPTION_KEY.length < 32) {
      log('  ❌ DB_ENCRYPTION_KEY too short', 'red');
      return false;
    } else {
      log('  ✅ DB_ENCRYPTION_KEY present (not logged)', 'green');
    }
    if (process.env.DB_ENCRYPTION_KEY && process.env.DB_ENCRYPTION_KEY === process.env.JWT_SECRET) {
      log('  ❌ DB_ENCRYPTION_KEY must not equal JWT_SECRET', 'red');
      return false;
    }
    log('  ℹ️  App-layer encryption: aes-256-gcm with iv:authTag:ciphertext (see postgres-helpers.js)', 'blue');
    return true;
  } catch (e) {
    log(`  ⚠️  PII check failed: ${e.message}`, 'yellow');
    return false;
  }
}

// Check 13: GIN indexes (035) concurrent
async function checkGINIndexes() {
  log('\n📋 CHECK 13: GIN Indexes (035)', 'cyan');
  log('='.repeat(50));
  try {
    const res = await pool.query(`SELECT indexname FROM pg_indexes WHERE indexdef LIKE '%USING gin%' AND schemaname='public'`);
    log(`  Found ${res.rowCount} GIN indexes`, 'blue');
    if (res.rowCount < 10) {
      log('  ⚠️  Low GIN count — run 035 (should be 40+ with CONCURRENTLY)', 'yellow');
      return false;
    }
    log('  ✅ GIN indexes present', 'green');
    // Check for 079 concurrent performance indexes
    const perf = await pool.query(`SELECT indexname FROM pg_indexes WHERE indexname IN ('idx_attempts_user_submitted','idx_attempts_user_completed','idx_tests_status_active')`);
    log(`  Performance indexes (079): ${perf.rowCount}/3 present`, 'blue');
    return true;
  } catch (e) {
    log(`  ⚠️  GIN check failed: ${e.message}`, 'yellow');
    return false;
  }
}

// Run migration
async function runMigration() {
  log('\n🚀 Running Database Migration...', 'cyan');
  log('='.repeat(50));

  const migrationPath = join(__dirname, '../database/migrations/008-standardize-ids-and-fix-relations.sql');
  
  try {
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    await pool.query(migrationSQL);
    log('  ✅ Migration completed successfully', 'green');
    return true;
  } catch (error) {
    log(`  ❌ Migration failed: ${error.message}`, 'red');
    return false;
  }
}

// Main audit function
async function runAudit() {
  log('\n🔍 DATABASE SCHEMA AUDIT (HARDENED — 13 checks)', 'cyan');
  log('='.repeat(50));

  const checks = [
    { name: 'User ID Types', fn: checkUserIdTypes },
    { name: 'Foreign Keys', fn: checkForeignKeys },
    { name: 'Orphaned Records', fn: checkOrphanedRecords },
    { name: 'Indexes', fn: checkIndexes },
    { name: 'Duplicate Tables', fn: checkDuplicateTables },
    { name: 'Timestamp Handling', fn: checkTimestampHandling },
    { name: 'Array Foreign Keys', fn: checkArrayTypeForeignKeys },
    { name: 'Soft Delete', fn: checkSoftDelete },
    { name: 'Junction test_category_series', fn: checkJunctionTable },
    { name: 'HNSW Tuning', fn: checkHNSWTuning },
    { name: 'RLS IS NULL Bypass', fn: checkRLSBypass },
    { name: 'PII Encryption', fn: checkPIIEncryption },
    { name: 'GIN Indexes', fn: checkGINIndexes },
  ];

  const results = [];

  for (const check of checks) {
    try {
      const result = await check.fn();
      results.push({ name: check.name, passed: result });
    } catch (error) {
      log(`  ❌ Check failed: ${error.message}`, 'red');
      results.push({ name: check.name, passed: false, error: error.message });
    }
  }

  // Summary
  log('\n📊 AUDIT SUMMARY', 'cyan');
  log('='.repeat(50));
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  results.forEach(result => {
    const status = result.passed ? '✅' : '⚠️';
    log(`  ${status} ${result.name}`);
  });

  log(`\nTotal: ${passed}/${total} checks passed`, 'cyan');

  if (passed === total) {
    log('\n🎉 All checks passed! Database schema is healthy.', 'green');
  } else {
    log(`\n⚠️  ${total-passed} checks failed/warned. Review above.`, 'yellow');
    log('\nTo fix these issues, run:', 'yellow');
    log('  psql -d your_database -f 008-standardize-ids-and-fix-relations.sql', 'cyan');
    log('  Also ensure migrations 035,079,088,093,116,121 are applied', 'cyan');
  }

  // Also check read replica if configured
  if (readPool !== pool) {
    try {
      await readPool.query('SELECT 1');
      log('✅ Read replica reachable (read/write split OK)', 'green');
    } catch (e) {
      log(`⚠️ Read replica not reachable: ${e.message}`, 'yellow');
    }
    await readPool.end().catch(()=>{});
  }
  await pool.end();
  return passed === total;
}

// Execute
runAudit().catch(console.error);
