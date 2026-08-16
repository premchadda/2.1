# Database Schema Audit - Quick Start Guide

## 🚀 Quick Start (3 Steps)

### Step 1: Run the Audit
```bash
cd apps/backend
node scripts/run-database-audit.js
```

This will check your database for issues and tell you what needs to be fixed.

### Step 2: Apply the Fix
```bash
psql -d your_database -f src/database/migrations/008-standardize-ids-and-fix-relations.sql
```

Or via Supabase SQL Editor:
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy content from `src/database/migrations/008-standardize-ids-and-fix-relations.sql`
4. Run the migration

### Step 3: Verify
```bash
node scripts/run-database-audit.js
```

All checks should now pass ✅

## 📁 What Files Were Created

```
apps/backend/
├── src/
│   ├── database/migrations/
│   │   ├── 008-standardize-ids-and-fix-relations.sql  # Main fix migration
│   │   ├── maintenance-scripts.sql                      # Ongoing maintenance
│   │   └── README-schema-fixes.md                       # Detailed docs
│   └── infrastructure/database/
│       └── auditTrailManager.js                         # Audit logging
└── scripts/
    └── run-database-audit.js                            # Audit script
```

## 🔍 What Problems Are Fixed

| Issue | Impact | Fixed |
|-------|--------|-------|
| Mixed user_id types (UUID vs INTEGER) | Data inconsistency, join failures | ✅ All now INTEGER |
| Array foreign keys | No FK enforcement | ✅ Junction table created |
| Missing FK constraints | Orphaned records | ✅ All FKs added |
| No soft-delete pattern | Accidental data loss | ✅ Global soft-delete |
| Duplicate table definitions | Schema confusion | ✅ Consolidated |
| Missing indexes | Slow queries | ✅ Added composite indexes |
| No audit trail | No accountability | ✅ Consistent audit logging |
| No timestamp validation | Bad data | ✅ CHECK constraints |

## 🛠️ Common Commands

### Check Database Health
```bash
node scripts/run-database-audit.js
```

### Run Maintenance (Monthly)
```sql
-- In psql or Supabase SQL Editor
ANALYZE;
VACUUM ANALYZE;
```

### Check for Orphaned Records
```sql
SELECT * FROM check_orphaned_records();
```

### Clean Old Audit Logs
```sql
SELECT clean_old_audit_logs(365);
```

## 📊 Using the Audit Trail Manager

```javascript
import AuditTrailManager from './infrastructure/database/auditTrailManager.js';

const auditManager = new AuditTrailManager(pool);

// Log a CREATE
await auditManager.logCreate({
  userId: 1,
  resource: 'tests',
  resourceId: 123,
  data: { title: 'New Test' },
  ipAddress: '127.0.0.1',
});

// Log an UPDATE
await auditManager.logUpdate({
  userId: 1,
  resource: 'tests',
  resourceId: 123,
  oldValues: { title: 'Old Title' },
  newValues: { title: 'New Title' },
  ipAddress: '127.0.0.1',
});

// Log a DELETE
await auditManager.logDelete({
  userId: 1,
  resource: 'tests',
  resourceId: 123,
  oldValues: { title: 'Test to delete' },
  ipAddress: '127.0.0.1',
});

// Search audit logs
const logs = await auditManager.searchAuditLogs({
  resource: 'tests',
  userId: 1,
  startDate: '2026-01-01',
});
```

## 🎯 Verification Queries

### Check User ID Types (Should All Be INTEGER)
```sql
SELECT table_name, data_type
FROM information_schema.columns
WHERE column_name = 'user_id'
AND table_schema = 'public';
```

### Check Foreign Keys
```sql
SELECT 
  table_name,
  constraint_name,
  (SELECT column_name FROM information_schema.key_column_usage 
   WHERE constraint_name = tc.constraint_name) as column_name
FROM information_schema.table_constraints tc
WHERE constraint_type = 'FOREIGN KEY'
AND table_schema = 'public'
ORDER BY table_name;
```

### Check Index Usage
```sql
SELECT 
  schemaname,
  relname as table_name,
  indexrelname as index_name,
  idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

## 🚨 Troubleshooting

### Migration Fails
If migration fails, check:
1. Database connection
2. User has CREATE/ALTER permissions
3. No locks on tables (close other connections)

### Audit Script Shows Errors
Run cleanup first:
```sql
ANALYZE;
VACUUM;
```

### Performance Issues After Migration
Run:
```sql
REINDEX TABLE questions;
REINDEX TABLE tests;
REINDEX TABLE attempts;
ANALYZE;
```

## 📈 Next Steps

1. ✅ Run the migration
2. ✅ Verify all checks pass
3. ✅ Test your application
4. ⏳ Schedule monthly maintenance
5. ⏳ Monitor audit logs
6. ⏳ Add alerts for orphaned records

## 📞 Support

If you encounter issues:

1. Check the detailed docs: `README-schema-fixes.md`
2. Review migration logs
3. Run verification queries
4. Check `pg_stat_statements` for slow queries

---

**Created**: 2026-05-02  
**Version**: 1.0  
**Status**: Ready for Production ✅
