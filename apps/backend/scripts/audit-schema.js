/**
 * Complete Database Schema Audit
 * Checks all tables, columns, relationships, and identifies issues
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  max: 5,
});

let connectionAttempted = false;

pool.on('error', (err) => {
  if (!connectionAttempted) {
    console.error('Connection error:', err.message);
    process.exit(1);
  }
});

async function query(sql, params = []) {
  try {
    const result = await pool.query(sql, params);
    connectionAttempted = true;
    return result;
  } catch (err) {
    connectionAttempted = true;
    throw err;
  }
}

const sections = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(msg, section = 'reset') {
  console.log(`${sections[section]}${msg}${sections.reset}`);
}

async function runAudit() {
  log('\n' + '='.repeat(70), 'cyan');
  log('  COMPREHENSIVE DATABASE SCHEMA AUDIT', 'cyan');
  log('='.repeat(70), 'cyan');

  const issues = [];
  const warnings = [];
  const successes = [];

  try {
    // =====================================================================
    // 1. TABLE OVERVIEW
    // =====================================================================
    log('\n📊 SECTION 1: TABLE OVERVIEW', 'cyan');
    log('-'.repeat(70), 'blue');

    const tables = await query(`
      SELECT 
        t.table_name,
        c.reltuples::bigint as row_count,
        pg_size_pretty(pg_total_relation_size(c.oid)) as size
      FROM information_schema.tables t
      JOIN pg_class c ON c.relname = t.table_name
      WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      ORDER BY c.reltuples DESC
      LIMIT 30
    `);

    log(`\nFound ${tables.rows.length} tables:`, 'blue');
    tables.rows.forEach((t, i) => {
      log(`  ${i+1}. ${t.table_name.padEnd(30)} ${t.row_count?.toString().padStart(10) || '0'} rows, ${t.size || 'N/A'}`, 'blue');
    });

    // =====================================================================
    // 2. COLUMN ANALYSIS
    // =====================================================================
    log('\n\n📊 SECTION 2: COLUMN ANALYSIS', 'cyan');
    log('-'.repeat(70), 'blue');

    const columnStats = await query(`
      SELECT 
        COUNT(DISTINCT table_name) as tables_with_jsonb,
        COUNT(*) as total_jsonb_columns
      FROM information_schema.columns
      WHERE data_type = 'jsonb' AND table_schema = 'public'
    `);

    log(`\nJSONB Columns: ${columnStats.rows[0].total_jsonb_columns} columns in ${columnStats.rows[0].tables_with_jsonb} tables`, 'blue');

    const columnTypes = await query(`
      SELECT 
        data_type,
        COUNT(*) as count
      FROM information_schema.columns
      WHERE table_schema = 'public'
      GROUP BY data_type
      ORDER BY count DESC
      LIMIT 10
    `);

    log('\nTop column types:', 'blue');
    columnTypes.rows.forEach(r => {
      log(`  ${r.data_type.padEnd(20)} ${r.count.padStart(10)}`, 'blue');
    });

    // =====================================================================
    // 3. PRIMARY KEY ANALYSIS
    // =====================================================================
    log('\n\n📊 SECTION 3: PRIMARY KEY ANALYSIS', 'cyan');
    log('-'.repeat(70), 'blue');

    const pkCheck = await query(`
      SELECT 
        COUNT(DISTINCT t.table_name) as tables_with_pk
      FROM information_schema.tables t
      LEFT JOIN information_schema.table_constraints tc 
        ON tc.table_name = t.table_name 
        AND tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
      WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
    `);

    const totalTables = await query(`
      SELECT COUNT(*) as cnt 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);

    const tablesWithPK = parseInt(pkCheck.rows[0].tables_with_pk);
    const total = parseInt(totalTables.rows[0].cnt);

    if (tablesWithPK === total) {
      log(`\n✅ All ${total} tables have primary keys`, 'green');
      successes.push('All tables have primary keys');
    } else {
      log(`\n⚠️  Only ${tablesWithPK}/${total} tables have primary keys`, 'yellow');
      issues.push(`${total - tablesWithPK} tables missing primary keys`);
    }

    // =====================================================================
    // 4. FOREIGN KEY ANALYSIS
    // =====================================================================
    log('\n\n📊 SECTION 4: FOREIGN KEY ANALYSIS', 'cyan');
    log('-'.repeat(70), 'blue');

    const fkStats = await query(`
      SELECT COUNT(DISTINCT constraint_name) as fk_count
      FROM information_schema.table_constraints
      WHERE constraint_type = 'FOREIGN KEY'
      AND table_schema = 'public'
    `);

    log(`\nTotal Foreign Keys: ${fkStats.rows[0].fk_count}`, 'blue');

    const fkDetails = await query(`
      SELECT 
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table,
        ccu.column_name AS foreign_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      ORDER BY tc.table_name
      LIMIT 20
    `);

    log('\nSample Foreign Keys (first 20):', 'blue');
    fkDetails.rows.forEach(r => {
      log(`  ${r.table_name}.${r.column_name} → ${r.foreign_table}.${r.foreign_column}`, 'blue');
    });

    // Check for critical missing FKs
    const potentialMissingFKs = await query(`
      SELECT 
        kcu.table_name,
        kcu.column_name
      FROM information_schema.key_column_usage kcu
      LEFT JOIN information_schema.table_constraints tc 
        ON tc.constraint_name = kcu.constraint_name 
        AND tc.constraint_type = 'FOREIGN KEY'
      WHERE kcu.table_schema = 'public'
      AND kcu.column_name LIKE '%_id'
      AND kcu.column_name NOT IN ('id')
      AND tc.constraint_name IS NULL
      LIMIT 10
    `);

    if (potentialMissingFKs.rows.length > 0) {
      log(`\n⚠️  Found ${potentialMissingFKs.rows.length} columns that might need FK constraints:`, 'yellow');
      potentialMissingFKs.rows.forEach(r => {
        log(`  - ${r.table_name}.${r.column_name}`, 'yellow');
      });
      warnings.push('Potential missing FK constraints');
    } else {
      log('\n✅ All _id columns appear to have FK constraints', 'green');
      successes.push('All ID columns have FK constraints');
    }

    // =====================================================================
    // 5. INDEX ANALYSIS
    // =====================================================================
    log('\n\n📊 SECTION 5: INDEX ANALYSIS', 'cyan');
    log('-'.repeat(70), 'blue');

    const indexStats = await query(`
      SELECT COUNT(*) as cnt FROM pg_indexes WHERE schemaname = 'public'
    `);

    log(`\nTotal Indexes: ${indexStats.rows[0].cnt}`, 'blue');

    const unusedIndexes = await query(`
      SELECT 
        schemaname || '.' || relname AS table_name,
        indexrelname AS index_name,
        idx_scan
      FROM pg_stat_user_indexes
      WHERE idx_scan = 0 
      AND schemaname = 'public'
      LIMIT 10
    `);

    if (unusedIndexes.rows.length > 0) {
      log(`\nℹ️  Found ${unusedIndexes.rows.length} unused indexes (candidates for removal):`, 'yellow');
      unusedIndexes.rows.forEach(r => {
        log(`  - ${r.index_name} on ${r.table_name}`, 'yellow');
      });
    } else {
      log('\n✅ All indexes are being used', 'green');
    }

    // =====================================================================
    // 6. USER_ID CONSISTENCY CHECK
    // =====================================================================
    log('\n\n📊 SECTION 6: USER_ID TYPE CONSISTENCY', 'cyan');
    log('-'.repeat(70), 'blue');

    const userIdTypes = await query(`
      SELECT 
        table_name,
        column_name,
        data_type
      FROM information_schema.columns
      WHERE column_name = 'user_id'
      AND table_schema = 'public'
      ORDER BY table_name
    `);

    const typeSet = new Set(userIdTypes.rows.map(r => r.data_type));
    
    log(`\nFound ${userIdTypes.rows.length} user_id columns:`, 'blue');
    userIdTypes.rows.forEach(r => {
      log(`  ${r.table_name.padEnd(35)} ${r.data_type}`, 'blue');
    });

    if (typeSet.size === 1) {
      log(`\n✅ All user_id columns are ${Array.from(typeSet)[0]}`, 'green');
      successes.push('User ID types consistent');
    } else {
      log(`\n⚠️  WARNING: Multiple user_id types found: ${Array.from(typeSet).join(', ')}`, 'yellow');
      issues.push('Inconsistent user_id types');
    }

    // =====================================================================
    // 7. ORPHANED RECORDS CHECK
    // =====================================================================
    log('\n\n📊 SECTION 7: ORPHANED RECORDS CHECK', 'cyan');
    log('-'.repeat(70), 'blue');

    const orphanChecks = [
      { name: 'questions → chapter_id', table: 'questions', col: 'chapter_id', refTable: 'chapters' },
      { name: 'questions → topic_id', table: 'questions', col: 'topic_id', refTable: 'topics' },
      { name: 'attempts → user_id', table: 'attempts', col: 'user_id', refTable: 'users' },
      { name: 'attempts → test_id', table: 'attempts', col: 'test_id', refTable: 'tests' },
      { name: 'test_questions → section_id', table: 'test_questions', col: 'section_id', refTable: 'test_sections' },
    ];

    for (const check of orphanChecks) {
      const orphanQuery = `
        SELECT COUNT(*) as cnt
        FROM ${check.table} child
        LEFT JOIN ${check.refTable} parent 
          ON child.${check.col} = parent.id
        WHERE child.${check.col} IS NOT NULL 
        AND parent.id IS NULL
      `;
      
      try {
        const result = await query(orphanQuery);
        const count = parseInt(result.rows[0].cnt);
        
        if (count > 0) {
          log(`  ⚠️  ${check.name}: ${count} orphaned records`, 'yellow');
          issues.push(`Orphaned records: ${check.name}`);
        } else {
          log(`  ✅ ${check.name}: No orphans`, 'green');
          successes.push(`No orphans in ${check.name}`);
        }
      } catch (err) {
        log(`  ℹ️  ${check.name}: Table may not exist`, 'blue');
      }
    }

    // =====================================================================
    // 8. ARRAY-TYPE COLUMNS
    // =====================================================================
    log('\n\n📊 SECTION 8: ARRAY-TYPE COLUMNS', 'cyan');
    log('-'.repeat(70), 'blue');

    const arrayCols = await query(`
      SELECT 
        table_name,
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND data_type LIKE '%array%'
      AND (column_name LIKE '%_id' OR column_name LIKE '%ids' OR column_name LIKE '%path%')
      ORDER BY table_name
    `);

    if (arrayCols.rows.length > 0) {
      log(`\n⚠️  Found ${arrayCols.rows.length} array-type ID columns (cannot enforce FK):`, 'yellow');
      arrayCols.rows.forEach(r => {
        log(`  - ${r.table_name}.${r.column_name} (${r.data_type})`, 'yellow');
      });
      warnings.push('Array-type foreign key columns found');
    } else {
      log('\n✅ No array-type foreign key columns found', 'green');
      successes.push('No array FK issues');
    }

    // =====================================================================
    // 9. SOFT DELETE IMPLEMENTATION
    // =====================================================================
    log('\n\n📊 SECTION 9: SOFT DELETE IMPLEMENTATION', 'cyan');
    log('-'.repeat(70), 'blue');

    const softDeleteTables = await query(`
      SELECT 
        table_name,
        column_name
      FROM information_schema.columns
      WHERE column_name IN ('is_deleted', 'deleted_by', 'deleted_at')
      AND table_schema = 'public'
      ORDER BY table_name
    `);

    const softDeleteTableSet = new Set(softDeleteTables.rows.map(r => r.table_name));
    
    if (softDeleteTables.rows.length > 0) {
      log(`\nℹ️  Soft-delete columns found in ${softDeleteTableSet.size} tables:`, 'blue');
      softDeleteTableSet.forEach(table => {
        log(`  - ${table}`, 'blue');
      });
    } else {
      log('\nℹ️  No soft-delete columns found (optional feature)', 'blue');
    }

    // =====================================================================
    // 10. TIMESTAMP HANDLING
    // =====================================================================
    log('\n\n📊 SECTION 10: TIMESTAMP HANDLING', 'cyan');
    log('-'.repeat(70), 'blue');

    const timestampIssues = await query(`
      SELECT 
        table_name,
        column_name,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND data_type LIKE '%timestamp%'
      AND (column_default LIKE '%''%' OR column_default LIKE '%""%')
      LIMIT 10
    `);

    if (timestampIssues.rows.length > 0) {
      log(`\n⚠️  Found ${timestampIssues.rows.length} timestamp columns with empty string defaults:`, 'yellow');
      timestampIssues.rows.forEach(r => {
        log(`  - ${r.table_name}.${r.column_name}`, 'yellow');
      });
      warnings.push('Timestamp columns with empty string defaults');
    } else {
      log('\n✅ No timestamp columns with empty string defaults', 'green');
      successes.push('Clean timestamp handling');
    }

    // =====================================================================
    // SUMMARY
    // =====================================================================
    log('\n\n' + '='.repeat(70), 'cyan');
    log('  AUDIT SUMMARY', 'cyan');
    log('='.repeat(70), 'cyan');

    log(`\n✅ Successes: ${successes.length}`, 'green');
    successes.forEach(s => log(`  ✓ ${s}`, 'green'));

    if (warnings.length > 0) {
      log(`\n⚠️  Warnings: ${warnings.length}`, 'yellow');
      warnings.forEach(w => log(`  ⚠ ${w}`, 'yellow'));
    }

    if (issues.length > 0) {
      log(`\n❌ Issues Found: ${issues.length}`, 'red');
      issues.forEach((issue, i) => {
        log(`  ${i+1}. ${issue}`, 'red');
      });

      log('\n\n📝 RECOMMENDED ACTIONS:', 'red');
      log('1. Fix user_id type inconsistencies (standardize to INTEGER)', 'red');
      log('2. Add missing foreign key constraints', 'red');
      log('3. Clean up orphaned records', 'red');
      log('4. Consider adding soft-delete to critical tables', 'red');
      log('5. Review array-type columns and create junction tables if needed', 'red');
    } else {
      log('\n🎉 No critical issues found! Database schema is healthy.', 'green');
    }

    log('\n' + '='.repeat(70), 'cyan');

  } catch (error) {
    log(`\n❌ Audit failed: ${error.message}`, 'red');
    log('Make sure your DATABASE_URL environment variable is set correctly.', 'yellow');
  } finally {
    await pool.end();
  }
}

runAudit();