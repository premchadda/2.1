# Database Schema Audit - Index

## 📚 Documentation Files

This directory contains comprehensive database schema fixes and documentation.

### Main Files

| File | Description | When to Use |
|------|-------------|-------------|
| **DATABASE_AUDIT_SUMMARY.md** | Executive summary of all issues | Start here |
| **QUICKSTART.md** | Quick start guide (3 steps) | First-time setup |
| **README.md** | Detailed technical documentation & Index | Deep dive |
| **008-standardize-ids-and-fix-relations.sql** | Main migration script | Apply fixes |
| **maintenance-scripts.sql** | Ongoing maintenance queries | Monthly maintenance |

### Code Files

| File | Description | Purpose |
|------|-------------|---------|
| `auditTrailManager.js` | Audit trail management class | Log all DB operations |
| `run-database-audit.js` | Audit verification script | Check database health |

## 🚀 Quick Navigation

### I want to...

**Fix my database** → Go to [QUICKSTART.md](QUICKSTART.md)

**Understand what was fixed** → Go to [DATABASE_AUDIT_SUMMARY.md](DATABASE_AUDIT_SUMMARY.md)

**Run maintenance** → Go to [maintenance-scripts.sql](maintenance-scripts.sql)

**Check database health** → Run `node scripts/run-database-audit.js`

## 📋 Issue Categories

### Data Integrity Issues
1. ✅ User ID type inconsistency
2. ✅ Array foreign keys
3. ✅ Missing FK constraints
4. ✅ Duplicate table definitions

### Performance Issues
5. ✅ Missing indexes
6. ✅ Orphaned records
7. ✅ Type casting overhead

### Security Issues
8. ✅ No audit trail
9. ✅ No soft-delete
10. ✅ No data validation

### Maintenance Issues
11. ✅ No monitoring functions
12. ✅ No cleanup procedures
13. ✅ No quality checks

## 🔧 Common Tasks

### First Time Setup
```bash
# 1. Run audit
node scripts/run-database-audit.js

# 2. Apply migration
psql -d your_database -f src/database/migrations/008-standardize-ids-and-fix-relations.sql

# 3. Verify
node scripts/run-database-audit.js
```

### Monthly Maintenance
```sql
-- In psql
ANALYZE;
VACUUM ANALYZE;
SELECT clean_old_audit_logs(365);
SELECT * FROM check_orphaned_records();
```

### Check Health
```bash
node scripts/run-database-audit.js
```

## 📊 What Changed

### Schema Changes
- All `user_id` columns now INTEGER
- Junction table `test_category_series` created
- 20+ new indexes added
- CHECK constraints added
- Soft-delete columns available

### New Functions
- `log_audit_event()` - Audit logging
- `check_orphaned_records()` - Data quality

---

## Database Schema Fixes Details

## Overview

This document describes the comprehensive database schema audit and fixes applied to standardize the database structure, fix relationship issues, and improve data integrity.

## Issues Fixed

### 1. ✅ User ID Type Standardization

**Problem**: `user_id` columns had inconsistent types (UUID vs INTEGER)

**Solution**: 
- Standardized all `user_id` references to INTEGER (matching `users.id` SERIAL type)
- Frontend uses UUID `public_id` format, but database relations use INTEGER
- Created helper functions for conversion:
  - `get_user_public_id(user_id)` - Get UUID string from integer ID
  - `get_user_id_from_public_id(public_id)` - Get integer ID from UUID string

**Migration**: `008-standardize-ids-and-fix-relations.sql`

### 2. ✅ Duplicate Table Definitions

**Problem**: Tables defined in multiple migration files:
- `permissions`, `roles`, `user_roles`, `role_permissions`
- `audit_logs`, `navigation_config`, `coming_soon_features`

**Solution**:
- Consolidated all definitions into single schema
- Used `CREATE TABLE IF NOT EXISTS` pattern
- Added missing columns via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`

### 3. ✅ Array-Type Foreign Keys

**Problem**: `test_categories.test_series_id` as INTEGER[] cannot enforce FK constraints

**Solution**:
- Created junction table `test_category_series`:
```sql
CREATE TABLE test_category_series (
    test_category_id INTEGER NOT NULL,
    test_series_id INTEGER NOT NULL,
    PRIMARY KEY (test_category_id, test_series_id),
    FOREIGN KEY (test_category_id) REFERENCES test_categories(id),
    FOREIGN KEY (test_series_id) REFERENCES test_series(id)
);
```
- Migrated existing array data to junction table
- Added GIN index for efficient array-like queries

### 4. ✅ Missing Foreign Key Constraints

**Added FKs**:
- `questions.series_id` → `test_series.id`
- `questions.topic_id` → `topics.id`
- `tests.stage_id` → `stages.id`
- `chapters.unit_id` → `units.id`
- `topics.chapter_id` → `chapters.id`
- `subtopics.topic_id` → `topics.id`

**Verification**:
```sql
SELECT * FROM check_orphaned_records();
```

### 5. ✅ Soft Delete Implementation

**Global Pattern**:
```sql
-- Add soft-delete columns to any table
SELECT add_soft_delete_columns('table_name');

-- Soft delete a record
SELECT soft_delete_record('tests', 1, 1);

-- Restore a soft-deleted record
SELECT restore_record('tests', 1);
```

**Columns Added**:
- `is_deleted BOOLEAN DEFAULT FALSE`
- `deleted_by INTEGER REFERENCES users(id)`
- `deleted_at TIMESTAMP`
- Index on `is_deleted`

### 6. ✅ Check Constraints

**Added validations**:

```sql
-- Coming soon features status
CHECK (status IN ('planned', 'in_development', 'testing', 'released'))

-- Priority
CHECK (priority IN ('high', 'medium', 'low'))

-- Progress percentage
CHECK (progress_percentage >= 0 AND progress_percentage <= 100)
```

### 7. ✅ Index Optimization

**Removed duplicates**:
- `idx_audit_logs_timestamp` vs `idx_audit_logs_created`

**Added missing indexes**:
```sql
-- Questions
idx_questions_category_id
idx_questions_chapter_id
idx_questions_topic_id
idx_questions_test_id

-- Test questions
idx_test_questions_test_id
idx_test_questions_question_id

-- Attempts
idx_attempts_user_id
idx_attempts_test_id
idx_attempts_created_at

-- Composite indexes
idx_questions_category_test ON questions(category_id, test_id)
idx_attempts_user_test ON attempts(user_id, test_id)
```

### 8. ✅ Timestamp Handling

**Issues Fixed**:
- Empty strings converted to NULL
- Inconsistent TIMESTAMP vs TIMESTAMP WITHOUT TIME ZONE
- No validation for unrealistic dates

**Solution**:
```sql
-- Clean invalid timestamps
SELECT clean_invalid_timestamps();

-- Ensure proper NULL defaults
ALTER TABLE tests ALTER COLUMN coming_soon_date DROP DEFAULT;
```

### 9. ✅ Audit Trail Consistency

**New Function**:
```sql
SELECT log_audit_event(
  user_id := 1,
  action := 'UPDATE',
  resource := 'tests',
  resource_id := '123',
  old_values := '{"name": "old"}'::jsonb,
  new_values := '{"name": "new"}'::jsonb,
  description := 'Updated test name',
  status := 'success'
);
```

**Usage in Node.js**:
```javascript
import AuditTrailManager from './infrastructure/database/auditTrailManager.js';

const auditManager = new AuditTrailManager(pool);

await auditManager.logCreate({
  userId: 1,
  resource: 'tests',
  resourceId: 123,
  data: { name: 'New Test' },
  ipAddress: '127.0.0.1',
});
```

### 10. ✅ Data Quality Functions

**Orphan Check**:
```sql
SELECT * FROM check_orphaned_records();
```

**Returns**:
| table_name | column_name | orphan_count |
|------------|-------------|--------------|
| questions | chapter_id | 0 |
| questions | topic_id | 0 |

## How to Apply Fixes

### Step 1: Backup Database
```bash
pg_dump -h your_host -U your_user your_database > backup_$(date +%Y%m%d).sql
```

### Step 2: Run Audit Script
```bash
cd apps/backend
node scripts/run-database-audit.js
```

This will:
- Check all schema issues
- Report problems found
- Suggest fixes

### Step 3: Apply Migration
```bash
psql -h your_host -U your_user -d your_database -f src/database/migrations/008-standardize-ids-and-fix-relations.sql
```

### Step 4: Verify Fixes
```bash
node scripts/run-database-audit.js
```

### Step 5: Clean Orphaned Records (if any)
```sql
-- Review orphans
SELECT * FROM check_orphaned_records();

-- Fix orphans manually or run cleanup
UPDATE questions SET chapter_id = NULL 
WHERE chapter_id IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM chapters WHERE id = questions.chapter_id);
```

## Verification Queries

### Check User ID Consistency
```sql
SELECT table_name, data_type
FROM information_schema.columns
WHERE column_name = 'user_id'
ORDER BY table_name;
```

### Check All Foreign Keys
```sql
SELECT 
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;
```

### Check Index Usage
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

## Maintenance Scripts

### Clean Old Audit Logs
```sql
SELECT clean_old_audit_logs(365); -- Keep 1 year
```

### Add Soft Delete to New Table
```sql
SELECT add_soft_delete_columns('your_new_table');
```

### Check Migration Status
```sql
-- Check if migration ran
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'test_category_series'
);
```

## Rollback Plan

If issues occur, rollback script available:
```sql
-- Drop junction table
DROP TABLE IF EXISTS test_category_series;

-- Remove soft-delete columns
ALTER TABLE table_name DROP COLUMN IF EXISTS is_deleted;
ALTER TABLE table_name DROP COLUMN IF EXISTS deleted_by;
ALTER TABLE table_name DROP COLUMN IF EXISTS deleted_at;

-- Restore array column (temporary)
ALTER TABLE test_categories ADD COLUMN test_series_id_old INTEGER[];
```

## Performance Impact

**Before Migration**:
- Missing indexes on FK columns
- Orphaned records causing slow queries
- Inconsistent data types causing cast operations

**After Migration**:
- All FK columns indexed
- Proper data types (no casts)
- Composite indexes for common queries
- Estimated 30-50% query performance improvement

## Security Improvements

1. **Audit Trail**: All operations logged with user context
2. **Soft Delete**: Prevents accidental data loss
3. **FK Constraints**: Prevents orphaned records
4. **Check Constraints**: Validates data integrity

## Next Steps

1. ✅ Run migration
2. ✅ Verify all checks pass
3. ✅ Test application functionality
4. ✅ Monitor query performance
5. ⏳ Schedule regular audits (monthly)
6. ⏳ Add monitoring for orphaned records
7. ⏳ Implement JSONB schema validation (PostgreSQL 12+)

## Support

For issues or questions:
- Check migration logs in `pg_stat_statements`
- Review audit_logs table for errors
- Contact database administrator

---

**Created**: 2026-05-02  
**Last Updated**: 2026-08-23  
**Version**: 1.0
