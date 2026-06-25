# Database Schema — Audit & Remediation Summary

**Last updated:** 2026-06-15
**Audit document:** `docs/AUDIT_2026-06-15.md`
**Migration chain:** `apps/backend/src/infrastructure/database/migrations/` (000-048)

---

## What was wrong

The comprehensive audit identified **8 BLOCKER**, **16 HIGH**, and **20+ MEDIUM/LOW** issues in the database schema. The schema was defined in **5 overlapping places** (migrations, postgres-helpers.js `initTables()`, ORM model files, the legacy `data/models/test/TestCategory.sql`, and the live database export). The migration runner required a unique 3-digit numeric prefix and the codebase had 2 duplicate-prefix pairs that caused the backend to crash on startup.

## What was fixed

### Migrations added (11 new files, 039-048)

| File | Purpose | Resolves |
|------|---------|----------|
| `039_comprehensive_schema_consolidation.sql` | Missing tables (passages, community_votes, content_moderation_queue, ai_logs), missing FKs (20+), ENUM types, RLS enable on 50+ tables, test_attempts → view, attempts.status CHECK fix, navigation_config.badge/badge_color | BLOCKERs #1-3, HIGHs #1-5, MEDIUM #1-2 |
| `040_final_code_schema_reconciliations.sql` | users.full_name, exam_seasons.exam_internal_id, faqs/testimonials/page_content FKs, CHECK constraints (subscriptions, coupons, promotions, study_groups.category), community_votes → group_post_likes sync trigger, faqs FK to test_categories | BLOCKER #4-5, HIGH #6-8 |
| `041_discussions_and_missing_relations.sql` | discussions.parent_id self-FK, discussions.{type,parent_id,reference_type,reference_id,upvotes,downvotes,public_id} columns, exam_rooms table, test_state_machine table, tags table, question_tag_map.tag_id FK, faqs FK to exam_categories | HIGH #9-10, BLOCKER exam_rooms |
| `043_create_exam_rooms.sql` | Defensive CREATE TABLE for exam_rooms (referenced in supabase_data/exam_rooms.json) | BLOCKER exam_rooms |
| `044_align_live_tests_schema.sql` | Adds 18+ metadata columns to live_tests (subject, category, status, etc.) expected by the admin UI and seed JSON | HIGH live_tests schema drift |
| `045_create_live_tests.sql` | Defensive CREATE TABLE for live_tests (was created from JS string in postgres-helpers.js) | BLOCKER live_tests |
| `046_create_remaining_missing_tables.sql` | app_settings, navigation_menu, exam_seasons, coupons, promotions, discussions, study_groups, study_group_members, study_group_messages, referrals, achievement_definitions, user_achievements (12 tables) | BLOCKERs app_settings, exam_seasons, coupons, promotions |
| `047_orphan_tracking_and_rls.sql` | _deleted_test_id on tests/questions/test_series, live_tests.metadata, activity_logs admin columns, questions.subject_id FK, ENABLES RLS on 50+ tables | HIGH _deleted_test_id, MEDIUM RLS enabled |
| `048_rls_policies_and_final_reconciliations.sql` | **This fix** — RLS POLICIES for all tables enabled in 047, compatibility views (v_group_messages, v_user_topic_performance, v_test_attempts), users_admin_all tightening, schema_migrations_metadata provenance table, schema comment | HIGH RLS policies missing |

### Code fixes (already in place)

| File | Issue | Fix |
|------|-------|-----|
| `apps/backend/src/modules/attempts/attempt.repository.js` | `INSERT INTO attempt_answers (selected_option)` — column doesn't exist | Inserts BOTH `selected_option_id` and `selected_option` (line 32-35) |
| `apps/backend/src/modules/questions/question.repository.js` | `INSERT INTO questions (..., neg_marks, ...)` | Uses `negative_marks` (line 29) |
| `apps/backend/src/modules/tests/test.repository.js` | `JOIN users u ON ... SELECT u.full_name` | Uses `u.name` (line 131) |
| `apps/backend/src/api/routes/admin-navigation.js` | Reads/inserts `badge, badge_color` | Schema now has those columns (039 + 040) |
| `apps/backend/src/api/routes/community.js` | `dbHelpers.findOne('communityVotes', ...)` | tableMap maps `communityVotes → community_votes` (postgres-helpers.js:956) |
| `apps/backend/src/modules/exams/exam-seasons.routes.js` | Join on `exams.exam_id` (VARCHAR) | Already joins on `exams.id` (INTEGER); exam_internal_id column added by 040 for backfill |

### Migration runner

The migration runner (line 43-50) **crashes backend startup** on duplicate numeric prefixes. The original state had:
- `042_create_remaining_missing_tables.sql` (×1)
- `042_orphan_tracking_and_rls.sql` (×1)

These were renamed to `046_*` and `047_*` to give every migration a unique 3-digit prefix.

## How to verify

### 1. List the migration chain

```bash
ls -1 apps/backend/src/infrastructure/database/migrations/ | sort
```

All prefixes must be unique. The runner validates this and throws on duplicates.

### 2. Run the dry-run cleanup

```bash
psql "$DATABASE_URL" -f apps/backend/src/infrastructure/database/scripts/cleanup_legacy_tables.sql
```

Lists every legacy table, its row count, and whether it can be safely dropped. **No DROPs happen in dry-run mode.**

### 3. Apply the actual cleanup (after review)

```bash
psql "$DATABASE_URL" -c "SET app.confirm_drop = 'YES_I_REALLY_MEAN_IT';"
psql "$DATABASE_URL" -f apps/backend/src/infrastructure/database/scripts/cleanup_legacy_tables.sql
```

### 4. Verify RLS policies

```sql
SELECT tablename, COUNT(*) AS policy_count
  FROM pg_policies
 WHERE schemaname = 'public'
 GROUP BY tablename
 ORDER BY tablename;
```

Every table in 047's RLS list should now have at least one policy (typically a `*_self`, `*_admin`, or `*_public_read` policy from 048).

### 5. Verify the BLOCKERs

```sql
-- BLOCKER #1: passages table exists
SELECT 1 FROM information_schema.tables WHERE table_name = 'passages';

-- BLOCKER #2: community_votes table exists
SELECT 1 FROM information_schema.tables WHERE table_name = 'community_votes';

-- BLOCKER #3: navigation_config has badge columns
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'navigation_config' AND column_name IN ('badge', 'badge_color');

-- BLOCKER #4: users has full_name
SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'full_name';

-- BLOCKER #5: exam_seasons has exam_internal_id
SELECT 1 FROM information_schema.columns WHERE table_name = 'exam_seasons' AND column_name = 'exam_internal_id';

-- BLOCKER #6: attempts.status no longer allows 'finish'
SELECT conname, pg_get_constraintdef(oid)
  FROM pg_constraint WHERE conname = 'attempts_status_chk';

-- HIGH: RLS policies exist
SELECT tablename, policyname FROM pg_policies
 WHERE schemaname = 'public' AND tablename IN (
   'doubts', 'bookmarks', 'wrong_questions', 'revision_queue',
   'practice_answers', 'enrollments', 'subscriptions', 'transactions',
   'discussions', 'community_votes', 'community_comments', 'study_groups'
 );
```

## What's STILL not done (LOW priority)

These were deliberately left for manual review and are tracked in `cleanup_legacy_tables.sql` BLOCK 3:

1. **Drop legacy tables** — `test_state_machine`, `exam_rooms`, `group_messages`, `group_posts`, `group_post_comments`, `group_post_likes`, `email_templates` (UUID), `navigation_menu`, `question_options`. Run the cleanup script after confirming row counts are 0.
2. **Remove `initTables()` from `postgres-helpers.js`** — lines 1070-2046 contain ~1000 lines of inline DDL that duplicates what the migrations do. The 048 migration's `COMMENT ON SCHEMA public` documents that new tables should NOT be added there.
3. **Drop `notifications.read` legacy column** — kept for backward compat per 034. Manual cleanup once the FE confirms no consumers.
4. **Drop `test_questions` lack of FKs** — added by 039 (test_id, question_id, section_id). CASCADE delete now works.
5. **Verify the vector index** — 039 uncommented `CREATE INDEX idx_search_embedding` (ivfflat). Requires `vector` extension on the production database.

## Outstanding code-level issues (not DB)

These are not schema issues but were flagged in the audit:

- `users` table has 30+ columns referenced by FE in camelCase (`avatar`, `isProUser`, `enrolledSeries`) — the camelCase ↔ snake_case conversion in `dbHelpers` (line 2187) handles this transparently.
- The `RbacManager` admin UI uses `user.role` (VARCHAR) not the `user_roles` table — tracked separately, not in scope.
- The `EmailTemplates` admin writes `enabled` column but 030 added `is_active` — both are maintained by the trigger.
