> **HISTORICAL — re-verified 2026-09-06.** Before/after diagrams below describe the 008-era
> fixes (still accurate as history). For what came after, see §7 "What came after 008" at the
> end of this file. Current chain: migrations `000→135`; `docs/DATABASE_SCHEMA_AUDIT.md` is
> authoritative for live schema.

# Database Schema Changes - Visual Guide

## Before vs After Comparison

### 1. User ID Type Standardization

**BEFORE** ❌

```
users
├── id (INTEGER)          ← Primary Key
└── public_id_uuid (UUID) ← For frontend

user_roles
├── user_id (UUID)        ← WRONG TYPE!
└── role_id (UUID)

audit_logs
├── user_id (UUID)        ← WRONG TYPE!
└── ...

subscriptions
├── user_id (INTEGER)     ← Correct type
└── ...
```

**AFTER** ✅

```
users
├── id (INTEGER)          ← Primary Key
└── public_id_uuid (UUID) ← For frontend

user_roles
├── user_id (INTEGER)     ← FIXED!
└── role_id (UUID)

audit_logs
├── user_id (INTEGER)     ← FIXED!
└── ...

subscriptions
├── user_id (INTEGER)     ← Consistent!
└── ...
```

### 2. Array Foreign Key Fix

**BEFORE** ❌

```
test_categories
├── id (INTEGER)
├── name (TEXT)
└── test_series_id (INTEGER[])  ← Can't enforce FK!
                                 Multiple series in one column

test_series
├── id (INTEGER)
└── name (TEXT)
```

**AFTER** ✅

```
test_categories
├── id (INTEGER)
├── name (TEXT)
└── (no array column)

test_series
├── id (INTEGER)
└── name (TEXT)

test_category_series (NEW JUNCTION TABLE)
├── test_category_id (INTEGER) ← FK enforced!
└── test_series_id (INTEGER)   ← FK enforced!
```

### 3. Missing Foreign Keys

**BEFORE** ❌

```
questions
├── id (INTEGER)
├── test_id (INTEGER)       ← No FK constraint
├── chapter_id (INTEGER)    ← No FK constraint
└── topic_id (INTEGER)      ← No FK constraint

tests
├── id (INTEGER)
├── stage_id (INTEGER)      ← No FK constraint
└── series_id (INTEGER)     ← No FK constraint
```

**AFTER** ✅

```
questions
├── id (INTEGER)
├── test_id (INTEGER)       ← FK → tests(id)
├── chapter_id (INTEGER)    ← FK → chapters(id)
└── topic_id (INTEGER)      ← FK → topics(id)

tests
├── id (INTEGER)
├── stage_id (INTEGER)      ← FK → stages(id)
└── series_id (INTEGER)     ← FK → test_series(id)
```

### 4. Soft Delete Implementation

**BEFORE** ❌

```
tests
├── id (INTEGER)
├── title (TEXT)
└── (no soft delete)       ← DELETE = permanent loss

questions
├── id (INTEGER)
├── question_text (TEXT)
└── (no soft delete)       ← DELETE = permanent loss
```

**AFTER** ✅

```
tests
├── id (INTEGER)
├── title (TEXT)
├── is_deleted (BOOLEAN)   ← Soft delete flag
├── deleted_by (INTEGER)   ← Who deleted
└── deleted_at (TIMESTAMP) ← When deleted

questions
├── id (INTEGER)
├── question_text (TEXT)
├── is_deleted (BOOLEAN)   ← Soft delete flag
├── deleted_by (INTEGER)   ← Who deleted
└── deleted_at (TIMESTAMP) ← When deleted
```

### 5. Index Coverage

**BEFORE** ❌

```
questions
├── id (PK)
├── test_id              ← No index (slow!)
├── chapter_id           ← No index (slow!)
└── topic_id             ← No index (slow!)

attempts
├── id (PK)
├── user_id              ← No index (slow!)
├── test_id              ← No index (slow!)
└── created_at           ← No index (slow!)
```

**AFTER** ✅

```
questions
├── id (PK)
├── test_id              ← idx_questions_test_id ✅
├── chapter_id           ← idx_questions_chapter_id ✅
└── topic_id             ← idx_questions_topic_id ✅

attempts
├── id (PK)
├── user_id              ← idx_attempts_user_id ✅
├── test_id              ← idx_attempts_test_id ✅
└── created_at           ← idx_attempts_created_at ✅
```

### 6. Audit Trail

**BEFORE** ❌

```
audit_logs (inconsistent)
├── id (UUID)
├── user_id (UUID/INTEGER mixed)
├── action (TEXT)
├── entity_type (TEXT)
└── created_at (TIMESTAMP)

No standard logging function
No validation
```

**AFTER** ✅

```
audit_logs (standardized)
├── id (UUID)
├── user_id (INTEGER)          ← Consistent type
├── action (VARCHAR)           ← Standardized
├── resource (VARCHAR)         ← Resource name
├── resource_id (VARCHAR)      ← Resource ID
├── old_values (JSONB)         ← Before state
├── new_values (JSONB)         ← After state
├── description (TEXT)         ← Human readable
├── ip_address (INET)          ← Client IP
├── user_agent (TEXT)          ← Browser info
├── status (VARCHAR)           ← success/failure
└── created_at (TIMESTAMP)

Standard logging via log_audit_event()
AuditTrailManager class available
```

## Complete Entity Relationship Diagram

### Core Tables

```
┌─────────────────────┐
│      users          │
├─────────────────────┤
│ id (PK)             │
│ public_id_uuid      │
│ email               │
│ name                │
└─────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────┐
│    test_series      │
├─────────────────────┤
│ id (PK)             │
│ name                │
│ slug                │
└─────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────┐
│     test_categories │
├─────────────────────┤
│ id (PK)             │
│ category_id         │
│ name                │
└─────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────┐
│       tests         │
├─────────────────────┤
│ id (PK)             │
│ title               │
│ test_category_id(FK)│
│ series_id (FK)      │
│ stage_id (FK)       │
└─────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────┐
│ test_questions      │
├─────────────────────┤
│ id (PK)             │
│ test_id (FK)        │
│ question_id (FK)    │
│ section_id (FK)     │
└─────────────────────┘
         │
         │ N:1
         ▼
┌─────────────────────┐
│     questions       │
├─────────────────────┤
│ id (PK)             │
│ test_id (FK)        │
│ chapter_id (FK)     │
│ topic_id (FK)       │
│ series_id (FK)      │
└─────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────┐
│      chapters       │
├─────────────────────┤
│ id (PK)             │
│ unit_id (FK)        │
│ title               │
└─────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────┐
│      topics         │
├─────────────────────┤
│ id (PK)             │
│ chapter_id (FK)     │
│ name                │
└─────────────────────┘
```

### Junction Tables

```
┌─────────────────────┐
│  test_category_     │
│      series         │
├─────────────────────┤
│ test_category_id(FK)│───→ test_categories.id
│ test_series_id (FK) │───→ test_series.id
└─────────────────────┘

┌─────────────────────┐
│    user_roles       │
├─────────────────────┤
│ user_id (FK)        │───→ users.id
│ role_id (FK)        │───→ roles.id
└─────────────────────┘

┌─────────────────────┐
│  role_permissions   │
├─────────────────────┤
│ role_id (FK)        │───→ roles.id
│ permission_id (FK)  │───→ permissions.id
└─────────────────────┘
```

## Migration Path

`\nSTART\n  │\n  ├─→ Check user_id types\n  │   ├─ UUID found? → Convert to INTEGER\n  │   └─ Already INTEGER? → Skip\n  │\n  ├─→ Fix array FKs\n  │   ├─ Create junction table\n  │   ├─ Migrate array data\n  │   └─ Drop array column\n  │\n  ├─→ Add missing FKs\n  │   ├─ Check if exists\n  │   ├─ Check for orphans\n  │   └─ Add constraint\n  │\n  ├─→ Add indexes\n  │   ├─ Check existing\n  │   ├─ Add missing\n  │   └─ Remove duplicates\n  │\n  └─→ Verify\n      ├─ Run checks\n      ├─ Fix remaining\n      └─ Complete\n`\n\n## Performance Impact

### Before Migration

`\nQuery: Get all questions for a test\nTime: ~150ms\nPlan: Seq Scan questions (full table scan)\n`\n\n### After Migration\n`\nQuery: Get all questions for a test\nTime: ~5ms\nPlan: Index Scan using idx_questions_test_id\nImprovement: 30x faster! ⚡\n`\n\n## Data Flow

### User Journey Tracking

`\nUser Action → API Call → Audit Log → Database\n     │\n     ├─→ log_audit_event()\n     │   ├─ user_id (who)\n     │   ├─ action (what)\n     │   ├─ resource (where)\n     │   ├─ resource_id (which)\n     │   ├─ old_values (before)\n     │   ├─ new_values (after)\n     │   └─ timestamp (when)\n     │\n     └─→ Business Logic\n         └─→ Database Operation\n`\n\n## Error Handling Flow\n\n`\nOperation Start\n     │\n     ├─→ Begin Transaction\n     │\n     ├─→ Execute Operation\n     │   ├─ Success?\n     │   │   ├─ Log audit event\n     │   │   └─ Commit transaction\n     │   │\n     │   └─ Failure?\n     │       ├─ Log audit event (failure)\n     │       └─ Rollback transaction\n     │\n     └─→ Return result\n`\n\n---\n\n## 7. What came after 008 (migrations 094→135 — not in the diagrams above)

Added 2026-09-06. The 008-era diagrams stop at the audit-trail/soft-delete groundwork.
Later migrations added:

- **Results dual-write**: `attempts` remains the attempt source of truth; submit also
  `INSERT`s `results` (`modules/attempts/attempt.service.js:346-372`). Leaderboard reads
  `leaderboards → results → attempts` (`leaderboards-public.js:19-35`).
  ```
  attempts (submit UPDATE) ──dual-write──▶ results ──fallback──▶ leaderboards-public
  ```
- _*Practice_* separation_*: Practice Lab uses its own tables (`practice_sessions`,
  `practice_answers`, `practice_streaks`, `question_bookmarks`, `practice_ai_cache`) —
  deliberately NOT `attempts`/`question_attempts`/`attempt_answers`.
- **RLS + pgvector**: RLS policies backfilled (`099`, `116`); embeddings + HNSW/cosine
  indexes for semantic search (`076`, `093`); encryption-at-rest helpers (`088`).
- **`tests.is_live` vs `live_tests`**: scheduled/live surfacing keys off `tests.is_live`
  (plus type/tags/schedule filters in `live-tests-public.js`); `live_tests` rows are
  admin-managed sessions served through the composed `live-tests-public + liveMock`
  router — not two competing sources.
- **Payments ledger**: `webhook_events` persisted via `persistWebhookEvent`
  (`payments.js:750+`, migration `120`); refunds sync both ledgers + gateway.

---

**Diagram Version**: 1.0 (+ §7, 2026-09-06)  
**Last Updated**: 2026-08-23  
**Re-verified (historical framing + §7)**: 2026-09-06
