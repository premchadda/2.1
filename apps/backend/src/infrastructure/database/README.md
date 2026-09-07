# Database Migrations

> As of 2026-09-06. Migration chain lives in
> `apps/backend/src/infrastructure/database/migrations/`.
> **Gate: run `node scripts/run-database-audit.js` (repo root) before ANY
> migration, DDL change, or schema assumption.** Do not assume a table, index,
> or column exists — verify first. Write pool = `DATABASE_URL`, read pool =
> `DATABASE_READ_URL` (falls back to primary); see
> `apps/backend/docs/DATABASE_REPLICAS.md`.

## Current chain (000–135+, as observed 2026-09-06)

The directory holds ~125 files from `000_baseline_functions.sql` through
`135_test_lifecycle_and_shuffle_seed.sql` (numbering has gaps and letter
suffixes — `000a`, `056a`/`056b`, `057b` — so sort by name and let the runner
validate). Key landmarks:

- `098_reconstructed_baseline.sql` — reconstructed baseline consolidating the
  early chain (migrations 003–017 era fixes).
- `099_rls_policies.sql` — RLS policy pass.
- `100_reconcile_duplicate_tables.sql` — duplicate-table reconciliation.
- `101_consolidate_achievements.sql` — achievement consolidation.
- `094_certificates_and_attempt_dedup.sql` — certificates + attempt dedup.
- `095_create_missing_tables.sql` — missing-table backfill.
- `096_soft_delete_columns_and_fks.sql` — soft-delete columns.
- `097_fix_exam_id_type_mismatch.sql` — `exam_id` type fix.
- `102_add_attempt_number_column.sql` and later (`103`–`135`) — incremental
  fixes: column types, indexes, RLS tightening, taxonomy FKs, audit
  remediation. The tail keeps growing; list the directory for the latest.

```bash
# from the repo root
ls apps/backend/src/infrastructure/database/migrations/ | sort
node scripts/run-database-audit.js
```

The migration runner requires unique numeric prefixes and **crashes backend
startup on duplicates** — never introduce a second file with an existing
prefix (a past `042_*` collision had to be renamed to `046_*`/`047_*`).

## Frozen history: the 039–048 remediation (June 2026)

The section below is a frozen record of the June 2026 audit remediation
(11 files, `039`–`048`). It is kept for provenance — do not re-apply or
edit these files; new fixes go in new numbered migrations.

| File                                             | Purpose                                                                                                                                                                                                                                        | Resolves                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `039_comprehensive_schema_consolidation.sql`     | Missing tables (passages, community_votes, content_moderation_queue, ai_logs), missing FKs (20+), ENUM types, RLS enable on 50+ tables, test_attempts → view, attempts.status CHECK fix, navigation_config.badge/badge_color                   | BLOCKERs #1-3, HIGHs #1-5, MEDIUM #1-2                   |
| `040_final_code_schema_reconciliations.sql`      | users.full_name, exam_seasons.exam_internal_id, faqs/testimonials/page_content FKs, CHECK constraints (subscriptions, coupons, promotions, study_groups.category), community_votes → group_post_likes sync trigger, faqs FK to test_categories | BLOCKER #4-5, HIGH #6-8                                  |
| `041_discussions_and_missing_relations.sql`      | discussions.parent_id self-FK, discussions.{type,parent_id,reference_type,reference_id,upvotes,downvotes,public_id} columns, exam_rooms table, test_state_machine table, tags table, question_tag_map.tag_id FK, faqs FK to exam_categories    | HIGH #9-10, BLOCKER exam_rooms                           |
| `043_create_exam_rooms.sql`                      | Defensive CREATE TABLE for exam_rooms (referenced in seed data)                                                                                                                                                                                | BLOCKER exam_rooms                                       |
| `044_align_live_tests_schema.sql`                | Metadata columns on live_tests expected by the admin UI and seed JSON                                                                                                                                                                          | HIGH live_tests schema drift                             |
| `045_create_live_tests.sql`                      | Defensive CREATE TABLE for live_tests                                                                                                                                                                                                          | BLOCKER live_tests                                       |
| `046_create_remaining_missing_tables.sql`        | app_settings, navigation_menu, exam_seasons, coupons, promotions, discussions, study_groups, study_group_members, study_group_messages, referrals, achievement_definitions, user_achievements (12 tables)                                      | BLOCKERs app_settings, exam_seasons, coupons, promotions |
| `047_orphan_tracking_and_rls.sql`                | _deleted_test_id on tests/questions/test_series, live_tests.metadata, activity_logs admin columns, questions.subject_id FK, RLS enabled on 50+ tables                                                                                          | HIGH _deleted_test_id, MEDIUM RLS enabled                |
| `048_rls_policies_and_final_reconciliations.sql` | RLS POLICIES for all tables enabled in 047, compatibility views (v_group_messages, v_user_topic_performance, v_test_attempts), users_admin_all tightening, schema_migrations_metadata provenance table, schema comment                         | HIGH RLS policies missing                                |

(Note: `042_placeholder_retired.sql` is an empty retired placeholder — the old
`042_*` pair was renamed to `046_*`/`047_*` to fix the duplicate-prefix
startup crash.)

### Code fixes shipped alongside (already in place)

- `attempt.repository.js` — inserts both `selected_option_id` and
  `selected_option` (column mismatch fix).
- `question.repository.js` — uses `negative_marks` (not `neg_marks`).
- `test.repository.js` — joins `users` on `u.name` (not `u.full_name`).
- `admin-navigation.js` — `badge`/`badge_color` columns now exist (039/040).
- `community.js` — `tableMap` maps `communityVotes → community_votes`.
- `exam-seasons.routes.js` — joins on `exams.id` (INTEGER); `040` added
  `exam_internal_id` for backfill.

## How to verify

### 1. Unique prefixes

```bash
ls -1 apps/backend/src/infrastructure/database/migrations/ | sort
```

### 2. Mandatory audit gate (repo root)

```bash
node scripts/run-database-audit.js
```

### 3. Dry-run legacy-table cleanup (no DROPs in dry-run)

```bash
psql "$DATABASE_URL" -f apps/backend/src/infrastructure/database/scripts/cleanup_legacy_tables.sql
```

### 4. RLS policies present

```sql
SELECT tablename, COUNT(*) AS policy_count
  FROM pg_policies
 WHERE schemaname = 'public'
 GROUP BY tablename
 ORDER BY tablename;
```

### 5. Spot-check remediated objects

```sql
SELECT 1 FROM information_schema.tables WHERE table_name = 'passages';
SELECT 1 FROM information_schema.tables WHERE table_name = 'community_votes';
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'navigation_config' AND column_name IN ('badge', 'badge_color');
SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'full_name';
```

## Known leftover work (LOW priority, manual review)

Tracked in `cleanup_legacy_tables.sql`:

1. **Drop legacy tables** after confirming 0 rows (`test_state_machine`,
   `exam_rooms`, `group_messages`, `group_posts`, `group_post_comments`,
   `group_post_likes`, UUID `email_templates`, `navigation_menu`,
   `question_options`).
2. **Shrink `initTables()` in `postgres-helpers.js`** — inline DDL there
   duplicates the migrations; new tables belong in migrations only.
3. **Drop `notifications.read`** once the frontend confirms no consumers.
4. **Verify the vector index** (`idx_search_embedding`, ivfflat) — requires
   the `vector` extension on the production database.

## Code-level notes (not schema)

- `users` camelCase fields referenced by the frontend are handled by the
  camelCase ↔ snake_case conversion in `dbHelpers`.
- The `RbacManager` admin UI uses `user.role` (VARCHAR), not the `user_roles`
  table — tracked separately.
