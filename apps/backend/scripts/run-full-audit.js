/**
 * Comprehensive Schema Audit - Check All Critical Issues
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

const colors = {
  reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m'
};

function log(msg, color = 'reset') { console.log(`${colors[color]}${msg}${colors.reset}`); }

async function runComprehensiveAudit() {
  console.log('\n🔍 COMPREHENSIVE DATABASE SCHEMA AUDIT\n');
  console.log('='.repeat(60));

  let issues = [];
  let fixes = [];

  // CHECK 1: User ID Type Consistency
  log('\n📋 1. USER ID TYPE CONSISTENCY:', 'cyan');
  const userIdQuery = `
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE column_name = 'user_id' AND table_schema = 'public'
  `;
  const userIds = await pool.query(userIdQuery);
  const types = new Set(userIds.rows.map(r => r.data_type));
  
  if (types.size > 1) {
    log(`  ⚠️  Multiple types found: ${Array.from(types).join(', ')}`, 'yellow');
    userIds.rows.forEach(r => {
      log(`    - ${r.table_name}: ${r.data_type}`, 'yellow');
    });
    issues.push('User ID type inconsistency');
    fixes.push('Standardize all user_id to INTEGER');
  } else {
    log(`  ✅ All user_id are ${Array.from(types)[0]}`, 'green');
  }

  // CHECK 2: Duplicate table definitions (check if tables exist with proper structure)
  log('\n📋 2. TABLE STRUCTURE:', 'cyan');
  const coreTables = ['permissions', 'roles', 'user_roles', 'role_permissions', 'audit_logs', 'navigation_config', 'coming_soon_features'];
  
  for (const table of coreTables) {
    const exists = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name = $1 AND table_schema = 'public'
    `, [table]);
    
    if (exists.rows.length > 0) {
      const cols = await pool.query(`
        SELECT column_name, data_type FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = 'public'
      `, [table]);
      
      const hasUuidId = cols.rows.some(c => c.column_name === 'id' && c.data_type === 'uuid');
      const hasIntId = cols.rows.some(c => c.column_name === 'id' && c.data_type === 'integer');
      
      if (hasUuidId) {
        log(`  ℹ️  ${table}: uses UUID id`, 'blue');
      } else if (hasIntId) {
        log(`  ✅ ${table}: uses INTEGER id`, 'green');
      }
    }
  }

  // CHECK 3: Missing Foreign Key Constraints
  log('\n📋 3. FOREIGN KEY CONSTRAINTS:', 'cyan');
  const criticalRelations = [
    { table: 'questions', col: 'chapter_id', ref: 'chapters' },
    { table: 'questions', col: 'topic_id', ref: 'topics' },
    { table: 'questions', col: 'test_id', ref: 'tests' },
    { table: 'tests', col: 'series_id', ref: 'test_series' },
    { table: 'tests', col: 'stage_id', ref: 'stages' },
    { table: 'attempts', col: 'user_id', ref: 'users' },
    { table: 'attempts', col: 'test_id', ref: 'tests' },
    { table: 'chapters', col: 'unit_id', ref: 'units' },
    { table: 'topics', col: 'chapter_id', ref: 'chapters' },
    { table: 'subtopics', col: 'topic_id', ref: 'topics' },
  ];

  for (const rel of criticalRelations) {
    const fkExists = await pool.query(`
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = $1 AND kcu.column_name = $2 AND tc.constraint_type = 'FOREIGN KEY'
    `, [rel.table, rel.col]);
    
    if (fkExists.rows.length > 0) {
      log(`  ✅ ${rel.table}.${rel.col} -> ${rel.ref}`, 'green');
    } else {
      log(`  ⚠️  Missing FK: ${rel.table}.${rel.col} -> ${rel.ref}`, 'yellow');
      issues.push(`Missing FK: ${rel.table}.${rel.col}`);
    }
  }

  // CHECK 4: Schema inconsistencies - Array FKs
  log('\n📋 4. ARRAY-TYPE FOREIGN KEYS:', 'cyan');
  const arrayCols = await pool.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type LIKE '%array%'
    AND (column_name LIKE '%_id' OR column_name LIKE '%ids')
  `);

  if (arrayCols.rows.length > 0) {
    log(`  Found ${arrayCols.rows.length} array columns:`, 'yellow');
    arrayCols.rows.forEach(r => {
      log(`    - ${r.table_name}.${r.column_name}`, 'yellow');
    });
    issues.push('Array-type foreign keys present');
  } else {
    log('  ✅ No array-type foreign keys found', 'green');
  }

  // CHECK 5: JSONB columns (informational)
  log('\n📋 5. JSONB COLUMNS:', 'cyan');
  const jsonbCols = await pool.query(`
    SELECT table_name, COUNT(*) as cnt 
    FROM information_schema.columns
    WHERE data_type = 'jsonb' AND table_schema = 'public'
    GROUP BY table_name
    ORDER BY cnt DESC
  `);
  log(`  Total JSONB columns: ${jsonbCols.rows.reduce((a, b) => a + parseInt(b.cnt), 0)}`, 'blue');
  jsonbCols.rows.slice(0, 5).forEach(r => {
    log(`    - ${r.table_name}: ${r.cnt} columns`, 'blue');
  });

  // CHECK 6: Index Analysis
  log('\n📋 6. INDEX COVERAGE:', 'cyan');
  const indexCount = await pool.query(`
    SELECT COUNT(*) as cnt FROM pg_indexes WHERE schemaname = 'public'
  `);
  log(`  Total indexes: ${indexCount.rows[0].cnt}`, 'blue');

  // Check critical missing indexes
  const criticalIndexes = ['idx_questions_test_id', 'idx_questions_category_id', 'idx_attempts_user_id', 'idx_attempts_test_id'];
  for (const idx of criticalIndexes) {
    const exists = await pool.query(`SELECT 1 FROM pg_indexes WHERE indexname = $1`, [idx]);
    if (exists.rows.length > 0) {
      log(`  ✅ ${idx}`, 'green');
    } else {
      log(`  ⚠️  Missing: ${idx}`, 'yellow');
    }
  }

  // CHECK 7: Soft Delete Implementation
  log('\n📋 7. SOFT DELETE COLUMNS:', 'cyan');
  const softDeleteTables = await pool.query(`
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'is_deleted' AND table_schema = 'public'
  `);

  if (softDeleteTables.rows.length > 0) {
    log(`  Found in ${softDeleteTables.rows.length} tables:`, 'blue');
    softDeleteTables.rows.forEach(r => {
      log(`    - ${r.table_name}`, 'blue');
    });
  } else {
    log('  ℹ️  No soft-delete columns found (optional feature)', 'blue');
  }

  // CHECK 8: Orphaned Records
  log('\n📋 8. ORPHANED RECORDS:', 'cyan');
  const orphanChecks = [
    { name: 'questions -> chapter_id', q: `SELECT COUNT(*) FROM questions q LEFT JOIN chapters c ON q.chapter_id = c.id WHERE q.chapter_id IS NOT NULL AND c.id IS NULL` },
    { name: 'questions -> topic_id', q: `SELECT COUNT(*) FROM questions q LEFT JOIN topics t ON q.topic_id = t.id WHERE q.topic_id IS NOT NULL AND t.id IS NULL` },
    { name: 'attempts -> user_id', q: `SELECT COUNT(*) FROM attempts a LEFT JOIN users u ON a.user_id = u.id WHERE a.user_id IS NOT NULL AND u.id IS NULL` },
    { name: 'attempts -> test_id', q: `SELECT COUNT(*) FROM attempts a LEFT JOIN tests t ON a.test_id = t.id WHERE a.test_id IS NOT NULL AND t.id IS NULL` },
  ];

  for (const check of orphanChecks) {
    const result = await pool.query(check.q);
    const count = parseInt(result.rows[0].count);
    if (count > 0) {
      log(`  ⚠️  ${check.name}: ${count} orphans`, 'yellow');
      issues.push(`Orphaned: ${check.name}`);
    } else {
      log(`  ✅ ${check.name}`, 'green');
    }
  }

  // CHECK 9: Timestamp Issues
  log('\n📋 9. TIMESTAMP HANDLING:', 'cyan');
  const timestampCols = await pool.query(`
    SELECT table_name, column_name, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND (data_type LIKE '%timestamp%')
    AND column_default LIKE '%'''
  `);

  if (timestampCols.rows.length > 0) {
    log(`  ⚠️  Found ${timestampCols.rows.length} with empty string defaults`, 'yellow');
  } else {
    log('  ✅ No empty string timestamp defaults', 'green');
  }

  // CHECK 10: Public ID usage
  log('\n📋 10. PUBLIC ID COLUMNS:', 'cyan');
  const publicIdCols = await pool.query(`
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'public_id' AND table_schema = 'public'
  `);

  log(`  Tables with public_id: ${publicIdCols.rows.length}`, 'blue');
  publicIdCols.rows.forEach(r => {
    log(`    - ${r.table_name}`, 'blue');
  });

  // SUMMARY
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 AUDIT SUMMARY:', 'cyan');
  log('='.repeat(40), 'cyan');
  
  if (issues.length === 0) {
    log('\n🎉 No critical issues found! Database is healthy.', 'green');
  } else {
    log(`\n⚠️  Found ${issues.length} issues:`, 'yellow');
    issues.forEach((issue, i) => {
      log(`  ${i+1}. ${issue}`, 'yellow');
    });
    
    log('\n📝 Recommended fixes:', 'cyan');
    fixes.forEach((fix, i) => {
      log(`  ${i+1}. ${fix}`, 'blue');
    });
  }

  await pool.end();
}

runComprehensiveAudit().catch(err => {
  console.error('Audit failed:', err.message);
  process.exit(1);
});