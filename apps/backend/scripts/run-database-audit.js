/**
 * Database Schema Audit and Fix Script
 * Run this to verify and fix database schema issues
 * 
 * Usage: node scripts/run-database-audit.js
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database connection - match postgres-helpers.js configuration
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
  
  // Check for specific critical FKs
  const criticalFKs = [
    { table: 'questions', column: 'test_id', references: 'tests' },
    { table: 'attempts', column: 'user_id', references: 'users' },
    { table: 'attempts', column: 'test_id', references: 'tests' },
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
  ];

  let hasOrphans = false;

  for (const check of checks) {
    const result = await pool.query(check.query);
    const count = parseInt(result.rows[0].count);
    
    if (count > 0) {
      log(`  ⚠️  ${check.name}: ${count} orphaned records`, 'yellow');
      hasOrphans = true;
    } else {
      log(`  ✅ ${check.name}: No orphans`, 'green');
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
  
  // Check for critical missing indexes
  const criticalIndexes = [
    { table: 'users', index: 'users_email_key' },
    { table: 'questions', index: 'idx_questions_test_id' },
    { table: 'attempts', index: 'idx_attempts_user_id' },
    { table: 'audit_logs', index: 'idx_audit_logs_user_id' },
  ];

  criticalIndexes.forEach(({ table, index }) => {
    const exists = result.rows.some(row => row.indexname === index || row.indexname.includes(table));
    if (exists) {
      log(`  ✅ Index on ${table}`, 'green');
    } else {
      log(`  ⚠️  Missing index on ${table}`, 'yellow');
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
  } else {
    log('  ℹ️  No soft-delete columns found (optional feature)', 'blue');
  }

  return true;
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
  log('\n🔍 DATABASE SCHEMA AUDIT', 'cyan');
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
    log('\n⚠️  Some checks failed. Consider running the migration.', 'yellow');
    log('\nTo fix these issues, run:', 'yellow');
    log('  psql -d your_database -f 008-standardize-ids-and-fix-relations.sql', 'cyan');
  }

  await pool.end();
  return passed === total;
}

// Execute
runAudit().catch(console.error);
