# Trstprep V2.1 — Comprehensive Database Layer & Schema Audit Report

> **Audit Executed:** November 11, 2026
> **Auditor Agent:** `audit-db` (Swarm Worker)
> **Target Infrastructure:** PostgreSQL 16 (Supabase Managed Dual-Pool Persistence Layer)
> **Scope:** Migrations 000–160 (149 SQL files on disk, 156 applied in `schema_migrations`), `apps/backend/src/db`, `infrastructure/database`, live `information_schema`.

## 1. Executive Summary & Verification Metrics

| Metric | Count / State | Status |
| :--- | :--- | :--- |
| **Total Database Relations** | **168 Relations** (165 Base Tables + 3 Views) | Verified |
| **Total Column Definitions** | **2,746 Columns** | Fully Mapped |
| **Total Table Constraints** | **1,334 Constraints** (237 Unique, 315 FK, 602 Check, 165 PK) | Verified |
| **Total Database Indexes** | **1,093 Indexes** (inc. 62 GIN, 2 HNSW vector) | Verified |
| **User ID Consistency** | **67 / 67 Tables** standardized on `INTEGER` | 100% Consistent |
| **Soft-Delete Implementation** | **100 Tables** with dual `is_deleted` + `deleted_at` | High Coverage |
| **Asymmetric Soft-Delete** | **2 Tables** (`blogs` missing `is_deleted`, `group_messages` missing `deleted_at`) | Warning |
| **Foreign Key Cascades** | 160 CASCADE, 133 SET NULL, 22 NO ACTION | Hardened |
| **RLS IS NULL Bypass Check** | 0 Bypasses found; functions hardened with fixed `search_path` | 100% Passed |
| **Vector Index Tuning** | `m=32, ef_construction=200, ef_search=100` tuned on HNSW | Passed |

## 2. Critical Schema Drift & Type Inconsistency Ledger

| # | Table / Component | Column / Relation | Shipped Migration Definition | Live Database Reality | Impact & Remediation |
| :-: | :--- | :--- | :--- | :--- | :--- |
| **1** | `users` | `phone` vs `mobile` | Migration 038 added `phone` (varchar) | Database only has `mobile` (varchar), `phone_enc` (text), `dob_enc` (text). `phone` plaintext column is absent. | Code must query `mobile` or `phone_enc` shadow column. Database audit script verifies `users.mobile` alias. |
| **2** | `revision_queue` | `priority` | Migration 106 defined `priority VARCHAR(20) DEFAULT 'medium'` | Live DB has `priority integer DEFAULT 1` (int4) | Migration 138/142 aligned priority to integer. Application logic must pass numeric priorities (1-5), not strings. |
| **3** | `practice_answers` | `is_skipped`, `time_taken_sec`, `mode`, `updated_at` | Early migration 107 had 7 baseline columns | Live DB has `is_skipped` (bool, def false), `time_taken_sec` (int), `mode` (varchar), `updated_at` (timestamptz) | Reconciled in migration 138 & 140. Fully populated and active in Practice Lab. |
| **4** | `tests` | `exam_id` | Early baseline had `exam_id` as `VARCHAR/TEXT` | Live DB has `exam_id integer` (int4) | Reconciled and fixed via migrations 086 and 097. All foreign joins strictly numeric. |
| **5** | `test_attempts` | Table vs View | Baseline had physical table `test_attempts` | Converted to PostgreSQL VIEW over `attempts` in migrations 039/048 | 0 rows in table statistics because it is a VIEW. Writes go to `attempts`. Legacy reads remain backwards compatible. |
| **6** | `test_category_series` | Junction Architecture | Legacy used `test_categories.series_ids int[]` | Full relational junction table with validated FKs & 3 indexes | Migration 008 created, 121 ensured, 151/152 deduped and validated FKs. No array-based FK anti-pattern. |
| **7** | `subject_videos` | DRM Metadata | Baseline had only basic video URL columns | Live DB has `fortspy_id` (text) & `fortspy_key` (text) | Added via migration 141 for FortSpy DRM video player stream authorization. |
| **8** | `subject_topics` | Index Naming | Originally `idx_topics_subject` | Renamed to `idx_subject_topics_subject` | Migration 137 resolved naming drift. Queries utilizing index hints must use canonical name. |
| **9** | `schema_migrations` | Migration File Count & Naming | 149 `.sql` files on disk (gaps 004-017) | 156 applied records in `schema_migrations` table | Differences stem from underscore vs hyphen renames (`000a`, `018`, `019`) and historical consolidated patches. All 160 migration targets are applied. |

## 3. Table Hygiene & Architecture Audit

### 3.1 Soft-Delete (`is_deleted` & `deleted_at`)
- **Dual-Column Compliant Tables (100 Tables):** Standardized with `is_deleted boolean DEFAULT false` and `deleted_at timestamp without time zone`.
- **Asymmetric Soft-Delete (2 Tables):**
  - `blogs`: Has `deleted_at` but is missing `is_deleted`.
  - `group_messages`: Has `is_deleted` but is missing `deleted_at`.
- **Tables Without Soft-Delete (64 Tables):**
  - *Immutable / Append-Only Event Logs (15):* `audit_logs`, `outbox_events`, `activity_logs`, `user_activity_events`, `csrf_tokens`, `import_logs`, `dead_letter_jobs`, `webhook_events`, `ai_messages`, `attempt_question_snapshots`, `certificates`, `question_approaches`, `question_reports`, `question_learning_telemetry`, `question_versions`.
  - *Junction / Relational Mapping Tables (11):* `role_permissions`, `test_category_series`, `section_aliases`, `question_tag_map`, `two_factor_secrets`, `password_resets`, `email_verifications`, `group_post_likes`, `test_questions`, `user_roles`, `test_state_machine`.
  - *Cognitive & Mastery Cache Tables (10):* `learner_study_health`, `learner_topic_mastery`, `user_fundamental_mastery`, `learner_recommendations`, `learner_recommendation_feedback`, `practice_ai_cache`, `fundamental_skill_drills`, `knowledge_vault_items`, `user_sessions`, `active_user_connections`.
  - *Operational / Migration Metadata (4):* `schema_migrations`, `schema_migrations_metadata`, `migration_progress`, `test_id_remap_backup`.

### 3.2 Timestamp Consistency (`created_at` & `updated_at`)
- **Tables Missing `created_at` (14 Tables):**
  - `practice_sessions`: Uses `started_at` (timestamp without time zone) instead of `created_at`.
  - `dead_letter_jobs`, `learner_study_health`, `learner_topic_mastery`, `user_fundamental_mastery`, `user_recommendations`, `practice_streaks`, `video_progress`, `practice_ai_cache`, `two_factor_secrets`, `migration_progress`, `test_id_remap_backup`, `schema_migrations`, `schema_migrations_metadata`.
- **Tables Missing `updated_at` (40 Tables):**
  - Append-only event logs (25 tables) where omission is architectural design (`audit_logs`, `csrf_tokens`, `outbox_events`, `payments`, etc.).
  - Entity tables where omission should be reviewed (15 tables): `knowledge_vault_items`, `learner_recommendations`, `learner_recommendation_feedback`, `learner_study_health`, `user_fundamental_mastery`, `two_factor_secrets`, `test_state_machine`, `section_aliases`, `role_permissions`, `question_bookmarks`, `question_tag_map`, `test_questions`, `test_category_series`, `user_roles`, `user_sessions`.

### 3.3 Foreign Key Cascades & Deletion Boundaries
- **CASCADE (160 Constraints):** Applied to dependent children (e.g. `questions` -> `test_questions`, `tests` -> `test_sections`, `attempts` -> `attempt_answers`).
- **SET NULL (133 Constraints):** Applied to optional categorical links (e.g. `questions.chapter_id`, `questions.topic_id`, `tests.exam_id`).
- **NO ACTION / RESTRICT (22 Constraints):** Critical protection boundaries:
  - 12 `deleted_by` / `updated_by` / `created_by` user links prevent accidental cascading drops when admin users are altered.
  - 6 Exam umbrella links (`banners.exam_id`, `enrollments.exam_id`, `exam_seasons.exam_id`, `exam_static_content.exam_id`, `page_content.exam_id`, `tag_configs.exam_id`) block orphaned deletions.
  - 2 Self-referencing links (`attempts.parent_attempt_id`, `test_categories.parent_id`).

## 4. Complete Table & Column Dictionary (All 168 Relations)

### 4.1 `achievement_definitions` (BASE TABLE, 18 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('achievement_definitions_id_seq'::regclass)` | — |
| 2 | **`code`** | `character varying` | NO | — | — |
| 3 | **`name`** | `character varying` | NO | — | — |
| 4 | **`description`** | `text` | YES | — | — |
| 5 | **`icon`** | `character varying` | YES | — | — |
| 6 | **`category`** | `character varying` | YES | — | — |
| 7 | **`criteria`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 8 | **`points`** | `integer` | YES | `0` | — |
| 9 | **`is_active`** | `boolean` | YES | `true` | — |
| 10 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 11 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 12 | **`badge_color`** | `character varying` | YES | `'indigo'::character varying` | — |
| 13 | **`tier`** | `character varying` | YES | `'bronze'::character varying` | — |
| 14 | **`display_order`** | `integer` | YES | `0` | — |
| 15 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 16 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 17 | **`deleted_by`** | `integer` | YES | — | — |
| 18 | **`title`** | `character varying` | YES | — | — |

### 4.2 `achievements` (BASE TABLE, 14 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('achievements_id_seq'::regclass)` | — |
| 2 | **`title`** | `character varying` | NO | — | — |
| 3 | **`description`** | `text` | YES | — | — |
| 4 | **`icon`** | `character varying` | YES | — | — |
| 5 | **`category`** | `character varying` | YES | — | — |
| 6 | **`points`** | `integer` | YES | `0` | — |
| 7 | **`condition_type`** | `character varying` | YES | — | — |
| 8 | **`condition_value`** | `integer` | YES | — | — |
| 9 | **`is_active`** | `boolean` | YES | `true` | — |
| 10 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 11 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 12 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 13 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 14 | **`deleted_by`** | `integer` | YES | — | — |

### 4.3 `activity_logs` (BASE TABLE, 19 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('activity_logs_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | YES | — | — |
| 3 | **`type`** | `character varying` | NO | — | — |
| 4 | **`description`** | `text` | YES | — | — |
| 5 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 6 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 7 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 8 | **`is_active`** | `boolean` | YES | `true` | — |
| 9 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 10 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 11 | **`deleted_by`** | `integer` | YES | — | — |
| 12 | **`admin_email`** | `character varying` | YES | — | — |
| 13 | **`admin_name`** | `character varying` | YES | — | — |
| 14 | **`action`** | `character varying` | YES | — | — |
| 15 | **`resource`** | `character varying` | YES | — | — |
| 16 | **`resource_id`** | `character varying` | YES | — | — |
| 17 | **`ip_address`** | `character varying` | YES | — | — |
| 18 | **`entity_type`** | `character varying` | YES | — | — |
| 19 | **`entity_id`** | `integer` | YES | — | — |

### 4.4 `affiliates` (BASE TABLE, 9 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('affiliates_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | YES | — | — |
| 3 | **`affiliate_code`** | `character varying` | YES | — | — |
| 4 | **`commission_rate`** | `numeric` | YES | `0` | — |
| 5 | **`total_earnings`** | `numeric` | YES | `0` | — |
| 6 | **`status`** | `character varying` | YES | `'active'::character varying` | — |
| 7 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 8 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 9 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.5 `ai_conversations` (BASE TABLE, 5 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('ai_conversations_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | YES | — | — |
| 3 | **`title`** | `character varying` | YES | `'New Chat'::character varying` | — |
| 4 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 5 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.6 `ai_generation_logs` (BASE TABLE, 15 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `bigint` | NO | `nextval('ai_generation_logs_id_seq'::regclass)` | — |
| 2 | **`entity_type`** | `character varying` | NO | — | — |
| 3 | **`entity_id`** | `integer` | YES | — | — |
| 4 | **`prompt`** | `text` | YES | — | — |
| 5 | **`model`** | `character varying` | YES | — | — |
| 6 | **`provider`** | `character varying` | YES | — | — |
| 7 | **`tokens_input`** | `integer` | YES | `0` | — |
| 8 | **`tokens_output`** | `integer` | YES | `0` | — |
| 9 | **`cost_usd`** | `numeric` | YES | `0` | — |
| 10 | **`latency_ms`** | `integer` | YES | `0` | — |
| 11 | **`status`** | `character varying` | YES | `'success'::character varying` | — |
| 12 | **`error_message`** | `text` | YES | — | — |
| 13 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 14 | **`created_by`** | `integer` | YES | — | — |
| 15 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.7 `ai_logs` (VIEW, 15 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `bigint` | YES | — | — |
| 2 | **`entity_type`** | `character varying` | YES | — | — |
| 3 | **`entity_id`** | `integer` | YES | — | — |
| 4 | **`prompt`** | `text` | YES | — | — |
| 5 | **`model`** | `character varying` | YES | — | — |
| 6 | **`provider`** | `character varying` | YES | — | — |
| 7 | **`tokens_input`** | `integer` | YES | — | — |
| 8 | **`tokens_output`** | `integer` | YES | — | — |
| 9 | **`cost_usd`** | `numeric` | YES | — | — |
| 10 | **`latency_ms`** | `integer` | YES | — | — |
| 11 | **`status`** | `character varying` | YES | — | — |
| 12 | **`error_message`** | `text` | YES | — | — |
| 13 | **`metadata`** | `jsonb` | YES | — | — |
| 14 | **`created_by`** | `integer` | YES | — | — |
| 15 | **`created_at`** | `timestamp without time zone` | YES | — | — |

### 4.8 `ai_messages` (BASE TABLE, 6 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('ai_messages_id_seq'::regclass)` | — |
| 2 | **`conversation_id`** | `integer` | YES | — | — |
| 3 | **`role`** | `character varying` | NO | — | — |
| 4 | **`content`** | `text` | NO | — | — |
| 5 | **`tokens`** | `integer` | YES | `0` | — |
| 6 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.9 `app_settings` (BASE TABLE, 37 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('app_settings_id_seq'::regclass)` | — |
| 2 | **`site_name`** | `character varying` | YES | `'Trstprep'::character varying` | — |
| 3 | **`site_logo`** | `character varying` | YES | — | — |
| 4 | **`contact_email`** | `character varying` | YES | — | — |
| 5 | **`support_phone`** | `character varying` | YES | — | — |
| 6 | **`social_links`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 7 | **`maintenance_mode`** | `boolean` | YES | `false` | — |
| 8 | **`allow_signups`** | `boolean` | YES | `true` | — |
| 9 | **`pro_pass_price`** | `numeric` | YES | `999.00` | — |
| 10 | **`features`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 11 | **`updated_by`** | `integer` | YES | — | — |
| 12 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 13 | **`payment`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 14 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 15 | **`is_active`** | `boolean` | YES | `true` | — |
| 16 | **`site_description`** | `text` | YES | — | — |
| 17 | **`site_favicon`** | `character varying` | YES | — | — |
| 18 | **`site_url`** | `character varying` | YES | — | — |
| 19 | **`meta_title`** | `character varying` | YES | — | — |
| 20 | **`meta_description`** | `text` | YES | — | — |
| 21 | **`keywords`** | `text` | YES | — | — |
| 22 | **`contact_phone`** | `character varying` | YES | — | — |
| 23 | **`address`** | `text` | YES | — | — |
| 24 | **`appearance`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 25 | **`security`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 26 | **`email`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 27 | **`notifications`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 28 | **`coming_soon_config`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 29 | **`navigation_config`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 30 | **`site_config`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 31 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 32 | **`key`** | `character varying` | YES | — | — |
| 33 | **`value`** | `jsonb` | YES | — | — |
| 34 | **`description`** | `text` | YES | — | — |
| 35 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 36 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 37 | **`deleted_by`** | `integer` | YES | — | — |

### 4.10 `assets` (BASE TABLE, 19 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('assets_id_seq'::regclass)` | — |
| 2 | **`name`** | `character varying` | NO | — | — |
| 3 | **`type`** | `character varying` | NO | — | — |
| 4 | **`category`** | `character varying` | YES | `'image'::character varying` | — |
| 5 | **`url`** | `text` | NO | — | — |
| 6 | **`size`** | `bigint` | YES | `0` | — |
| 7 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 8 | **`uploaded_by`** | `integer` | YES | — | — |
| 9 | **`is_active`** | `boolean` | YES | `true` | — |
| 10 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 11 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 12 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 13 | **`public_id`** | `character varying` | YES | — | — |
| 14 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 15 | **`deleted_by`** | `integer` | YES | — | — |
| 16 | **`mime_type`** | `character varying` | YES | — | — |
| 17 | **`file_type`** | `character varying` | YES | — | — |
| 18 | **`file_path`** | `text` | YES | — | — |
| 19 | **`file_size`** | `integer` | YES | — | — |

### 4.11 `attempt_answers` (BASE TABLE, 20 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `uuid` | NO | `uuid_generate_v4()` | — |
| 2 | **`attempt_id`** | `integer` | YES | — | — |
| 3 | **`question_id`** | `integer` | YES | — | — |
| 4 | **`selected_option_id`** | `uuid` | YES | — | — |
| 5 | **`is_correct`** | `boolean` | YES | — | — |
| 6 | **`time_spent`** | `integer` | YES | — | — |
| 7 | **`time_spent_seconds`** | `integer` | YES | `0` | — |
| 8 | **`is_unattempted`** | `boolean` | YES | `false` | — |
| 9 | **`is_slow_question`** | `boolean` | YES | `false` | — |
| 10 | **`section`** | `character varying` | YES | — | — |
| 11 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 12 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 13 | **`is_active`** | `boolean` | YES | `true` | — |
| 14 | **`selected_option`** | `integer` | YES | — | — |
| 15 | **`is_marked_for_review`** | `boolean` | YES | `false` | — |
| 16 | **`visits_count`** | `integer` | YES | `0` | — |
| 17 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 18 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 19 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 20 | **`deleted_by`** | `integer` | YES | — | — |

### 4.12 `attempt_events` (BASE TABLE, 13 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('attempt_events_id_seq'::regclass)` | — |
| 2 | **`attempt_id`** | `integer` | NO | — | — |
| 3 | **`event_type`** | `character varying` | NO | — | — |
| 4 | **`question_id`** | `integer` | YES | — | — |
| 5 | **`event_data`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 6 | **`event_timestamp`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 7 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 8 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 9 | **`is_active`** | `boolean` | YES | `true` | — |
| 10 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 11 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 12 | **`deleted_by`** | `integer` | YES | — | — |
| 13 | **`event_uuid`** | `uuid` | YES | — | — |

### 4.13 `attempt_question_snapshots` (BASE TABLE, 18 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('attempt_question_snapshots_id_seq'::regclass)` | — |
| 2 | **`attempt_id`** | `integer` | NO | — | — |
| 3 | **`question_id`** | `integer` | YES | — | — |
| 4 | **`question_version_id`** | `integer` | YES | — | — |
| 5 | **`question_number`** | `integer` | YES | `0` | — |
| 6 | **`text`** | `text` | NO | `''::text` | — |
| 7 | **`options`** | `jsonb` | NO | `'[]'::jsonb` | — |
| 8 | **`correct_answer`** | `integer` | NO | `0` | — |
| 9 | **`explanation`** | `text` | YES | — | — |
| 10 | **`marks`** | `numeric` | YES | `1.00` | — |
| 11 | **`negative_marks`** | `numeric` | YES | `0.00` | — |
| 12 | **`difficulty`** | `character varying` | YES | `'medium'::character varying` | — |
| 13 | **`question_type`** | `character varying` | YES | `'single_correct'::character varying` | — |
| 14 | **`section`** | `character varying` | YES | — | — |
| 15 | **`section_id`** | `integer` | YES | — | — |
| 16 | **`order_index`** | `integer` | YES | `0` | — |
| 17 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 18 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.14 `attempt_section_scores` (BASE TABLE, 19 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('attempt_section_scores_id_seq'::regclass)` | — |
| 2 | **`attempt_id`** | `integer` | YES | — | — |
| 3 | **`section_id`** | `integer` | YES | — | — |
| 4 | **`correct`** | `integer` | YES | `0` | — |
| 5 | **`incorrect`** | `integer` | YES | `0` | — |
| 6 | **`wrong`** | `integer` | YES | `0` | — |
| 7 | **`skipped`** | `integer` | YES | `0` | — |
| 8 | **`unattempted`** | `integer` | YES | `0` | — |
| 9 | **`score`** | `numeric` | YES | `0` | — |
| 10 | **`marks`** | `numeric` | YES | `0` | — |
| 11 | **`negative_marks`** | `numeric` | YES | `0` | — |
| 12 | **`total_marks`** | `numeric` | YES | `0` | — |
| 13 | **`time_spent_seconds`** | `integer` | YES | `0` | — |
| 14 | **`is_active`** | `boolean` | YES | `true` | — |
| 15 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 16 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 17 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 18 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 19 | **`deleted_by`** | `integer` | YES | — | — |

### 4.15 `attempts` (BASE TABLE, 58 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('attempts_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | NO | — | — |
| 3 | **`test_id`** | `integer` | NO | — | — |
| 4 | **`series_id`** | `integer` | YES | — | — |
| 5 | **`status`** | `character varying` | YES | `'in_progress'::character varying` | — |
| 6 | **`start_time`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 7 | **`duration`** | `integer` | YES | — | — |
| 8 | **`answers`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 9 | **`is_completed`** | `boolean` | YES | `false` | — |
| 10 | **`total_questions`** | `integer` | YES | `0` | — |
| 11 | **`score`** | `numeric` | YES | `0` | — |
| 12 | **`total_marks`** | `numeric` | YES | `0` | — |
| 13 | **`correct`** | `integer` | YES | `0` | — |
| 14 | **`wrong`** | `integer` | YES | `0` | — |
| 15 | **`unattempted`** | `integer` | YES | `0` | — |
| 16 | **`accuracy`** | `numeric` | YES | `0` | — |
| 17 | **`time_spent`** | `integer` | YES | `0` | — |
| 18 | **`submitted_at`** | `timestamp without time zone` | YES | — | — |
| 19 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 20 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 21 | **`marked_for_review`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 22 | **`paused_at`** | `timestamp without time zone` | YES | — | — |
| 23 | **`resumed_at`** | `timestamp without time zone` | YES | — | — |
| 24 | **`remaining_time_seconds`** | `integer` | YES | — | — |
| 25 | **`total_time_spent`** | `integer` | YES | `0` | — |
| 26 | **`last_activity_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 27 | **`test_title`** | `character varying` | YES | — | — |
| 28 | **`is_reattempt`** | `boolean` | YES | `false` | — |
| 29 | **`reattempt_type`** | `character varying` | YES | — | — |
| 30 | **`parent_attempt_id`** | `integer` | YES | — | — |
| 31 | **`section_timers`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 32 | **`current_section`** | `character varying` | YES | — | — |
| 33 | **`public_id_uuid`** | `uuid` | NO | `gen_random_uuid()` | — |
| 34 | **`public_id`** | `text` | YES | — | — |
| 35 | **`section_scores`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 36 | **`section_times`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 37 | **`is_active`** | `boolean` | YES | `true` | — |
| 38 | **`qualifying_status`** | `character varying` | YES | `'qualified'::character varying` | — |
| 39 | **`user_category`** | `character varying` | YES | `'general'::character varying` | — |
| 40 | **`last_heartbeat_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 41 | **`expires_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 42 | **`started_at`** | `timestamp without time zone` | YES | — | — |
| 43 | **`last_activity`** | `timestamp without time zone` | YES | — | — |
| 44 | **`last_question_id`** | `integer` | YES | — | — |
| 45 | **`question_results`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 46 | **`solutions`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 47 | **`percentile`** | `numeric` | YES | — | — |
| 48 | **`rank`** | `integer` | YES | — | — |
| 49 | **`attempted`** | `integer` | YES | `0` | — |
| 50 | **`incorrect`** | `integer` | YES | `0` | — |
| 51 | **`skipped`** | `integer` | YES | `0` | — |
| 52 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 53 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 54 | **`deleted_by`** | `integer` | YES | — | — |
| 55 | **`attempt_number`** | `integer` | YES | `1` | — |
| 56 | **`flagged`** | `boolean` | NO | `false` | — |
| 57 | **`flag_reason`** | `text` | YES | — | — |
| 58 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |

### 4.16 `audit_logs` (BASE TABLE, 25 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('audit_logs_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | YES | — | — |
| 3 | **`admin_id`** | `integer` | YES | — | — |
| 4 | **`action`** | `character varying` | NO | — | — |
| 5 | **`table_name`** | `character varying` | YES | — | — |
| 6 | **`record_id`** | `integer` | YES | — | — |
| 7 | **`old_data`** | `jsonb` | YES | — | — |
| 8 | **`new_data`** | `jsonb` | YES | — | — |
| 9 | **`ip_address`** | `character varying` | YES | — | — |
| 10 | **`user_agent`** | `text` | YES | — | — |
| 11 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 12 | **`entity_type`** | `character varying` | YES | — | — |
| 13 | **`resource`** | `character varying` | YES | — | — |
| 14 | **`resource_id`** | `character varying` | YES | — | — |
| 15 | **`description`** | `text` | YES | — | — |
| 16 | **`status`** | `character varying` | YES | `'success'::character varying` | — |
| 17 | **`request_method`** | `character varying` | YES | — | — |
| 18 | **`request_path`** | `text` | YES | — | — |
| 19 | **`response_status_code`** | `integer` | YES | — | — |
| 20 | **`admin_email`** | `character varying` | YES | — | — |
| 21 | **`admin_name`** | `character varying` | YES | — | — |
| 22 | **`details`** | `jsonb` | YES | — | — |
| 23 | **`entity_id`** | `character varying` | YES | — | — |
| 24 | **`old_values`** | `jsonb` | YES | — | — |
| 25 | **`new_values`** | `jsonb` | YES | — | — |

### 4.17 `backups` (BASE TABLE, 13 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('backups_id_seq'::regclass)` | — |
| 2 | **`name`** | `character varying` | NO | — | — |
| 3 | **`type`** | `character varying` | YES | `'manual'::character varying` | — |
| 4 | **`status`** | `character varying` | YES | `'completed'::character varying` | — |
| 5 | **`size`** | `character varying` | YES | `'0 MB'::character varying` | — |
| 6 | **`created_by`** | `integer` | YES | — | — |
| 7 | **`is_active`** | `boolean` | YES | `true` | — |
| 8 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 9 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 10 | **`public_id`** | `character varying` | YES | — | — |
| 11 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 12 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 13 | **`deleted_by`** | `integer` | YES | — | — |

### 4.18 `banners` (BASE TABLE, 19 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('banners_id_seq'::regclass)` | — |
| 2 | **`title`** | `character varying` | NO | — | — |
| 3 | **`subtitle`** | `text` | YES | — | — |
| 4 | **`image_url`** | `character varying` | YES | — | — |
| 5 | **`link`** | `character varying` | YES | — | — |
| 6 | **`position`** | `character varying` | YES | `'home'::character varying` | — |
| 7 | **`is_active`** | `boolean` | YES | `true` | — |
| 8 | **`display_order`** | `integer` | YES | `0` | — |
| 9 | **`start_date`** | `timestamp without time zone` | YES | — | — |
| 10 | **`end_date`** | `timestamp without time zone` | YES | — | — |
| 11 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 12 | **`exam_id`** | `integer` | YES | — | — |
| 13 | **`asset_id`** | `integer` | YES | — | — |
| 14 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 15 | **`public_id`** | `character varying` | YES | — | — |
| 16 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 17 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 18 | **`deleted_by`** | `integer` | YES | — | — |
| 19 | **`deleted_reason`** | `text` | YES | — | — |

### 4.19 `blogs` (BASE TABLE, 16 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('blogs_id_seq'::regclass)` | — |
| 2 | **`title`** | `character varying` | YES | — | — |
| 3 | **`slug`** | `character varying` | YES | — | — |
| 4 | **`content`** | `text` | YES | — | — |
| 5 | **`excerpt`** | `text` | YES | — | — |
| 6 | **`author_id`** | `integer` | YES | — | — |
| 7 | **`category`** | `character varying` | YES | — | — |
| 8 | **`tags`** | `ARRAY` | YES | — | Array type: _text |
| 9 | **`featured_image`** | `text` | YES | — | — |
| 10 | **`status`** | `character varying` | YES | `'draft'::character varying` | — |
| 11 | **`published_at`** | `timestamp without time zone` | YES | — | — |
| 12 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 13 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 14 | **`deleted_by`** | `integer` | YES | — | — |
| 15 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 16 | **`deleted_reason`** | `text` | YES | — | — |

### 4.20 `bookmarks` (BASE TABLE, 15 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('bookmarks_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | NO | — | — |
| 3 | **`item_type`** | `character varying` | NO | — | — |
| 4 | **`item_id`** | `character varying` | NO | — | — |
| 5 | **`notes`** | `text` | YES | — | — |
| 6 | **`is_active`** | `boolean` | YES | `true` | — |
| 7 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 8 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 9 | **`public_id_uuid`** | `uuid` | NO | `gen_random_uuid()` | — |
| 10 | **`public_id`** | `text` | YES | — | — |
| 11 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 12 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 13 | **`deleted_by`** | `integer` | YES | — | — |
| 14 | **`title`** | `character varying` | YES | — | — |
| 15 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |

### 4.21 `ca_quiz_attempts` (BASE TABLE, 7 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('ca_quiz_attempts_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | YES | — | — |
| 3 | **`ca_id`** | `integer` | YES | — | — |
| 4 | **`answers`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 5 | **`correct_count`** | `integer` | YES | `0` | — |
| 6 | **`percentage`** | `numeric` | YES | `0` | — |
| 7 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.22 `ca_quizzes` (BASE TABLE, 13 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('ca_quizzes_id_seq'::regclass)` | — |
| 2 | **`ca_id`** | `integer` | YES | — | — |
| 3 | **`questions`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 4 | **`is_active`** | `boolean` | YES | `true` | — |
| 5 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 6 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 7 | **`title`** | `character varying` | YES | — | — |
| 8 | **`quiz_date`** | `date` | YES | — | — |
| 9 | **`total_questions`** | `integer` | YES | `0` | — |
| 10 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 11 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 12 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 13 | **`deleted_by`** | `integer` | YES | — | — |

### 4.23 `certificates` (BASE TABLE, 15 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('certificates_id_seq'::regclass)` | — |
| 2 | **`attempt_id`** | `integer` | NO | — | — |
| 3 | **`user_id`** | `integer` | NO | — | — |
| 4 | **`test_id`** | `integer` | YES | — | — |
| 5 | **`hash`** | `character varying` | NO | — | — |
| 6 | **`salt`** | `character varying` | NO | — | — |
| 7 | **`recipient_name`** | `character varying` | YES | — | — |
| 8 | **`test_title`** | `character varying` | YES | — | — |
| 9 | **`score`** | `numeric` | YES | — | — |
| 10 | **`total_marks`** | `numeric` | YES | — | — |
| 11 | **`percentage`** | `numeric` | YES | — | — |
| 12 | **`issued_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 13 | **`is_revoked`** | `boolean` | YES | `false` | — |
| 14 | **`revoked_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 15 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.24 `coming_soon_features` (BASE TABLE, 8 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('coming_soon_features_id_seq'::regclass)` | — |
| 2 | **`feature_key`** | `character varying` | NO | — | — |
| 3 | **`title`** | `character varying` | NO | — | — |
| 4 | **`description`** | `text` | YES | — | — |
| 5 | **`is_enabled`** | `boolean` | YES | `false` | — |
| 6 | **`eta`** | `character varying` | YES | — | — |
| 7 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 8 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.25 `community_comments` (BASE TABLE, 11 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('community_comments_id_seq'::regclass)` | — |
| 2 | **`post_id`** | `integer` | YES | — | — |
| 3 | **`user_id`** | `integer` | YES | — | — |
| 4 | **`content`** | `text` | NO | — | — |
| 5 | **`parent_id`** | `integer` | YES | — | — |
| 6 | **`is_active`** | `boolean` | YES | `true` | — |
| 7 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 8 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 9 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 10 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 11 | **`deleted_by`** | `integer` | YES | — | — |

### 4.26 `community_votes` (BASE TABLE, 10 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('community_votes_id_seq'::regclass)` | — |
| 2 | **`post_id`** | `integer` | NO | — | — |
| 3 | **`user_id`** | `integer` | NO | — | — |
| 4 | **`vote_type`** | `character varying` | NO | — | — |
| 5 | **`is_active`** | `boolean` | YES | `true` | — |
| 6 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 7 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 8 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 9 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 10 | **`deleted_by`** | `integer` | YES | — | — |

### 4.27 `concepts` (BASE TABLE, 13 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('concepts_id_seq'::regclass)` | — |
| 2 | **`name`** | `text` | NO | — | — |
| 3 | **`slug`** | `text` | NO | — | — |
| 4 | **`subtopic_id`** | `integer` | YES | — | — |
| 5 | **`stage_ids`** | `ARRAY` | YES | `'{}'::text[]` | Array type: _text |
| 6 | **`order_index`** | `integer` | YES | `0` | — |
| 7 | **`is_active`** | `boolean` | YES | `true` | — |
| 8 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 9 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 10 | **`public_id`** | `character varying` | YES | — | — |
| 11 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 12 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 13 | **`deleted_by`** | `integer` | YES | — | — |

### 4.28 `content_moderation_queue` (BASE TABLE, 13 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('content_moderation_queue_id_seq'::regclass)` | — |
| 2 | **`entity_type`** | `character varying` | NO | — | — |
| 3 | **`entity_id`** | `integer` | NO | — | — |
| 4 | **`submitted_by`** | `integer` | YES | — | — |
| 5 | **`reviewed_by`** | `integer` | YES | — | — |
| 6 | **`status`** | `character varying` | YES | `'pending'::character varying` | — |
| 7 | **`priority`** | `character varying` | YES | `'normal'::character varying` | — |
| 8 | **`notes`** | `text` | YES | — | — |
| 9 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 10 | **`submitted_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 11 | **`reviewed_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 12 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 13 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.29 `coupons` (BASE TABLE, 29 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('coupons_id_seq'::regclass)` | — |
| 2 | **`code`** | `character varying` | NO | — | — |
| 3 | **`description`** | `text` | YES | `''::text` | — |
| 4 | **`discount_type`** | `character varying` | NO | — | — |
| 5 | **`discount_value`** | `numeric` | NO | — | — |
| 6 | **`max_discount`** | `numeric` | YES | `NULL::numeric` | — |
| 7 | **`min_order_value`** | `numeric` | YES | `0` | — |
| 8 | **`valid_from`** | `timestamp without time zone` | NO | — | — |
| 9 | **`valid_until`** | `timestamp without time zone` | NO | — | — |
| 10 | **`usage_limit`** | `integer` | YES | — | — |
| 11 | **`usage_count`** | `integer` | YES | `0` | — |
| 12 | **`user_usage_limit`** | `integer` | YES | `1` | — |
| 13 | **`used_by_users`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 14 | **`applicable_plans`** | `ARRAY` | YES | `'{}'::text[]` | Array type: _text |
| 15 | **`applicable_categories`** | `ARRAY` | YES | `'{}'::text[]` | Array type: _text |
| 16 | **`applicable_exams`** | `ARRAY` | YES | `'{}'::text[]` | Array type: _text |
| 17 | **`is_active`** | `boolean` | YES | `true` | — |
| 18 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 19 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 20 | **`plan_id`** | `integer` | YES | — | — |
| 21 | **`public_id`** | `character varying` | YES | — | — |
| 22 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 23 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 24 | **`deleted_by`** | `integer` | YES | — | — |
| 25 | **`min_purchase`** | `numeric` | YES | `0` | — |
| 26 | **`used_count`** | `integer` | YES | `0` | — |
| 27 | **`new_user_only`** | `boolean` | YES | `false` | — |
| 28 | **`one_per_user`** | `boolean` | YES | `true` | — |
| 29 | **`deleted_reason`** | `text` | YES | — | — |

### 4.30 `csrf_tokens` (BASE TABLE, 10 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('csrf_tokens_id_seq'::regclass)` | — |
| 2 | **`auth_token_hash`** | `character varying` | NO | — | — |
| 3 | **`csrf_token`** | `text` | NO | — | — |
| 4 | **`expires_at`** | `timestamp without time zone` | NO | — | — |
| 5 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 6 | **`user_id`** | `integer` | YES | — | — |
| 7 | **`is_active`** | `boolean` | YES | `true` | — |
| 8 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 9 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 10 | **`deleted_by`** | `integer` | YES | — | — |

### 4.31 `current_affairs` (BASE TABLE, 23 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('current_affairs_id_seq'::regclass)` | — |
| 2 | **`title`** | `character varying` | NO | — | — |
| 3 | **`content`** | `text` | YES | — | — |
| 4 | **`category`** | `character varying` | YES | `'India'::character varying` | — |
| 5 | **`date`** | `date` | YES | `CURRENT_DATE` | — |
| 6 | **`language`** | `character varying` | YES | `'en'::character varying` | — |
| 7 | **`is_active`** | `boolean` | YES | `true` | — |
| 8 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 9 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 10 | **`deleted_by`** | `integer` | YES | — | — |
| 11 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 12 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 13 | **`slug`** | `character varying` | YES | — | — |
| 14 | **`excerpt`** | `text` | YES | — | — |
| 15 | **`category_id`** | `integer` | YES | — | — |
| 16 | **`exam_id`** | `integer` | YES | — | — |
| 17 | **`image_asset_id`** | `integer` | YES | — | — |
| 18 | **`author_id`** | `integer` | YES | — | — |
| 19 | **`published_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 20 | **`is_featured`** | `boolean` | YES | `false` | — |
| 21 | **`view_count`** | `integer` | YES | `0` | — |
| 22 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 23 | **`deleted_reason`** | `text` | YES | — | — |

### 4.32 `daily_quiz_attempts` (BASE TABLE, 13 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('daily_quiz_attempts_id_seq'::regclass)` | — |
| 2 | **`quiz_id`** | `integer` | NO | — | — |
| 3 | **`user_id`** | `integer` | NO | — | — |
| 4 | **`answers`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 5 | **`score`** | `numeric` | YES | `0` | — |
| 6 | **`accuracy`** | `numeric` | YES | `0` | — |
| 7 | **`submitted_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 8 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 9 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 10 | **`is_active`** | `boolean` | YES | `true` | — |
| 11 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 12 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 13 | **`deleted_by`** | `integer` | YES | — | — |

### 4.33 `daily_quiz_questions` (BASE TABLE, 10 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('daily_quiz_questions_id_seq'::regclass)` | — |
| 2 | **`quiz_id`** | `integer` | NO | — | — |
| 3 | **`question_id`** | `integer` | NO | — | — |
| 4 | **`position`** | `integer` | YES | `0` | — |
| 5 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 6 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 7 | **`is_active`** | `boolean` | YES | `true` | — |
| 8 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 9 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 10 | **`deleted_by`** | `integer` | YES | — | — |

### 4.34 `daily_quizzes` (BASE TABLE, 13 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('daily_quizzes_id_seq'::regclass)` | — |
| 2 | **`quiz_date`** | `date` | NO | — | — |
| 3 | **`title`** | `character varying` | NO | — | — |
| 4 | **`total_questions`** | `integer` | YES | `0` | — |
| 5 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 6 | **`is_active`** | `boolean` | YES | `true` | — |
| 7 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 8 | **`public_id_uuid`** | `uuid` | NO | `gen_random_uuid()` | — |
| 9 | **`public_id`** | `text` | YES | — | — |
| 10 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 11 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 12 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 13 | **`deleted_by`** | `integer` | YES | — | — |

### 4.35 `dead_letter_jobs` (BASE TABLE, 8 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('dead_letter_jobs_id_seq'::regclass)` | — |
| 2 | **`queue_name`** | `character varying` | NO | — | — |
| 3 | **`job_id`** | `character varying` | NO | — | — |
| 4 | **`job_name`** | `character varying` | NO | — | — |
| 5 | **`payload`** | `jsonb` | YES | — | — |
| 6 | **`error_message`** | `text` | YES | — | — |
| 7 | **`error_stack`** | `text` | YES | — | — |
| 8 | **`failed_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.36 `discussion_replies` (BASE TABLE, 12 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('discussion_replies_id_seq'::regclass)` | — |
| 2 | **`discussion_id`** | `integer` | YES | — | — |
| 3 | **`author_id`** | `integer` | YES | — | — |
| 4 | **`content`** | `text` | NO | — | — |
| 5 | **`parent_id`** | `integer` | YES | — | — |
| 6 | **`upvotes`** | `integer` | YES | `0` | — |
| 7 | **`is_active`** | `boolean` | YES | `true` | — |
| 8 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 9 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 10 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 11 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 12 | **`deleted_by`** | `integer` | YES | — | — |

### 4.37 `discussion_votes` (BASE TABLE, 11 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('discussion_votes_id_seq'::regclass)` | — |
| 2 | **`discussion_id`** | `integer` | YES | — | — |
| 3 | **`reply_id`** | `integer` | YES | — | — |
| 4 | **`user_id`** | `integer` | NO | — | — |
| 5 | **`vote_type`** | `character varying` | YES | `'upvote'::character varying` | — |
| 6 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 7 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 8 | **`is_active`** | `boolean` | YES | `true` | — |
| 9 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 10 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 11 | **`deleted_by`** | `integer` | YES | — | — |

### 4.38 `discussions` (BASE TABLE, 33 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('discussions_id_seq'::regclass)` | — |
| 2 | **`public_id_uuid`** | `uuid` | YES | `gen_random_uuid()` | — |
| 3 | **`public_id`** | `text` | YES | — | — |
| 4 | **`type`** | `character varying` | NO | — | — |
| 5 | **`content`** | `text` | NO | — | — |
| 6 | **`user_id`** | `integer` | YES | — | — |
| 7 | **`parent_id`** | `integer` | YES | — | — |
| 8 | **`reference_type`** | `character varying` | YES | — | — |
| 9 | **`reference_id`** | `integer` | YES | — | — |
| 10 | **`upvotes`** | `integer` | YES | `0` | — |
| 11 | **`is_active`** | `boolean` | YES | `true` | — |
| 12 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 13 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 14 | **`group_id`** | `integer` | YES | — | — |
| 15 | **`user_name`** | `character varying` | YES | — | — |
| 16 | **`user_avatar`** | `character varying` | YES | — | — |
| 17 | **`post_type`** | `character varying` | YES | `'discussion'::character varying` | — |
| 18 | **`is_pinned`** | `boolean` | YES | `false` | — |
| 19 | **`is_locked`** | `boolean` | YES | `false` | — |
| 20 | **`is_edited`** | `boolean` | YES | `false` | — |
| 21 | **`is_anonymous`** | `boolean` | YES | `false` | — |
| 22 | **`like_count`** | `integer` | YES | `0` | — |
| 23 | **`comment_count`** | `integer` | YES | `0` | — |
| 24 | **`view_count`** | `integer` | YES | `0` | — |
| 25 | **`tags`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 26 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 27 | **`downvotes`** | `integer` | YES | `0` | — |
| 28 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 29 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 30 | **`deleted_by`** | `integer` | YES | — | — |
| 31 | **`deleted_reason`** | `text` | YES | — | — |
| 32 | **`author_id`** | `integer` | YES | — | — |
| 33 | **`category`** | `character varying` | YES | — | — |

### 4.39 `document_chunks` (BASE TABLE, 6 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('document_chunks_id_seq'::regclass)` | — |
| 2 | **`document_name`** | `character varying` | NO | — | — |
| 3 | **`chunk_index`** | `integer` | NO | — | — |
| 4 | **`content`** | `text` | NO | — | — |
| 5 | **`tsv_content`** | `tsvector` | YES | — | — |
| 6 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.40 `doubt_replies` (BASE TABLE, 17 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('doubt_replies_id_seq'::regclass)` | — |
| 2 | **`doubt_id`** | `integer` | NO | — | — |
| 3 | **`user_id`** | `integer` | NO | — | — |
| 4 | **`user_name`** | `character varying` | YES | — | — |
| 5 | **`user_email`** | `character varying` | YES | — | — |
| 6 | **`content`** | `text` | NO | — | — |
| 7 | **`is_accepted`** | `boolean` | YES | `false` | — |
| 8 | **`is_active`** | `boolean` | YES | `true` | — |
| 9 | **`upvotes`** | `integer` | YES | `0` | — |
| 10 | **`upvoted_by`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 11 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 12 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 13 | **`deleted_by`** | `integer` | YES | — | — |
| 14 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 15 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 16 | **`public_id_uuid`** | `uuid` | YES | `gen_random_uuid()` | — |
| 17 | **`public_id`** | `text` | YES | — | — |

### 4.41 `doubts` (BASE TABLE, 21 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('doubts_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | NO | — | — |
| 3 | **`user_name`** | `character varying` | YES | — | — |
| 4 | **`user_email`** | `character varying` | YES | — | — |
| 5 | **`title`** | `character varying` | NO | — | — |
| 6 | **`description`** | `text` | NO | — | — |
| 7 | **`category`** | `character varying` | YES | — | — |
| 8 | **`tags`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 9 | **`status`** | `character varying` | YES | `'open'::character varying` | — |
| 10 | **`views`** | `integer` | YES | `0` | — |
| 11 | **`is_active`** | `boolean` | YES | `true` | — |
| 12 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 13 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 14 | **`public_id_uuid`** | `uuid` | NO | `gen_random_uuid()` | — |
| 15 | **`public_id`** | `text` | YES | — | — |
| 16 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 17 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 18 | **`deleted_by`** | `integer` | YES | — | — |
| 19 | **`is_resolved`** | `boolean` | YES | `false` | — |
| 20 | **`upvotes`** | `integer` | YES | `0` | — |
| 21 | **`deleted_reason`** | `text` | YES | — | — |

### 4.42 `email_templates` (BASE TABLE, 16 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('email_templates_id_seq'::regclass)` | — |
| 2 | **`name`** | `character varying` | NO | — | — |
| 3 | **`type`** | `character varying` | NO | — | — |
| 4 | **`subject`** | `character varying` | NO | — | — |
| 5 | **`body`** | `text` | NO | — | — |
| 6 | **`body_html`** | `text` | YES | — | — |
| 7 | **`body_text`** | `text` | YES | — | — |
| 8 | **`variables`** | `jsonb` | YES | — | — |
| 9 | **`enabled`** | `boolean` | YES | `true` | — |
| 10 | **`is_active`** | `boolean` | YES | `true` | — |
| 11 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 12 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 13 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 14 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 15 | **`deleted_by`** | `integer` | YES | — | — |
| 16 | **`deleted_reason`** | `text` | YES | — | — |

### 4.43 `embeddings` (BASE TABLE, 7 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('embeddings_id_seq'::regclass)` | — |
| 2 | **`content_type`** | `character varying` | NO | — | — |
| 3 | **`content_id`** | `integer` | NO | — | — |
| 4 | **`embedding`** | `USER-DEFINED` | YES | — | pgvector: vector(1536) embedding |
| 5 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 6 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 7 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.44 `enrollments` (BASE TABLE, 19 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('enrollments_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | YES | — | — |
| 3 | **`series_id`** | `integer` | YES | — | — |
| 4 | **`enrolled_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 5 | **`expires_at`** | `timestamp without time zone` | YES | — | — |
| 6 | **`status`** | `character varying` | YES | `'active'::character varying` | — |
| 7 | **`progress`** | `numeric` | YES | `0` | — |
| 8 | **`exam_id`** | `integer` | YES | — | — |
| 9 | **`study_material_id`** | `integer` | YES | — | — |
| 10 | **`is_paid`** | `boolean` | YES | `false` | — |
| 11 | **`payment_id`** | `character varying` | YES | — | — |
| 12 | **`amount`** | `numeric` | YES | `0` | — |
| 13 | **`is_active`** | `boolean` | YES | `true` | — |
| 14 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 15 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 16 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 17 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 18 | **`deleted_by`** | `integer` | YES | — | — |
| 19 | **`type`** | `character varying` | YES | `'series'::character varying` | — |

### 4.45 `exam_categories` (BASE TABLE, 15 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('exam_categories_id_seq'::regclass)` | — |
| 2 | **`category_id`** | `character varying` | NO | — | — |
| 3 | **`label`** | `character varying` | NO | — | — |
| 4 | **`icon`** | `character varying` | YES | — | — |
| 5 | **`slug`** | `character varying` | NO | — | — |
| 6 | **`order`** | `integer` | YES | `0` | — |
| 7 | **`is_active`** | `boolean` | YES | `true` | — |
| 8 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 9 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 10 | **`description`** | `text` | YES | — | — |
| 12 | **`display_order`** | `integer` | YES | `0` | — |
| 15 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 16 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 17 | **`deleted_by`** | `integer` | YES | — | — |
| 18 | **`deleted_reason`** | `text` | YES | — | — |

### 4.46 `exam_info` (BASE TABLE, 20 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('exam_info_id_seq'::regclass)` | — |
| 2 | **`category_id`** | `character varying` | YES | — | — |
| 3 | **`exam_id`** | `character varying` | YES | — | — |
| 4 | **`year`** | `integer` | YES | — | — |
| 5 | **`title`** | `character varying` | YES | — | — |
| 6 | **`full_name`** | `character varying` | YES | — | — |
| 7 | **`description`** | `text` | YES | — | — |
| 8 | **`notification`** | `text` | YES | — | — |
| 9 | **`series_id`** | `character varying` | YES | — | — |
| 10 | **`eligibility`** | `text` | YES | — | — |
| 11 | **`age_limit`** | `character varying` | YES | — | — |
| 12 | **`syllabus`** | `text` | YES | — | — |
| 13 | **`is_active`** | `boolean` | YES | `true` | — |
| 14 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 15 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 16 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 17 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 18 | **`deleted_by`** | `integer` | YES | — | — |
| 19 | **`series_id_int`** | `integer` | YES | — | — |
| 20 | **`deleted_reason`** | `text` | YES | — | — |

### 4.47 `exam_rooms` (BASE TABLE, 14 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `uuid` | NO | `gen_random_uuid()` | — |
| 2 | **`exam_name`** | `character varying` | NO | — | — |
| 3 | **`exam_type`** | `character varying` | NO | — | — |
| 4 | **`exam_date`** | `date` | NO | — | — |
| 5 | **`room_code`** | `character varying` | NO | — | — |
| 6 | **`description`** | `text` | YES | — | — |
| 7 | **`is_active`** | `boolean` | NO | `true` | — |
| 8 | **`is_deleted`** | `boolean` | NO | `false` | — |
| 9 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 10 | **`deleted_by`** | `integer` | YES | — | — |
| 11 | **`created_by`** | `integer` | YES | — | — |
| 12 | **`created_at`** | `timestamp with time zone` | NO | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 13 | **`updated_at`** | `timestamp with time zone` | NO | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 14 | **`public_id`** | `uuid` | YES | `gen_random_uuid()` | — |

### 4.48 `exam_seasons` (BASE TABLE, 25 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('exam_seasons_id_seq'::regclass)` | — |
| 2 | **`exam_id`** | `integer` | NO | — | — |
| 3 | **`season_slug`** | `character varying` | NO | — | — |
| 4 | **`year`** | `integer` | NO | — | — |
| 5 | **`title`** | `character varying` | NO | — | — |
| 6 | **`notification_date`** | `date` | YES | — | — |
| 7 | **`application_start_date`** | `date` | YES | — | — |
| 8 | **`application_end_date`** | `date` | YES | — | — |
| 9 | **`exam_date`** | `date` | YES | — | — |
| 10 | **`result_date`** | `date` | YES | — | — |
| 11 | **`vacancy_total`** | `integer` | YES | `0` | — |
| 12 | **`status`** | `character varying` | YES | `'upcoming'::character varying` | — |
| 13 | **`is_active`** | `boolean` | YES | `true` | — |
| 14 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 15 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 16 | **`notification_url`** | `character varying` | YES | — | — |
| 17 | **`application_url`** | `character varying` | YES | — | — |
| 18 | **`admit_card_date`** | `date` | YES | — | — |
| 19 | **`description`** | `text` | YES | — | — |
| 20 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 21 | **`exam_internal_id`** | `integer` | YES | — | — |
| 22 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 23 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 24 | **`deleted_by`** | `integer` | YES | — | — |
| 25 | **`deleted_reason`** | `text` | YES | — | — |

### 4.49 `exam_static_content` (BASE TABLE, 15 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('exam_static_content_id_seq'::regclass)` | — |
| 3 | **`overview`** | `text` | YES | — | — |
| 4 | **`basic_eligibility`** | `text` | YES | — | — |
| 5 | **`basic_age_limit`** | `character varying` | YES | — | — |
| 6 | **`age_relaxation`** | `text` | YES | — | — |
| 7 | **`selection_process`** | `text` | YES | — | — |
| 8 | **`exam_frequency`** | `character varying` | YES | — | — |
| 9 | **`conducting_body`** | `character varying` | YES | — | — |
| 10 | **`is_active`** | `boolean` | YES | `true` | — |
| 11 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 12 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 13 | **`exam_id`** | `integer` | YES | — | — |
| 14 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 15 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 16 | **`deleted_by`** | `integer` | YES | — | — |

### 4.50 `exam_updates` (BASE TABLE, 14 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('exam_updates_id_seq'::regclass)` | — |
| 3 | **`type`** | `character varying` | NO | — | — |
| 4 | **`title`** | `character varying` | NO | — | — |
| 5 | **`description`** | `text` | YES | — | — |
| 6 | **`priority`** | `character varying` | YES | `'normal'::character varying` | — |
| 7 | **`update_date`** | `date` | YES | — | — |
| 8 | **`is_active`** | `boolean` | YES | `true` | — |
| 9 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 11 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 12 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 13 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 14 | **`deleted_by`** | `integer` | YES | — | — |
| 15 | **`deleted_reason`** | `text` | YES | — | — |
| 16 | **`exam_id`** | `integer` | NO | — | — |

### 4.51 `exam_yearly_data` (BASE TABLE, 23 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('exam_yearly_data_id_seq'::regclass)` | — |
| 3 | **`year`** | `integer` | NO | — | — |
| 4 | **`notification`** | `character varying` | YES | — | — |
| 5 | **`notification_date`** | `date` | YES | — | — |
| 6 | **`application_start`** | `date` | YES | — | — |
| 7 | **`application_end`** | `date` | YES | — | — |
| 8 | **`tier1_exam_date`** | `date` | YES | — | — |
| 9 | **`tier2_exam_date`** | `date` | YES | — | — |
| 10 | **`vacancy_total`** | `integer` | YES | — | — |
| 11 | **`vacancy_breakup`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 12 | **`cutoff`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 13 | **`syllabus_changes`** | `text` | YES | — | — |
| 14 | **`pattern_changes`** | `text` | YES | — | — |
| 15 | **`important_dates`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 16 | **`result_status`** | `character varying` | YES | — | — |
| 17 | **`is_active`** | `boolean` | YES | `true` | — |
| 18 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 20 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 21 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 22 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 23 | **`deleted_by`** | `integer` | YES | — | — |
| 24 | **`deleted_reason`** | `text` | YES | — | — |
| 25 | **`exam_id`** | `integer` | NO | — | — |

### 4.52 `exams` (BASE TABLE, 30 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('exams_id_seq'::regclass)` | — |
| 2 | **`category_id`** | `character varying` | YES | — | — |
| 3 | **`exam_id`** | `character varying` | NO | — | — |
| 4 | **`title`** | `character varying` | NO | — | — |
| 5 | **`full_name`** | `character varying` | YES | — | — |
| 6 | **`description`** | `text` | YES | — | — |
| 7 | **`notification`** | `text` | YES | — | — |
| 8 | **`eligibility`** | `text` | YES | — | — |
| 9 | **`age_limit`** | `text` | YES | — | — |
| 10 | **`syllabus`** | `text` | YES | — | — |
| 11 | **`series_id`** | `integer` | YES | — | — |
| 12 | **`is_active`** | `boolean` | YES | `true` | — |
| 13 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 14 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 15 | **`public_id_uuid`** | `uuid` | NO | `gen_random_uuid()` | — |
| 16 | **`public_id`** | `text` | YES | — | — |
| 17 | **`exam_pattern`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 18 | **`important_dates`** | `jsonb` | YES | — | — |
| 19 | **`official_website`** | `text` | YES | — | — |
| 20 | **`salary_structure`** | `jsonb` | YES | — | — |
| 21 | **`selection_process`** | `text` | YES | — | — |
| 22 | **`year`** | `integer` | YES | — | — |
| 23 | **`stage_ids`** | `ARRAY` | YES | `'{}'::integer[]` | Array type: _int4 |
| 24 | **`display_order`** | `integer` | YES | `0` | — |
| 25 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 26 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 27 | **`deleted_by`** | `integer` | YES | — | — |
| 28 | **`slug`** | `character varying` | YES | — | — |
| 29 | **`_orphaned`** | `boolean` | YES | `false` | — |
| 30 | **`deleted_reason`** | `text` | YES | — | — |

### 4.53 `faqs` (BASE TABLE, 14 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('faqs_id_seq'::regclass)` | — |
| 2 | **`question`** | `text` | NO | — | — |
| 3 | **`answer`** | `text` | NO | — | — |
| 4 | **`category`** | `character varying` | YES | `'general'::character varying` | — |
| 5 | **`is_active`** | `boolean` | YES | `true` | — |
| 6 | **`display_order`** | `integer` | YES | `0` | — |
| 7 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 8 | **`category_id`** | `integer` | YES | — | — |
| 9 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 10 | **`public_id`** | `character varying` | YES | — | — |
| 11 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 12 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 13 | **`deleted_by`** | `integer` | YES | — | — |
| 14 | **`deleted_reason`** | `text` | YES | — | — |

### 4.54 `fundamental_skill_drills` (BASE TABLE, 8 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('fundamental_skill_drills_id_seq'::regclass)` | — |
| 2 | **`category`** | `character varying` | NO | — | — |
| 3 | **`title`** | `character varying` | NO | — | — |
| 4 | **`description`** | `text` | YES | — | — |
| 5 | **`level`** | `integer` | YES | `1` | — |
| 6 | **`config`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 7 | **`is_active`** | `boolean` | YES | `true` | — |
| 8 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.55 `group_messages` (BASE TABLE, 12 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('group_messages_id_seq'::regclass)` | — |
| 2 | **`group_id`** | `integer` | YES | — | — |
| 3 | **`user_id`** | `integer` | YES | — | — |
| 4 | **`content`** | `text` | NO | — | — |
| 5 | **`message_type`** | `character varying` | YES | `'text'::character varying` | — |
| 6 | **`reply_to`** | `integer` | YES | — | — |
| 7 | **`is_edited`** | `boolean` | YES | `false` | — |
| 8 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 9 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 10 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 11 | **`message`** | `text` | YES | — | — |
| 12 | **`is_read`** | `boolean` | YES | `false` | — |

### 4.56 `group_post_comments` (BASE TABLE, 6 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('group_post_comments_id_seq'::regclass)` | — |
| 2 | **`post_id`** | `integer` | YES | — | — |
| 3 | **`user_id`** | `integer` | YES | — | — |
| 4 | **`content`** | `text` | NO | — | — |
| 5 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 6 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.57 `group_post_likes` (BASE TABLE, 4 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('group_post_likes_id_seq'::regclass)` | — |
| 2 | **`post_id`** | `integer` | YES | — | — |
| 3 | **`user_id`** | `integer` | YES | — | — |
| 4 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.58 `group_posts` (BASE TABLE, 12 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('group_posts_id_seq'::regclass)` | — |
| 2 | **`group_id`** | `integer` | YES | — | — |
| 3 | **`user_id`** | `integer` | YES | — | — |
| 4 | **`title`** | `character varying` | NO | — | — |
| 5 | **`content`** | `text` | YES | — | — |
| 6 | **`post_type`** | `character varying` | YES | `'discussion'::character varying` | — |
| 7 | **`is_pinned`** | `boolean` | YES | `false` | — |
| 8 | **`is_locked`** | `boolean` | YES | `false` | — |
| 9 | **`view_count`** | `integer` | YES | `0` | — |
| 10 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 11 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 12 | **`is_active`** | `boolean` | YES | `true` | — |

### 4.59 `import_logs` (BASE TABLE, 11 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `bigint` | NO | `nextval('import_logs_id_seq'::regclass)` | — |
| 2 | **`source`** | `character varying` | NO | — | — |
| 3 | **`file_name`** | `character varying` | YES | — | — |
| 4 | **`total_records`** | `integer` | YES | `0` | — |
| 5 | **`imported`** | `integer` | YES | `0` | — |
| 6 | **`skipped`** | `integer` | YES | `0` | — |
| 7 | **`failed`** | `integer` | YES | `0` | — |
| 8 | **`errors`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 9 | **`imported_by`** | `integer` | YES | — | — |
| 10 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 11 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.60 `knowledge_vault_items` (BASE TABLE, 7 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('knowledge_vault_items_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | NO | — | — |
| 3 | **`question_id`** | `integer` | YES | — | — |
| 4 | **`save_reason`** | `character varying` | NO | — | — |
| 5 | **`collection_name`** | `character varying` | YES | `'Default'::character varying` | — |
| 6 | **`user_notes`** | `text` | YES | — | — |
| 7 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.61 `leaderboard_entries` (BASE TABLE, 21 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('leaderboard_entries_id_seq'::regclass)` | — |
| 2 | **`leaderboard_type`** | `character varying` | NO | — | — |
| 3 | **`scope_key`** | `character varying` | NO | — | — |
| 4 | **`user_id`** | `integer` | YES | — | — |
| 5 | **`test_id`** | `integer` | YES | — | — |
| 6 | **`score`** | `numeric` | YES | `0` | — |
| 7 | **`accuracy`** | `numeric` | YES | `0` | — |
| 8 | **`time_spent_seconds`** | `integer` | YES | `0` | — |
| 9 | **`rank`** | `integer` | YES | `0` | — |
| 10 | **`percentile`** | `numeric` | YES | `0` | — |
| 11 | **`batch_date`** | `date` | YES | `CURRENT_DATE` | — |
| 12 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 13 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 14 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 15 | **`public_id_uuid`** | `uuid` | NO | `gen_random_uuid()` | — |
| 16 | **`public_id`** | `text` | YES | — | — |
| 17 | **`is_active`** | `boolean` | YES | `true` | — |
| 18 | **`rankings`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 19 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 20 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 21 | **`deleted_by`** | `integer` | YES | — | — |

### 4.62 `leaderboard_snapshots` (BASE TABLE, 15 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('leaderboard_snapshots_id_seq'::regclass)` | — |
| 2 | **`test_id`** | `integer` | NO | — | — |
| 3 | **`snapshot_date`** | `date` | NO | — | — |
| 4 | **`rankings`** | `jsonb` | NO | — | — |
| 5 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 6 | **`leaderboard_id`** | `integer` | YES | — | — |
| 7 | **`user_id`** | `integer` | YES | — | — |
| 8 | **`rank`** | `integer` | YES | — | — |
| 9 | **`score`** | `numeric` | YES | `0` | — |
| 10 | **`captured_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 11 | **`is_active`** | `boolean` | YES | `true` | — |
| 12 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 13 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 14 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 15 | **`deleted_by`** | `integer` | YES | — | — |

### 4.63 `leaderboards` (BASE TABLE, 36 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('leaderboards_id_seq'::regclass)` | — |
| 3 | **`title`** | `character varying` | YES | `'Unknown'::character varying` | — |
| 4 | **`test_title`** | `character varying` | YES | `'Unknown'::character varying` | — |
| 5 | **`is_active`** | `boolean` | YES | `true` | — |
| 6 | **`rankings`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 7 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 8 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 9 | **`test_id`** | `integer` | YES | — | — |
| 10 | **`public_id`** | `character varying` | YES | — | — |
| 11 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 12 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 13 | **`deleted_by`** | `integer` | YES | — | — |
| 14 | **`user_id`** | `integer` | YES | — | — |
| 15 | **`score`** | `numeric` | YES | — | — |
| 16 | **`accuracy`** | `numeric` | YES | — | — |
| 17 | **`time_spent_seconds`** | `integer` | YES | — | — |
| 18 | **`rank`** | `integer` | YES | — | — |
| 19 | **`percentile`** | `numeric` | YES | — | — |
| 20 | **`batch_date`** | `date` | YES | `CURRENT_DATE` | — |
| 21 | **`deleted_reason`** | `text` | YES | — | — |
| 22 | **`name`** | `character varying` | YES | — | — |
| 23 | **`description`** | `text` | YES | — | — |
| 24 | **`type`** | `character varying` | YES | `'test'::character varying` | — |
| 25 | **`scope`** | `character varying` | YES | `'global'::character varying` | — |
| 26 | **`scope_id`** | `character varying` | YES | — | — |
| 27 | **`period`** | `character varying` | YES | `'all-time'::character varying` | — |
| 28 | **`start_date`** | `timestamp with time zone` | YES | — | — |
| 29 | **`end_date`** | `timestamp with time zone` | YES | — | — |
| 30 | **`ranking_criteria`** | `jsonb` | YES | `'["score", "timeTaken"]'::jsonb` | — |
| 31 | **`is_published`** | `boolean` | YES | `false` | — |
| 32 | **`show_on_homepage`** | `boolean` | YES | `false` | — |
| 33 | **`max_rankings`** | `integer` | YES | `100` | — |
| 34 | **`total_participants`** | `integer` | YES | `0` | — |
| 35 | **`is_archived`** | `boolean` | YES | `false` | — |
| 36 | **`last_calculated_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 37 | **`created_by`** | `integer` | YES | — | — |

### 4.64 `learner_mistake_vault` (BASE TABLE, 18 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `bigint` | NO | `nextval('learner_mistake_vault_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | NO | — | — |
| 3 | **`question_id`** | `integer` | NO | — | — |
| 4 | **`attempt_id`** | `integer` | YES | — | — |
| 5 | **`topic_id`** | `integer` | YES | — | — |
| 6 | **`subject_id`** | `integer` | YES | — | — |
| 7 | **`inferred_category`** | `character varying` | NO | `'conceptual'::character varying` | — |
| 8 | **`user_category`** | `character varying` | YES | — | — |
| 9 | **`user_notes`** | `text` | YES | — | — |
| 10 | **`selected_option`** | `character varying` | YES | — | — |
| 11 | **`correct_option`** | `character varying` | YES | — | — |
| 12 | **`time_spent_seconds`** | `integer` | YES | `0` | — |
| 13 | **`is_resolved`** | `boolean` | NO | `false` | — |
| 14 | **`resolved_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 15 | **`review_count`** | `integer` | NO | `0` | — |
| 16 | **`last_reviewed_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 17 | **`created_at`** | `timestamp with time zone` | NO | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 18 | **`updated_at`** | `timestamp with time zone` | NO | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.65 `learner_recommendation_feedback` (BASE TABLE, 7 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `bigint` | NO | `nextval('learner_recommendation_feedback_id_seq'::regclass)` | — |
| 2 | **`recommendation_id`** | `bigint` | YES | — | — |
| 3 | **`user_id`** | `integer` | NO | — | — |
| 4 | **`feedback_type`** | `character varying` | NO | — | — |
| 5 | **`reason_tag`** | `character varying` | YES | — | — |
| 6 | **`feedback_notes`** | `text` | YES | — | — |
| 7 | **`created_at`** | `timestamp with time zone` | NO | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.66 `learner_recommendations` (BASE TABLE, 18 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `bigint` | NO | `nextval('learner_recommendations_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | NO | — | — |
| 3 | **`action_type`** | `character varying` | NO | — | — |
| 4 | **`target_topic_id`** | `integer` | YES | — | — |
| 5 | **`target_subject_id`** | `integer` | YES | — | — |
| 6 | **`target_test_id`** | `integer` | YES | — | — |
| 7 | **`title`** | `character varying` | NO | — | — |
| 8 | **`subtitle`** | `character varying` | YES | — | — |
| 9 | **`estimated_minutes`** | `integer` | NO | `20` | — |
| 10 | **`question_count`** | `integer` | NO | `15` | — |
| 11 | **`priority_score`** | `numeric` | NO | `50.00` | — |
| 12 | **`evidence_json`** | `jsonb` | NO | `'{}'::jsonb` | — |
| 13 | **`natural_language_reason`** | `text` | YES | — | — |
| 14 | **`next_steps_json`** | `jsonb` | NO | `'[]'::jsonb` | — |
| 15 | **`is_completed`** | `boolean` | NO | `false` | — |
| 16 | **`completed_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 17 | **`expires_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 18 | **`created_at`** | `timestamp with time zone` | NO | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.67 `learner_study_health` (BASE TABLE, 11 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`user_id`** | `integer` | NO | — | — |
| 2 | **`consistency_score`** | `numeric` | NO | `50.00` | — |
| 3 | **`active_days_last_30_days`** | `integer` | NO | `0` | — |
| 4 | **`current_streak_days`** | `integer` | NO | `0` | — |
| 5 | **`revision_ratio`** | `numeric` | NO | `0.00` | — |
| 6 | **`practice_test_balance`** | `numeric` | NO | `50.00` | — |
| 7 | **`unresolved_mistakes_count`** | `integer` | NO | `0` | — |
| 8 | **`overtesting_flag`** | `boolean` | NO | `false` | — |
| 9 | **`overall_health_score`** | `numeric` | NO | `50.00` | — |
| 10 | **`insights_json`** | `jsonb` | NO | `'[]'::jsonb` | — |
| 11 | **`calculated_at`** | `timestamp with time zone` | NO | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.68 `learner_topic_mastery` (BASE TABLE, 18 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('learner_topic_mastery_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | NO | — | — |
| 3 | **`subject_id`** | `integer` | YES | — | — |
| 4 | **`topic_id`** | `integer` | NO | — | — |
| 5 | **`total_attempts`** | `integer` | NO | `0` | — |
| 6 | **`correct_count`** | `integer` | NO | `0` | — |
| 7 | **`accuracy_pct`** | `numeric` | NO | `0.00` | — |
| 8 | **`avg_time_seconds`** | `numeric` | NO | `0.00` | — |
| 9 | **`speed_percentile`** | `numeric` | NO | `50.00` | — |
| 10 | **`historical_mastery`** | `numeric` | NO | `0.00` | — |
| 11 | **`effective_mastery`** | `numeric` | NO | `0.00` | — |
| 12 | **`retention_half_life_days`** | `integer` | NO | `14` | — |
| 13 | **`last_practiced_at`** | `timestamp with time zone` | NO | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 14 | **`careless_mistake_count`** | `integer` | NO | `0` | — |
| 15 | **`second_guessing_count`** | `integer` | NO | `0` | — |
| 16 | **`struggle_index`** | `numeric` | NO | `0.00` | — |
| 17 | **`learning_transfer_score`** | `numeric` | NO | `50.00` | — |
| 18 | **`updated_at`** | `timestamp with time zone` | NO | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.69 `live_tests` (BASE TABLE, 38 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('live_tests_id_seq'::regclass)` | — |
| 2 | **`test_id`** | `integer` | YES | — | — |
| 3 | **`start_time`** | `timestamp without time zone` | NO | — | — |
| 4 | **`end_time`** | `timestamp without time zone` | NO | — | — |
| 5 | **`result_time`** | `timestamp without time zone` | YES | — | — |
| 6 | **`is_active`** | `boolean` | YES | `true` | — |
| 7 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 8 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 9 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 10 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 11 | **`deleted_by`** | `integer` | YES | — | — |
| 12 | **`questions`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 13 | **`answers`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 14 | **`question_results`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 15 | **`solutions`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 16 | **`category_path_ids`** | `ARRAY` | YES | — | Array type: _text |
| 17 | **`category_path_names`** | `ARRAY` | YES | — | Array type: _text |
| 18 | **`name`** | `character varying` | YES | — | — |
| 19 | **`code`** | `character varying` | YES | — | — |
| 20 | **`description`** | `text` | YES | — | — |
| 21 | **`subject`** | `character varying` | YES | — | — |
| 22 | **`category`** | `character varying` | YES | — | — |
| 23 | **`instructions`** | `text` | YES | — | — |
| 24 | **`duration_minutes`** | `integer` | YES | — | — |
| 25 | **`total_questions`** | `integer` | YES | — | — |
| 26 | **`positive_marking`** | `numeric` | YES | — | — |
| 27 | **`negative_marking`** | `numeric` | YES | — | — |
| 28 | **`section_config`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 29 | **`status`** | `character varying` | YES | `'scheduled'::character varying` | — |
| 30 | **`is_archived`** | `boolean` | YES | `false` | — |
| 31 | **`is_recurring`** | `boolean` | YES | `false` | — |
| 32 | **`recur_freq`** | `character varying` | YES | — | — |
| 33 | **`recur_count`** | `integer` | YES | `0` | — |
| 34 | **`attempt_limit`** | `boolean` | YES | `true` | — |
| 35 | **`show_leaderboard`** | `boolean` | YES | `true` | — |
| 36 | **`show_explanation`** | `boolean` | YES | `true` | — |
| 37 | **`public_id`** | `uuid` | YES | `gen_random_uuid()` | — |
| 38 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |

### 4.70 `login_attempts` (BASE TABLE, 7 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('login_attempts_id_seq'::regclass)` | — |
| 2 | **`email`** | `character varying` | NO | — | — |
| 3 | **`ip_address`** | `inet` | NO | — | — |
| 4 | **`attempted_at`** | `timestamp without time zone` | YES | `now()` | — |
| 5 | **`successful`** | `boolean` | YES | `false` | — |
| 6 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 7 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.71 `media` (BASE TABLE, 17 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('media_id_seq'::regclass)` | — |
| 2 | **`filename`** | `character varying` | NO | — | — |
| 3 | **`original_name`** | `character varying` | YES | — | — |
| 4 | **`mime_type`** | `character varying` | YES | — | — |
| 5 | **`size`** | `bigint` | YES | — | — |
| 6 | **`url`** | `character varying` | NO | — | — |
| 7 | **`file_type`** | `character varying` | YES | — | — |
| 8 | **`uploaded_by`** | `integer` | YES | — | — |
| 9 | **`title`** | `character varying` | YES | — | — |
| 10 | **`description`** | `text` | YES | — | — |
| 11 | **`is_active`** | `boolean` | YES | `true` | — |
| 12 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 13 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 14 | **`public_id`** | `character varying` | YES | — | — |
| 15 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 16 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 17 | **`deleted_by`** | `integer` | YES | — | — |

### 4.72 `messages` (BASE TABLE, 9 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('messages_id_seq'::regclass)` | — |
| 2 | **`sender_id`** | `integer` | YES | — | — |
| 3 | **`receiver_id`** | `integer` | YES | — | — |
| 4 | **`content`** | `text` | YES | — | — |
| 5 | **`message_type`** | `character varying` | YES | `'text'::character varying` | — |
| 6 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 7 | **`is_read`** | `boolean` | YES | `false` | — |
| 8 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 9 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.73 `migration_progress` (BASE TABLE, 13 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`table_name`** | `text` | NO | — | — |
| 2 | **`last_processed_id`** | `bigint` | YES | `0` | — |
| 3 | **`total_records`** | `bigint` | YES | — | — |
| 4 | **`processed_records`** | `bigint` | YES | `0` | — |
| 5 | **`status`** | `text` | YES | `'pending'::text` | — |
| 6 | **`started_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 7 | **`completed_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 8 | **`error_message`** | `text` | YES | — | — |
| 9 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 10 | **`is_active`** | `boolean` | YES | `true` | — |
| 11 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 12 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 13 | **`deleted_by`** | `integer` | YES | — | — |

### 4.74 `navigation_config` (BASE TABLE, 20 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `character varying` | NO | — | — |
| 2 | **`label`** | `character varying` | NO | — | — |
| 3 | **`icon`** | `character varying` | YES | — | — |
| 4 | **`route`** | `character varying` | YES | — | — |
| 5 | **`order`** | `integer` | NO | `0` | — |
| 6 | **`category`** | `character varying` | YES | `'main'::character varying` | — |
| 7 | **`enabled`** | `boolean` | YES | `true` | — |
| 8 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 9 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 10 | **`parent_id`** | `character varying` | YES | — | — |
| 11 | **`description`** | `text` | YES | — | — |
| 12 | **`badge`** | `character varying` | YES | — | — |
| 13 | **`badge_color`** | `character varying` | YES | — | — |
| 14 | **`is_active`** | `boolean` | YES | `true` | — |
| 15 | **`display_order`** | `integer` | YES | `0` | — |
| 16 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 17 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 18 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 19 | **`deleted_by`** | `integer` | YES | — | — |
| 20 | **`deleted_reason`** | `text` | YES | — | — |

### 4.75 `nodes` (BASE TABLE, 12 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('nodes_id_seq'::regclass)` | — |
| 2 | **`title`** | `character varying` | NO | — | — |
| 3 | **`slug`** | `character varying` | YES | — | — |
| 4 | **`parent_id`** | `integer` | YES | — | — |
| 5 | **`node_type`** | `character varying` | YES | `'topic'::character varying` | — |
| 6 | **`exam_id`** | `integer` | YES | — | — |
| 7 | **`subject_id`** | `integer` | YES | — | — |
| 8 | **`display_order`** | `integer` | YES | `0` | — |
| 9 | **`is_active`** | `boolean` | YES | `true` | — |
| 10 | **`ai_meta`** | `jsonb` | YES | `'{"correct_rate": 0.0, "attempt_count": 0, "mastery_score": 0.0, "difficulty_score": 0.5, "recommendation_weight": 0.5}'::jsonb` | — |
| 11 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 12 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.76 `notification_preferences` (BASE TABLE, 9 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('notification_preferences_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | NO | — | — |
| 3 | **`email_notifications`** | `boolean` | YES | `true` | — |
| 4 | **`push_notifications`** | `boolean` | YES | `true` | — |
| 5 | **`sms_notifications`** | `boolean` | YES | `false` | — |
| 6 | **`marketing`** | `boolean` | YES | `false` | — |
| 7 | **`test_reminders`** | `boolean` | YES | `true` | — |
| 8 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 9 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.77 `notifications` (BASE TABLE, 28 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('notifications_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | YES | — | — |
| 3 | **`type`** | `character varying` | NO | — | — |
| 4 | **`title`** | `character varying` | NO | — | — |
| 5 | **`message`** | `text` | NO | — | — |
| 6 | **`data`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 7 | **`image`** | `character varying` | YES | `''::character varying` | — |
| 8 | **`action_url`** | `character varying` | YES | `''::character varying` | — |
| 9 | **`action_text`** | `character varying` | YES | `'View'::character varying` | — |
| 10 | **`is_read`** | `boolean` | YES | `false` | — |
| 11 | **`read_at`** | `timestamp without time zone` | YES | — | — |
| 12 | **`sent_via`** | `ARRAY` | YES | `'{}'::text[]` | Array type: _text |
| 13 | **`scheduled_at`** | `timestamp without time zone` | YES | — | — |
| 14 | **`is_sent`** | `boolean` | YES | `false` | — |
| 15 | **`sent_at`** | `timestamp without time zone` | YES | — | — |
| 16 | **`priority`** | `character varying` | YES | `'normal'::character varying` | — |
| 17 | **`expires_at`** | `timestamp without time zone` | YES | — | — |
| 18 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 19 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 20 | **`is_active`** | `boolean` | YES | `true` | — |
| 21 | **`public_id_uuid`** | `uuid` | NO | `gen_random_uuid()` | — |
| 22 | **`public_id`** | `text` | YES | — | — |
| 23 | **`channel`** | `character varying` | YES | `'in_app'::character varying` | — |
| 24 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 25 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 26 | **`deleted_by`** | `integer` | YES | — | — |
| 28 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 29 | **`deleted_reason`** | `text` | YES | — | — |

### 4.78 `outbox_events` (BASE TABLE, 9 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `uuid` | NO | `gen_random_uuid()` | — |
| 2 | **`event_type`** | `character varying` | NO | — | — |
| 3 | **`payload`** | `jsonb` | NO | — | — |
| 4 | **`status`** | `character varying` | YES | `'pending'::character varying` | — |
| 5 | **`retry_count`** | `integer` | YES | `0` | — |
| 6 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 7 | **`processed_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 8 | **`failed_reason`** | `text` | YES | — | — |
| 9 | **`event_version`** | `integer` | YES | `1` | — |

### 4.79 `page_content` (BASE TABLE, 14 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('page_content_id_seq'::regclass)` | — |
| 2 | **`page`** | `character varying` | NO | — | — |
| 3 | **`section`** | `character varying` | YES | — | — |
| 4 | **`title`** | `character varying` | YES | — | — |
| 5 | **`content`** | `text` | YES | — | — |
| 6 | **`metadata`** | `jsonb` | YES | — | — |
| 7 | **`is_active`** | `boolean` | YES | `true` | — |
| 8 | **`display_order`** | `integer` | YES | `0` | — |
| 9 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 10 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 11 | **`exam_id`** | `integer` | YES | — | — |
| 12 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 13 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 14 | **`deleted_by`** | `integer` | YES | — | — |

### 4.80 `passages` (BASE TABLE, 16 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('passages_id_seq'::regclass)` | — |
| 2 | **`title`** | `character varying` | YES | — | — |
| 3 | **`content`** | `text` | NO | — | — |
| 4 | **`subject_id`** | `integer` | YES | — | — |
| 5 | **`topic_id`** | `integer` | YES | — | — |
| 6 | **`chapter_id`** | `integer` | YES | — | — |
| 7 | **`difficulty`** | `character varying` | YES | `'medium'::character varying` | — |
| 8 | **`word_count`** | `integer` | YES | `0` | — |
| 9 | **`image_url`** | `text` | YES | — | — |
| 10 | **`is_active`** | `boolean` | YES | `true` | — |
| 11 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 12 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 13 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 14 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 15 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 16 | **`deleted_by`** | `integer` | YES | — | — |

### 4.81 `payments` (BASE TABLE, 11 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('payments_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | YES | — | — |
| 3 | **`amount`** | `numeric` | NO | `0` | — |
| 4 | **`currency`** | `character varying` | YES | `'INR'::character varying` | — |
| 5 | **`status`** | `character varying` | NO | `'pending'::character varying` | — |
| 6 | **`gateway`** | `character varying` | YES | — | — |
| 7 | **`gateway_payment_id`** | `character varying` | YES | — | — |
| 8 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 9 | **`refunded_at`** | `timestamp without time zone` | YES | — | — |
| 10 | **`refunded_by`** | `integer` | YES | — | — |
| 11 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |

### 4.82 `permissions` (BASE TABLE, 6 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('permissions_id_seq'::regclass)` | — |
| 2 | **`name`** | `character varying` | NO | — | — |
| 3 | **`resource`** | `character varying` | NO | — | — |
| 4 | **`action`** | `character varying` | NO | — | — |
| 5 | **`description`** | `text` | YES | — | — |
| 6 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.83 `platform_stats` (BASE TABLE, 11 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('platform_stats_id_seq'::regclass)` | — |
| 2 | **`label`** | `character varying` | NO | — | — |
| 3 | **`value`** | `character varying` | NO | — | — |
| 4 | **`icon`** | `character varying` | YES | — | — |
| 5 | **`is_active`** | `boolean` | YES | `true` | — |
| 6 | **`display_order`** | `integer` | YES | `0` | — |
| 7 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 8 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 9 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 10 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 11 | **`deleted_by`** | `integer` | YES | — | — |

### 4.84 `practice_ai_cache` (BASE TABLE, 5 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`question_id`** | `integer` | NO | — | — |
| 2 | **`feature`** | `character varying` | NO | — | — |
| 3 | **`content`** | `jsonb` | NO | — | — |
| 4 | **`model`** | `character varying` | YES | — | — |
| 5 | **`generated_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.85 `practice_answers` (BASE TABLE, 12 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('practice_answers_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | NO | — | — |
| 3 | **`session_id`** | `integer` | YES | — | — |
| 4 | **`question_id`** | `integer` | NO | — | — |
| 5 | **`selected_option`** | `integer` | YES | — | — |
| 6 | **`is_correct`** | `boolean` | YES | — | — |
| 7 | **`is_skipped`** | `boolean` | YES | `false` | Reconciled: added in practice pipeline update (138) |
| 8 | **`time_taken_sec`** | `integer` | YES | — | Reconciled: added in practice pipeline update (138) |
| 9 | **`mode`** | `character varying` | YES | — | Reconciled: added in practice pipeline update (138) |
| 10 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 11 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 12 | **`topic_id`** | `integer` | YES | — | — |

### 4.86 `practice_daily_sets` (BASE TABLE, 8 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('practice_daily_sets_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | NO | — | — |
| 3 | **`set_date`** | `date` | NO | — | — |
| 4 | **`questions`** | `jsonb` | NO | `'[]'::jsonb` | — |
| 5 | **`is_completed`** | `boolean` | YES | `false` | — |
| 6 | **`score`** | `integer` | YES | — | — |
| 7 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 8 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.87 `practice_sessions` (BASE TABLE, 23 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('practice_sessions_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | NO | — | — |
| 3 | **`exam_id`** | `character varying` | YES | — | — |
| 4 | **`subject_id`** | `integer` | YES | — | — |
| 5 | **`chapter_id`** | `integer` | YES | — | — |
| 6 | **`topic_id`** | `integer` | YES | — | — |
| 7 | **`mode`** | `character varying` | NO | — | — |
| 8 | **`difficulty`** | `character varying` | YES | — | — |
| 9 | **`target_count`** | `integer` | YES | — | — |
| 10 | **`time_limit_sec`** | `integer` | YES | — | — |
| 11 | **`questions_json`** | `jsonb` | NO | `'[]'::jsonb` | — |
| 12 | **`current_index`** | `integer` | YES | `0` | — |
| 13 | **`correct_count`** | `integer` | YES | `0` | — |
| 14 | **`wrong_count`** | `integer` | YES | `0` | — |
| 15 | **`skipped_count`** | `integer` | YES | `0` | — |
| 16 | **`started_at`** | `timestamp without time zone` | YES | `now()` | Note: Acts as created_at timestamp |
| 17 | **`last_active_at`** | `timestamp without time zone` | YES | — | — |
| 18 | **`completed_at`** | `timestamp without time zone` | YES | — | — |
| 19 | **`is_active`** | `boolean` | YES | `true` | — |
| 20 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 21 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 22 | **`deleted_by`** | `integer` | YES | — | — |
| 23 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.88 `practice_streaks` (BASE TABLE, 8 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`user_id`** | `integer` | NO | — | — |
| 2 | **`current_streak`** | `integer` | YES | `0` | — |
| 3 | **`longest_streak`** | `integer` | YES | `0` | — |
| 4 | **`last_practice_date`** | `date` | YES | — | — |
| 5 | **`total_sessions`** | `integer` | YES | `0` | — |
| 6 | **`total_questions`** | `integer` | YES | `0` | — |
| 7 | **`total_correct`** | `integer` | YES | `0` | — |
| 8 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.89 `pro_passes` (BASE TABLE, 11 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('pro_passes_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | YES | — | — |
| 3 | **`pass_type`** | `character varying` | YES | — | — |
| 4 | **`starts_at`** | `timestamp without time zone` | YES | — | — |
| 5 | **`expires_at`** | `timestamp without time zone` | YES | — | — |
| 6 | **`is_active`** | `boolean` | YES | `true` | — |
| 7 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 8 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 9 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 10 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 11 | **`deleted_by`** | `integer` | YES | — | — |

### 4.90 `promotions` (BASE TABLE, 32 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('promotions_id_seq'::regclass)` | — |
| 2 | **`title`** | `character varying` | NO | — | — |
| 3 | **`description`** | `text` | YES | `''::text` | — |
| 4 | **`code`** | `character varying` | YES | — | — |
| 5 | **`discount_type`** | `character varying` | NO | — | — |
| 6 | **`discount_value`** | `numeric` | NO | — | — |
| 7 | **`min_purchase`** | `numeric` | YES | `0` | — |
| 8 | **`max_discount`** | `numeric` | YES | — | — |
| 9 | **`usage_limit`** | `integer` | YES | — | — |
| 10 | **`usage_count`** | `integer` | YES | `0` | — |
| 11 | **`start_date`** | `timestamp without time zone` | YES | — | — |
| 12 | **`end_date`** | `timestamp without time zone` | YES | — | — |
| 13 | **`new_user_only`** | `boolean` | YES | `false` | — |
| 14 | **`one_per_user`** | `boolean` | YES | `true` | — |
| 15 | **`is_active`** | `boolean` | YES | `true` | — |
| 16 | **`created_by`** | `integer` | YES | — | — |
| 17 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 18 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 19 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 20 | **`banner_asset_id`** | `integer` | YES | — | — |
| 21 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 22 | **`deleted_by`** | `integer` | YES | — | — |
| 23 | **`type`** | `character varying` | YES | `'discount'::character varying` | — |
| 24 | **`discount_percent`** | `numeric` | YES | `0` | — |
| 25 | **`trial_days`** | `integer` | YES | `0` | — |
| 26 | **`credits`** | `integer` | YES | `0` | — |
| 27 | **`valid_from`** | `timestamp with time zone` | YES | — | — |
| 28 | **`valid_until`** | `timestamp with time zone` | YES | — | — |
| 29 | **`used_count`** | `integer` | YES | `0` | — |
| 30 | **`status`** | `character varying` | YES | `'active'::character varying` | — |
| 31 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 32 | **`deleted_reason`** | `text` | YES | — | — |

### 4.91 `prompt_templates` (BASE TABLE, 7 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('prompt_templates_id_seq'::regclass)` | — |
| 2 | **`name`** | `character varying` | NO | — | — |
| 3 | **`system_prompt`** | `text` | NO | — | — |
| 4 | **`user_prompt_template`** | `text` | NO | — | — |
| 5 | **`version`** | `integer` | YES | `1` | — |
| 6 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 7 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.92 `pyp_attempts` (BASE TABLE, 15 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('pyp_attempts_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | YES | — | — |
| 3 | **`pyp_id`** | `integer` | YES | — | — |
| 4 | **`answers`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 5 | **`score`** | `numeric` | YES | — | — |
| 6 | **`percentage`** | `numeric` | YES | — | — |
| 7 | **`correct_count`** | `integer` | YES | — | — |
| 8 | **`time_spent`** | `integer` | YES | — | — |
| 9 | **`question_results`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 10 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 11 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 12 | **`is_active`** | `boolean` | YES | `true` | — |
| 13 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 14 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 15 | **`deleted_by`** | `integer` | YES | — | — |

### 4.93 `pyp_papers` (BASE TABLE, 21 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('pyp_papers_id_seq'::regclass)` | — |
| 2 | **`exam_id`** | `character varying` | YES | — | — |
| 3 | **`year`** | `integer` | YES | — | — |
| 4 | **`shift`** | `character varying` | YES | — | — |
| 5 | **`title`** | `character varying` | NO | — | — |
| 6 | **`duration`** | `integer` | YES | — | — |
| 7 | **`total_marks`** | `integer` | YES | — | — |
| 8 | **`questions`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 9 | **`solutions`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 10 | **`difficulty`** | `character varying` | YES | — | — |
| 11 | **`is_active`** | `boolean` | YES | `true` | — |
| 12 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 13 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 14 | **`series_id`** | `integer` | YES | — | — |
| 15 | **`stage_id`** | `integer` | YES | — | — |
| 16 | **`category_id`** | `character varying` | YES | — | — |
| 17 | **`sub_category_id`** | `character varying` | YES | — | — |
| 18 | **`category_path_ids`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 19 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 20 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 21 | **`deleted_by`** | `integer` | YES | — | — |

### 4.94 `question_approaches` (BASE TABLE, 12 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('question_approaches_id_seq'::regclass)` | — |
| 2 | **`question_id`** | `integer` | NO | — | — |
| 3 | **`user_id`** | `integer` | NO | — | — |
| 4 | **`author_name`** | `character varying` | YES | — | — |
| 5 | **`approach_type`** | `character varying` | NO | — | — |
| 6 | **`title`** | `character varying` | YES | — | — |
| 7 | **`content`** | `text` | NO | — | — |
| 8 | **`time_complexity`** | `character varying` | YES | — | — |
| 9 | **`upvotes`** | `integer` | YES | `0` | — |
| 10 | **`is_approved`** | `boolean` | YES | `true` | — |
| 11 | **`is_community_best`** | `boolean` | YES | `false` | — |
| 12 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.95 `question_assets` (BASE TABLE, 7 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `bigint` | NO | `nextval('question_assets_id_seq'::regclass)` | — |
| 2 | **`question_id`** | `bigint` | YES | — | — |
| 3 | **`asset_type`** | `character varying` | NO | — | — |
| 4 | **`asset_url`** | `text` | NO | — | — |
| 5 | **`display_order`** | `integer` | YES | `1` | — |
| 6 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 7 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.96 `question_attempts` (BASE TABLE, 17 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('question_attempts_id_seq'::regclass)` | — |
| 2 | **`attempt_id`** | `integer` | NO | — | — |
| 3 | **`question_id`** | `integer` | NO | — | — |
| 4 | **`selected_option`** | `integer` | YES | — | — |
| 5 | **`is_marked_for_review`** | `boolean` | YES | `false` | — |
| 6 | **`time_spent_seconds`** | `integer` | YES | `0` | — |
| 7 | **`visits_count`** | `integer` | YES | `0` | — |
| 8 | **`last_viewed_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 9 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 10 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 11 | **`is_active`** | `boolean` | YES | `true` | — |
| 12 | **`question_version_id`** | `integer` | YES | — | — |
| 13 | **`order_index`** | `integer` | YES | — | — |
| 14 | **`status`** | `character varying` | YES | `'answered'::character varying` | — |
| 15 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 16 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 17 | **`deleted_by`** | `integer` | YES | — | — |

### 4.97 `question_bookmarks` (BASE TABLE, 3 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`user_id`** | `integer` | NO | — | — |
| 2 | **`question_id`** | `integer` | NO | — | — |
| 3 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.98 `question_explanations_v2` (BASE TABLE, 8 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('question_explanations_v2_id_seq'::regclass)` | — |
| 2 | **`question_id`** | `integer` | NO | — | — |
| 3 | **`explanation_text`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 4 | **`explanation_visual`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 5 | **`explanation_video`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 6 | **`explanation_formula`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 7 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 8 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.99 `question_learning_telemetry` (BASE TABLE, 12 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `bigint` | NO | `nextval('question_learning_telemetry_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | NO | — | — |
| 3 | **`question_id`** | `integer` | NO | — | — |
| 4 | **`session_id`** | `character varying` | YES | — | — |
| 5 | **`time_spent_ms`** | `integer` | YES | `0` | — |
| 6 | **`is_correct`** | `boolean` | YES | — | — |
| 7 | **`hint_requested`** | `integer` | YES | `0` | — |
| 8 | **`explanation_tabs_viewed`** | `ARRAY` | YES | `'{}'::text[]` | Array type: _text |
| 9 | **`video_watched_pct`** | `integer` | YES | `0` | — |
| 10 | **`discussion_viewed`** | `boolean` | YES | `false` | — |
| 11 | **`saved_to_vault`** | `boolean` | YES | `false` | — |
| 12 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.100 `question_patterns` (BASE TABLE, 12 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('question_patterns_id_seq'::regclass)` | — |
| 2 | **`name`** | `text` | NO | — | — |
| 3 | **`slug`** | `text` | NO | — | — |
| 4 | **`concept_id`** | `integer` | YES | — | — |
| 5 | **`stage_ids`** | `ARRAY` | YES | `'{}'::text[]` | Array type: _text |
| 6 | **`order_index`** | `integer` | YES | `0` | — |
| 7 | **`is_active`** | `boolean` | YES | `true` | — |
| 8 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 9 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 10 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 11 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 12 | **`deleted_by`** | `integer` | YES | — | — |

### 4.101 `question_reports` (BASE TABLE, 8 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('question_reports_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | YES | — | — |
| 3 | **`question_id`** | `integer` | YES | — | — |
| 4 | **`reason`** | `character varying` | YES | — | — |
| 5 | **`notes`** | `text` | YES | — | — |
| 6 | **`status`** | `character varying` | YES | `'open'::character varying` | — |
| 7 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 8 | **`exam_id`** | `integer` | YES | — | — |

### 4.102 `question_search_index` (BASE TABLE, 15 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `bigint` | NO | `nextval('question_search_index_id_seq'::regclass)` | — |
| 2 | **`question_id`** | `bigint` | YES | — | — |
| 3 | **`search_text`** | `text` | YES | — | — |
| 4 | **`keywords`** | `ARRAY` | YES | — | Array type: _text |
| 5 | **`difficulty`** | `character varying` | YES | — | — |
| 6 | **`topic_id`** | `integer` | YES | — | — |
| 7 | **`subtopic_id`** | `integer` | YES | — | — |
| 8 | **`subject`** | `character varying` | YES | — | — |
| 9 | **`question_type`** | `character varying` | YES | — | — |
| 10 | **`language`** | `character varying` | YES | `'en'::character varying` | — |
| 11 | **`embedding`** | `USER-DEFINED` | YES | — | pgvector: vector(1536) embedding |
| 12 | **`is_indexed`** | `boolean` | YES | `false` | — |
| 13 | **`last_indexed_at`** | `timestamp without time zone` | YES | — | — |
| 14 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 15 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.103 `question_tag_map` (BASE TABLE, 4 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('question_tag_map_id_seq'::regclass)` | — |
| 2 | **`question_id`** | `integer` | NO | — | — |
| 3 | **`tag_id`** | `integer` | NO | — | — |
| 4 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.104 `question_versions` (BASE TABLE, 20 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('question_versions_id_seq'::regclass)` | — |
| 2 | **`question_id`** | `integer` | NO | — | — |
| 3 | **`version_number`** | `integer` | NO | — | — |
| 4 | **`text`** | `text` | NO | — | — |
| 5 | **`options`** | `jsonb` | NO | — | — |
| 6 | **`correct_answer`** | `integer` | NO | — | — |
| 7 | **`explanation`** | `text` | YES | — | — |
| 8 | **`marks`** | `numeric` | YES | `1.00` | — |
| 9 | **`negative_marks`** | `numeric` | YES | `0.00` | — |
| 10 | **`difficulty`** | `character varying` | YES | `'medium'::character varying` | — |
| 11 | **`question_type`** | `character varying` | YES | `'single_correct'::character varying` | — |
| 12 | **`is_current`** | `boolean` | YES | `true` | — |
| 13 | **`snapshot_type`** | `character varying` | YES | `'admin_edit'::character varying` | — |
| 14 | **`change_summary`** | `text` | YES | — | — |
| 15 | **`changed_by`** | `integer` | YES | — | — |
| 16 | **`change_reason`** | `text` | YES | — | — |
| 17 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 18 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 19 | **`snapshot`** | `jsonb` | YES | — | — |
| 20 | **`edited_by`** | `integer` | YES | — | — |

### 4.105 `questions` (BASE TABLE, 71 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('questions_id_seq'::regclass)` | — |
| 2 | **`test_id`** | `integer` | YES | — | — |
| 3 | **`question_number`** | `integer` | NO | — | — |
| 4 | **`question_text`** | `text` | NO | — | — |
| 5 | **`question_text_hi`** | `text` | YES | — | — |
| 6 | **`options`** | `ARRAY` | NO | — | Array type: _text |
| 7 | **`options_hi`** | `ARRAY` | YES | — | Array type: _text |
| 8 | **`correct_option`** | `integer` | NO | — | — |
| 9 | **`marks`** | `numeric` | YES | `2.00` | — |
| 10 | **`negative_marks`** | `numeric` | YES | `0.5` | — |
| 12 | **`section`** | `character varying` | YES | `'General'::character varying` | — |
| 13 | **`explanation`** | `text` | YES | — | — |
| 14 | **`difficulty`** | `character varying` | YES | `'medium'::character varying` | — |
| 15 | **`image`** | `character varying` | YES | — | — |
| 16 | **`is_active`** | `boolean` | YES | `true` | — |
| 17 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 18 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 19 | **`subject`** | `integer` | YES | — | — |
| 20 | **`chapter_id`** | `integer` | YES | — | — |
| 21 | **`topic`** | `character varying` | YES | — | — |
| 22 | **`image_asset_id`** | `integer` | YES | — | — |
| 23 | **`series_id`** | `integer` | YES | — | — |
| 24 | **`category_id`** | `character varying` | YES | — | — |
| 25 | **`sub_category_id`** | `character varying` | YES | — | — |
| 26 | **`study_material_id`** | `integer` | YES | — | — |
| 27 | **`topic_id`** | `integer` | YES | — | — |
| 28 | **`quiz_id`** | `integer` | YES | — | — |
| 29 | **`public_id_uuid`** | `uuid` | NO | `gen_random_uuid()` | — |
| 30 | **`public_id`** | `text` | YES | — | — |
| 31 | **`category`** | `character varying` | YES | `'mock'::character varying` | — |
| 32 | **`type`** | `character varying` | YES | `'mcq'::character varying` | — |
| 33 | **`status`** | `character varying` | YES | `'draft'::character varying` | — |
| 34 | **`tags`** | `ARRAY` | YES | `'{}'::text[]` | Array type: _text |
| 35 | **`passage_id`** | `integer` | YES | — | — |
| 36 | **`chapter`** | `character varying` | YES | — | — |
| 37 | **`is_practice`** | `boolean` | YES | `false` | — |
| 38 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 39 | **`deleted_by`** | `integer` | YES | — | — |
| 40 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 41 | **`_orphaned`** | `boolean` | YES | `false` | — |
| 42 | **`orphaned_at`** | `timestamp without time zone` | YES | — | — |
| 44 | **`_deleted_test_id`** | `integer` | YES | — | — |
| 45 | **`moderation_status`** | `character varying` | YES | `'approved'::character varying` | — |
| 46 | **`reviewed_by`** | `integer` | YES | — | — |
| 47 | **`reviewed_at`** | `timestamp without time zone` | YES | — | — |
| 48 | **`review_notes`** | `text` | YES | — | — |
| 49 | **`submitted_for_review_at`** | `timestamp without time zone` | YES | — | — |
| 50 | **`submitted_by`** | `integer` | YES | — | — |
| 51 | **`external_question_id`** | `character varying` | YES | — | — |
| 52 | **`language`** | `character varying` | YES | `'en'::character varying` | — |
| 53 | **`solution_image_url`** | `text` | YES | — | — |
| 54 | **`source`** | `character varying` | YES | — | — |
| 55 | **`imported_from`** | `character varying` | YES | — | — |
| 56 | **`section_id`** | `integer` | YES | — | — |
| 57 | **`subtopic_id`** | `integer` | YES | — | — |
| 58 | **`subject_id`** | `integer` | YES | — | — |
| 59 | **`estimated_time`** | `integer` | YES | — | — |
| 60 | **`explanation_hi`** | `text` | YES | — | — |
| 61 | **`source_config`** | `jsonb` | YES | `'{"type": null, "year": null, "paper": null, "shift": null, "examId": null}'::jsonb` | — |
| 62 | **`exam_category_ids`** | `ARRAY` | YES | `'{}'::text[]` | Array type: _text |
| 63 | **`exam_ids`** | `ARRAY` | YES | `'{}'::text[]` | Array type: _text |
| 64 | **`question_stage_ids`** | `ARRAY` | YES | `'{}'::text[]` | Array type: _text |
| 65 | **`concept_ids`** | `ARRAY` | YES | `'{}'::text[]` | Array type: _text |
| 66 | **`skill_ids`** | `ARRAY` | YES | `'{}'::text[]` | Array type: _text |
| 67 | **`ai_generated`** | `boolean` | YES | `false` | — |
| 68 | **`_deleted_series_id`** | `integer` | YES | — | — |
| 69 | **`created_by`** | `integer` | YES | — | — |
| 70 | **`correct_answer`** | `integer` | YES | — | — |
| 71 | **`question_type`** | `character varying` | YES | `'single_correct'::character varying` | — |
| 72 | **`deleted_reason`** | `text` | YES | — | — |
| 73 | **`hint`** | `text` | YES | — | — |

### 4.106 `quick_access` (BASE TABLE, 12 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('quick_access_id_seq'::regclass)` | — |
| 2 | **`title`** | `character varying` | NO | — | — |
| 3 | **`description`** | `text` | YES | — | — |
| 4 | **`icon`** | `character varying` | YES | — | — |
| 5 | **`link`** | `character varying` | YES | — | — |
| 6 | **`is_active`** | `boolean` | YES | `true` | — |
| 7 | **`display_order`** | `integer` | YES | `0` | — |
| 8 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 9 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 10 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 11 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 12 | **`deleted_by`** | `integer` | YES | — | — |

### 4.107 `quizzes` (BASE TABLE, 35 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('quizzes_id_seq'::regclass)` | — |
| 2 | **`title`** | `character varying` | NO | — | — |
| 3 | **`description`** | `text` | YES | `''::text` | — |
| 4 | **`subject`** | `character varying` | YES | — | — |
| 5 | **`topic`** | `character varying` | YES | — | — |
| 6 | **`difficulty`** | `character varying` | YES | `'medium'::character varying` | — |
| 7 | **`question_ids`** | `ARRAY` | YES | `'{}'::integer[]` | Array type: _int4 |
| 8 | **`duration`** | `integer` | YES | `15` | — |
| 9 | **`passing_score`** | `integer` | YES | `60` | — |
| 10 | **`is_pro`** | `boolean` | YES | `false` | — |
| 11 | **`is_active`** | `boolean` | YES | `true` | — |
| 12 | **`order`** | `integer` | YES | `0` | — |
| 13 | **`instructions`** | `text` | YES | `''::text` | — |
| 14 | **`is_public`** | `boolean` | YES | `true` | — |
| 15 | **`shuffle_questions`** | `boolean` | YES | `true` | — |
| 16 | **`show_answers`** | `boolean` | YES | `true` | — |
| 17 | **`created_by`** | `integer` | YES | — | — |
| 18 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 19 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 20 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 21 | **`public_id_uuid`** | `uuid` | YES | `gen_random_uuid()` | — |
| 22 | **`public_id`** | `text` | YES | — | — |
| 23 | **`slug`** | `character varying` | YES | — | — |
| 24 | **`category`** | `character varying` | YES | — | — |
| 25 | **`total_questions`** | `integer` | YES | `0` | — |
| 26 | **`total_marks`** | `integer` | YES | `0` | — |
| 27 | **`status`** | `character varying` | YES | `'draft'::character varying` | — |
| 28 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 29 | **`question_count`** | `integer` | YES | `0` | — |
| 30 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 31 | **`deleted_by`** | `integer` | YES | — | — |
| 32 | **`negative_marking`** | `numeric` | YES | `0` | — |
| 33 | **`shuffle_options`** | `boolean` | YES | `false` | — |
| 34 | **`chapter`** | `character varying` | YES | — | — |
| 35 | **`tags`** | `ARRAY` | YES | `'{}'::text[]` | Array type: _text |

### 4.108 `referrals` (BASE TABLE, 26 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('referrals_id_seq'::regclass)` | — |
| 2 | **`referrer_id`** | `integer` | YES | — | — |
| 3 | **`referred_id`** | `integer` | YES | — | — |
| 4 | **`referral_code`** | `character varying` | YES | — | — |
| 5 | **`status`** | `character varying` | YES | `'pending'::character varying` | — |
| 6 | **`reward_amount`** | `numeric` | YES | `0` | — |
| 7 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 8 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 9 | **`referee_id`** | `integer` | YES | — | — |
| 10 | **`referee_email`** | `character varying` | YES | — | — |
| 11 | **`referee_phone`** | `character varying` | YES | — | — |
| 12 | **`reward_type`** | `character varying` | YES | `'credit'::character varying` | — |
| 13 | **`reward_value`** | `numeric` | YES | `0` | — |
| 14 | **`reward_granted`** | `boolean` | YES | `false` | — |
| 15 | **`reward_granted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 16 | **`signup_completed`** | `boolean` | YES | `false` | — |
| 17 | **`first_purchase_made`** | `boolean` | YES | `false` | — |
| 18 | **`first_purchase_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 19 | **`ip_address`** | `character varying` | YES | — | — |
| 20 | **`user_agent`** | `text` | YES | — | — |
| 21 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 22 | **`is_active`** | `boolean` | YES | `true` | — |
| 23 | **`reward_status`** | `character varying` | YES | `'pending'::character varying` | — |
| 24 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 25 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 26 | **`deleted_by`** | `integer` | YES | — | — |

### 4.109 `results` (BASE TABLE, 29 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('results_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | YES | — | — |
| 3 | **`test_id`** | `integer` | YES | — | — |
| 4 | **`series_id`** | `integer` | YES | — | — |
| 5 | **`attempt_number`** | `integer` | YES | `1` | — |
| 6 | **`answers`** | `jsonb` | YES | — | — |
| 7 | **`score`** | `numeric` | YES | `0` | — |
| 8 | **`total_marks`** | `numeric` | YES | `0` | — |
| 9 | **`correct_count`** | `integer` | YES | `0` | — |
| 10 | **`incorrect_count`** | `integer` | YES | `0` | — |
| 11 | **`skipped_count`** | `integer` | YES | `0` | — |
| 12 | **`time_spent`** | `integer` | YES | — | — |
| 13 | **`rank`** | `integer` | YES | — | — |
| 14 | **`percentile`** | `numeric` | YES | — | — |
| 15 | **`is_completed`** | `boolean` | YES | `false` | — |
| 16 | **`started_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 17 | **`submitted_at`** | `timestamp without time zone` | YES | — | — |
| 18 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 19 | **`is_active`** | `boolean` | YES | `true` | — |
| 20 | **`public_id_uuid`** | `uuid` | NO | `gen_random_uuid()` | — |
| 21 | **`public_id`** | `text` | YES | — | — |
| 22 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 23 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 24 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 25 | **`deleted_by`** | `integer` | YES | — | — |
| 26 | **`attempt_id`** | `integer` | YES | — | — |
| 27 | **`percentage`** | `numeric` | YES | — | — |
| 28 | **`time_taken`** | `integer` | YES | — | — |
| 29 | **`deleted_reason`** | `text` | YES | — | — |

### 4.110 `revision_queue` (BASE TABLE, 19 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('revision_queue_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | NO | — | — |
| 3 | **`question_id`** | `integer` | YES | — | — |
| 4 | **`source_attempt_id`** | `integer` | YES | — | — |
| 5 | **`schedule_day`** | `integer` | NO | — | — |
| 6 | **`due_at`** | `timestamp without time zone` | NO | — | — |
| 7 | **`status`** | `character varying` | YES | `'pending'::character varying` | — |
| 8 | **`completed_at`** | `timestamp without time zone` | YES | — | — |
| 9 | **`priority`** | `integer` | YES | `1` | Drift: integer (earlier migrations defined varchar/text) |
| 10 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 11 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 12 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 13 | **`public_id_uuid`** | `uuid` | NO | `gen_random_uuid()` | — |
| 14 | **`public_id`** | `text` | YES | — | — |
| 15 | **`is_active`** | `boolean` | YES | `true` | — |
| 16 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 17 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 18 | **`deleted_by`** | `integer` | YES | — | — |
| 19 | **`review_count`** | `integer` | YES | `0` | — |

### 4.111 `role_permissions` (BASE TABLE, 3 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`role_id`** | `integer` | NO | — | — |
| 2 | **`permission_id`** | `integer` | NO | — | — |
| 3 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.112 `roles` (BASE TABLE, 5 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('roles_id_seq'::regclass)` | — |
| 2 | **`name`** | `character varying` | NO | — | — |
| 3 | **`description`** | `text` | YES | — | — |
| 4 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 5 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.113 `schema_migrations` (BASE TABLE, 3 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('schema_migrations_id_seq'::regclass)` | — |
| 2 | **`migration_name`** | `character varying` | NO | — | — |
| 3 | **`applied_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.114 `schema_migrations_metadata` (BASE TABLE, 4 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`migration_name`** | `character varying` | NO | — | — |
| 2 | **`applied_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 3 | **`description`** | `text` | YES | — | — |
| 4 | **`blocks_audit_findings`** | `ARRAY` | YES | — | Array type: _text |

### 4.115 `section_aliases` (BASE TABLE, 7 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('section_aliases_id_seq'::regclass)` | — |
| 2 | **`canonical_name`** | `character varying` | NO | — | — |
| 3 | **`alias_name`** | `character varying` | NO | — | — |
| 4 | **`section_id`** | `integer` | YES | — | — |
| 5 | **`alias`** | `character varying` | YES | — | — |
| 6 | **`is_active`** | `boolean` | YES | `true` | — |
| 7 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.116 `stages` (BASE TABLE, 19 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('stages_id_seq'::regclass)` | — |
| 2 | **`name`** | `character varying` | NO | — | — |
| 3 | **`slug`** | `character varying` | NO | — | — |
| 4 | **`description`** | `text` | YES | — | — |
| 5 | **`icon`** | `character varying` | YES | — | — |
| 6 | **`order`** | `integer` | YES | `0` | — |
| 7 | **`is_active`** | `boolean` | YES | `true` | — |
| 8 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 9 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 10 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 11 | **`exam_ids`** | `ARRAY` | YES | `'{}'::integer[]` | Array type: _varchar |
| 12 | **`public_id_uuid`** | `uuid` | NO | `gen_random_uuid()` | — |
| 13 | **`public_id`** | `text` | YES | — | — |
| 14 | **`category_ids`** | `ARRAY` | YES | `'{}'::character varying[]` | Array type: _varchar |
| 15 | **`exam_id`** | `integer` | YES | — | — |
| 16 | **`display_order`** | `integer` | YES | `1` | — |
| 17 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 18 | **`deleted_by`** | `integer` | YES | — | — |
| 19 | **`deleted_reason`** | `text` | YES | — | — |

### 4.117 `study_group_members` (BASE TABLE, 13 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('study_group_members_id_seq'::regclass)` | — |
| 2 | **`group_id`** | `integer` | NO | — | — |
| 3 | **`user_id`** | `integer` | NO | — | — |
| 4 | **`user_name`** | `character varying` | YES | — | — |
| 5 | **`role`** | `character varying` | YES | `'member'::character varying` | — |
| 6 | **`is_active`** | `boolean` | YES | `true` | — |
| 7 | **`joined_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 8 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 9 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 10 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 11 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 12 | **`deleted_by`** | `integer` | YES | — | — |
| 13 | **`user_avatar`** | `character varying` | YES | — | — |

### 4.118 `study_group_messages` (BASE TABLE, 16 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('study_group_messages_id_seq'::regclass)` | — |
| 2 | **`group_id`** | `integer` | NO | — | — |
| 3 | **`user_id`** | `integer` | NO | — | — |
| 4 | **`user_name`** | `character varying` | YES | — | — |
| 5 | **`user_avatar`** | `character varying` | YES | — | — |
| 6 | **`content`** | `text` | NO | — | — |
| 7 | **`message_type`** | `character varying` | YES | `'text'::character varying` | — |
| 8 | **`reply_to_id`** | `integer` | YES | — | — |
| 9 | **`is_edited`** | `boolean` | YES | `false` | — |
| 10 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 11 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 12 | **`is_active`** | `boolean` | YES | `true` | — |
| 13 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 14 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 15 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 16 | **`deleted_by`** | `integer` | YES | — | — |

### 4.119 `study_groups` (BASE TABLE, 31 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('study_groups_id_seq'::regclass)` | — |
| 2 | **`name`** | `character varying` | NO | — | — |
| 3 | **`description`** | `text` | NO | — | — |
| 4 | **`category`** | `character varying` | YES | `'general'::character varying` | — |
| 5 | **`user_id`** | `integer` | NO | — | — |
| 6 | **`owner_name`** | `character varying` | YES | — | — |
| 7 | **`is_private`** | `boolean` | YES | `false` | — |
| 8 | **`max_members`** | `integer` | YES | `50` | — |
| 9 | **`member_count`** | `integer` | YES | `1` | — |
| 10 | **`is_active`** | `boolean` | YES | `true` | — |
| 11 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 12 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 13 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 14 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 15 | **`deleted_by`** | `integer` | YES | — | — |
| 16 | **`slug`** | `character varying` | YES | — | — |
| 17 | **`avatar`** | `character varying` | YES | — | — |
| 18 | **`cover_image`** | `character varying` | YES | — | — |
| 19 | **`exam_id`** | `integer` | YES | — | — |
| 20 | **`is_public`** | `boolean` | YES | `true` | — |
| 21 | **`join_approval`** | `boolean` | YES | `false` | — |
| 22 | **`post_count`** | `integer` | YES | `0` | — |
| 23 | **`owner_id`** | `integer` | YES | — | — |
| 24 | **`tags`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 25 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 26 | **`created_by`** | `integer` | YES | — | — |
| 27 | **`subject_id`** | `integer` | YES | — | — |
| 28 | **`invite_code`** | `character varying` | YES | — | — |
| 29 | **`status`** | `character varying` | YES | `'active'::character varying` | — |
| 30 | **`deleted_reason`** | `text` | YES | — | — |
| 31 | **`creator_id`** | `integer` | YES | — | — |

### 4.120 `study_material_stats` (VIEW, 8 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`study_material_id_int`** | `integer` | YES | — | — |
| 2 | **`slug`** | `character varying` | YES | — | — |
| 3 | **`title`** | `character varying` | YES | — | — |
| 4 | **`chapter_count`** | `bigint` | YES | — | — |
| 5 | **`video_count`** | `bigint` | YES | — | — |
| 6 | **`pdf_count`** | `bigint` | YES | — | — |
| 7 | **`topic_test_count`** | `bigint` | YES | — | — |
| 8 | **`direct_test_count`** | `bigint` | YES | — | — |

### 4.121 `study_materials` (BASE TABLE, 40 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('study_materials_id_seq'::regclass)` | — |
| 2 | **`slug`** | `character varying` | NO | — | — |
| 3 | **`title`** | `character varying` | NO | — | — |
| 4 | **`icon`** | `character varying` | YES | — | — |
| 5 | **`description`** | `text` | YES | — | — |
| 6 | **`topics`** | `integer` | YES | `0` | — |
| 7 | **`videos`** | `integer` | YES | `0` | — |
| 8 | **`pdf`** | `integer` | YES | `0` | — |
| 9 | **`tests`** | `integer` | YES | `0` | — |
| 10 | **`color`** | `character varying` | YES | — | — |
| 11 | **`bg`** | `character varying` | YES | — | — |
| 12 | **`is_active`** | `boolean` | YES | `true` | — |
| 13 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 14 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 15 | **`order`** | `integer` | YES | `0` | — |
| 16 | **`public_id_uuid`** | `uuid` | YES | `gen_random_uuid()` | — |
| 17 | **`public_id`** | `text` | YES | — | — |
| 18 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 19 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 20 | **`deleted_by`** | `integer` | YES | — | — |
| 21 | **`type`** | `character varying` | YES | `'video'::character varying` | — |
| 22 | **`url`** | `text` | YES | — | — |
| 23 | **`file_path`** | `text` | YES | — | — |
| 24 | **`file_size`** | `integer` | YES | — | — |
| 25 | **`mime_type`** | `character varying` | YES | — | — |
| 26 | **`thumbnail_url`** | `text` | YES | — | — |
| 27 | **`duration`** | `integer` | YES | — | — |
| 28 | **`subject_id`** | `integer` | YES | — | — |
| 29 | **`chapter_id`** | `integer` | YES | — | — |
| 30 | **`topic_id`** | `integer` | YES | — | — |
| 31 | **`is_pro`** | `boolean` | YES | `false` | — |
| 32 | **`display_order`** | `integer` | YES | `0` | — |
| 33 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 34 | **`_orphaned`** | `boolean` | YES | `false` | — |
| 35 | **`deleted_reason`** | `text` | YES | — | — |
| 36 | **`chapter_count`** | `integer` | YES | `0` | — |
| 37 | **`video_count`** | `integer` | YES | `0` | — |
| 38 | **`pdf_count`** | `integer` | YES | `0` | — |
| 39 | **`test_count`** | `integer` | YES | `0` | — |
| 40 | **`total_count`** | `integer` | YES | `0` | — |

### 4.122 `study_progress` (BASE TABLE, 10 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('study_progress_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | NO | — | — |
| 3 | **`series_id`** | `integer` | YES | — | — |
| 4 | **`material_id`** | `integer` | YES | — | — |
| 5 | **`is_active`** | `boolean` | YES | `true` | — |
| 6 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 7 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 8 | **`deleted_by`** | `integer` | YES | — | — |
| 9 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 10 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.123 `study_streaks` (BASE TABLE, 14 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('study_streaks_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | NO | — | — |
| 3 | **`current_streak`** | `integer` | YES | `0` | — |
| 4 | **`best_streak`** | `integer` | YES | `0` | — |
| 5 | **`total_active_days`** | `integer` | YES | `0` | — |
| 6 | **`last_active_date`** | `date` | YES | — | — |
| 7 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 8 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 9 | **`public_id_uuid`** | `uuid` | NO | `gen_random_uuid()` | — |
| 10 | **`public_id`** | `text` | YES | — | — |
| 11 | **`is_active`** | `boolean` | YES | `true` | — |
| 12 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 13 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 14 | **`deleted_by`** | `integer` | YES | — | — |

### 4.124 `subject_chapters` (BASE TABLE, 24 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('chapters_id_seq'::regclass)` | — |
| 2 | **`study_material_id`** | `integer` | YES | — | — |
| 3 | **`title`** | `character varying` | NO | — | — |
| 4 | **`slug`** | `character varying` | NO | — | — |
| 5 | **`description`** | `text` | YES | — | — |
| 6 | **`icon`** | `character varying` | YES | `'book-open'::character varying` | — |
| 7 | **`video_count`** | `integer` | YES | `0` | — |
| 8 | **`pdf_count`** | `integer` | YES | `0` | — |
| 9 | **`test_count`** | `integer` | YES | `0` | — |
| 10 | **`duration`** | `integer` | YES | `0` | — |
| 11 | **`order_index`** | `integer` | YES | `0` | — |
| 12 | **`is_active`** | `boolean` | YES | `true` | — |
| 13 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 14 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 15 | **`unit_id`** | `integer` | YES | — | — |
| 16 | **`stage_ids`** | `ARRAY` | YES | `'{}'::integer[]` | Array type: _int4 |
| 17 | **`public_id_uuid`** | `uuid` | NO | `gen_random_uuid()` | — |
| 18 | **`public_id`** | `text` | YES | — | — |
| 19 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 20 | **`deleted_by`** | `integer` | YES | — | — |
| 21 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 22 | **`subject_id`** | `integer` | YES | — | — |
| 23 | **`_orphaned`** | `boolean` | YES | `false` | — |
| 24 | **`deleted_reason`** | `text` | YES | — | — |

### 4.125 `subject_parts` (BASE TABLE, 14 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('subject_parts_id_seq'::regclass)` | — |
| 2 | **`name`** | `character varying` | NO | — | — |
| 3 | **`slug`** | `character varying` | YES | — | — |
| 4 | **`description`** | `text` | YES | — | — |
| 5 | **`icon`** | `character varying` | YES | — | — |
| 6 | **`subject_id`** | `integer` | YES | — | — |
| 7 | **`display_order`** | `integer` | YES | `0` | — |
| 8 | **`is_active`** | `boolean` | YES | `true` | — |
| 9 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 10 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 11 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 12 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 13 | **`deleted_by`** | `integer` | YES | — | — |
| 14 | **`deleted_reason`** | `text` | YES | — | — |

### 4.126 `subject_pdfs` (BASE TABLE, 21 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('subject_pdfs_id_seq'::regclass)` | — |
| 2 | **`study_material_id`** | `integer` | NO | — | — |
| 3 | **`chapter_id`** | `integer` | YES | — | — |
| 4 | **`title`** | `character varying` | NO | — | — |
| 5 | **`slug`** | `character varying` | NO | — | — |
| 6 | **`description`** | `text` | YES | — | — |
| 7 | **`pdf_url`** | `character varying` | NO | — | — |
| 8 | **`file_size`** | `integer` | YES | `0` | — |
| 9 | **`pages`** | `integer` | YES | `0` | — |
| 10 | **`order_index`** | `integer` | YES | `0` | — |
| 11 | **`is_pro`** | `boolean` | YES | `false` | — |
| 12 | **`is_active`** | `boolean` | YES | `true` | — |
| 13 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 14 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 15 | **`display_order`** | `integer` | YES | `0` | — |
| 16 | **`topic_id`** | `integer` | YES | — | — |
| 17 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 18 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 19 | **`deleted_by`** | `integer` | YES | — | — |
| 20 | **`thumbnail`** | `text` | YES | — | — |
| 21 | **`deleted_reason`** | `text` | YES | — | — |

### 4.127 `subject_relations` (BASE TABLE, 10 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('subject_relations_id_seq'::regclass)` | — |
| 2 | **`subject_id`** | `integer` | NO | — | — |
| 3 | **`related_subject_id`** | `integer` | NO | — | — |
| 4 | **`relation_type`** | `character varying` | NO | — | — |
| 5 | **`is_active`** | `boolean` | YES | `true` | — |
| 6 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 7 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 8 | **`deleted_by`** | `integer` | YES | — | — |
| 9 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 10 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.128 `subject_subtopics` (BASE TABLE, 18 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('subtopics_id_seq'::regclass)` | — |
| 2 | **`name`** | `character varying` | NO | — | — |
| 3 | **`slug`** | `character varying` | NO | — | — |
| 4 | **`topic_id`** | `integer` | YES | — | — |
| 5 | **`stage_ids`** | `ARRAY` | YES | `'{}'::integer[]` | Array type: _int4 |
| 6 | **`order_index`** | `integer` | YES | `0` | — |
| 7 | **`is_active`** | `boolean` | YES | `true` | — |
| 8 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 9 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 10 | **`public_id_uuid`** | `uuid` | NO | `gen_random_uuid()` | — |
| 11 | **`public_id`** | `text` | YES | — | — |
| 12 | **`description`** | `text` | YES | — | — |
| 13 | **`icon`** | `character varying` | YES | — | — |
| 14 | **`_orphaned`** | `boolean` | YES | `false` | — |
| 15 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 16 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 17 | **`deleted_by`** | `integer` | YES | — | — |
| 18 | **`deleted_reason`** | `text` | YES | — | — |

### 4.129 `subject_topics` (BASE TABLE, 27 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('topics_id_seq'::regclass)` | — |
| 2 | **`name`** | `character varying` | NO | — | — |
| 3 | **`slug`** | `character varying` | NO | — | — |
| 4 | **`subject`** | `character varying` | NO | — | — |
| 5 | **`parent_topic_id`** | `integer` | YES | — | — |
| 6 | **`description`** | `text` | YES | `''::text` | — |
| 7 | **`icon`** | `character varying` | YES | `'📚'::character varying` | — |
| 8 | **`estimated_questions`** | `integer` | YES | `0` | — |
| 9 | **`importance`** | `character varying` | YES | `'medium'::character varying` | — |
| 10 | **`frequently_asked`** | `boolean` | YES | `false` | — |
| 11 | **`difficulty`** | `character varying` | YES | `'Mixed'::character varying` | — |
| 12 | **`order_index`** | `integer` | YES | `0` | — |
| 13 | **`related_chapters`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 14 | **`is_active`** | `boolean` | YES | `true` | — |
| 15 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 16 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 17 | **`exam_ids`** | `ARRAY` | YES | `'{}'::text[]` | Array type: _text |
| 18 | **`chapter_id`** | `integer` | YES | — | — |
| 19 | **`stage_ids`** | `ARRAY` | YES | `'{}'::integer[]` | Array type: _int4 |
| 20 | **`public_id_uuid`** | `uuid` | NO | `gen_random_uuid()` | — |
| 21 | **`public_id`** | `text` | YES | — | — |
| 22 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 23 | **`deleted_by`** | `integer` | YES | — | — |
| 24 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 25 | **`subject_id`** | `integer` | YES | — | — |
| 26 | **`_orphaned`** | `boolean` | YES | `false` | — |
| 27 | **`deleted_reason`** | `text` | YES | — | — |

### 4.130 `subject_units` (BASE TABLE, 15 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('units_id_seq'::regclass)` | — |
| 2 | **`name`** | `character varying` | NO | — | — |
| 3 | **`slug`** | `character varying` | NO | — | — |
| 4 | **`subject_id`** | `integer` | YES | — | — |
| 5 | **`stage_ids`** | `ARRAY` | YES | `'{}'::integer[]` | Array type: _int4 |
| 6 | **`order_index`** | `integer` | YES | `0` | — |
| 7 | **`is_active`** | `boolean` | YES | `true` | — |
| 8 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 9 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 10 | **`description`** | `text` | YES | — | — |
| 11 | **`icon`** | `character varying` | YES | — | — |
| 12 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 13 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 14 | **`deleted_by`** | `integer` | YES | — | — |
| 16 | **`deleted_reason`** | `text` | YES | — | — |

### 4.131 `subject_videos` (BASE TABLE, 26 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('subject_videos_id_seq'::regclass)` | — |
| 2 | **`study_material_id`** | `integer` | NO | — | — |
| 3 | **`chapter_id`** | `integer` | YES | — | — |
| 4 | **`title`** | `character varying` | NO | — | — |
| 5 | **`slug`** | `character varying` | NO | — | — |
| 6 | **`description`** | `text` | YES | — | — |
| 7 | **`video_url`** | `character varying` | NO | — | — |
| 8 | **`thumbnail`** | `character varying` | YES | — | — |
| 9 | **`duration`** | `integer` | YES | `0` | — |
| 10 | **`order_index`** | `integer` | YES | `0` | — |
| 11 | **`is_pro`** | `boolean` | YES | `false` | — |
| 12 | **`is_active`** | `boolean` | YES | `true` | — |
| 13 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 14 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 15 | **`display_order`** | `integer` | YES | `0` | — |
| 16 | **`topic_id`** | `integer` | YES | — | — |
| 17 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 18 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 19 | **`deleted_by`** | `integer` | YES | — | — |
| 20 | **`public_id_uuid`** | `uuid` | YES | `gen_random_uuid()` | — |
| 21 | **`public_id`** | `text` | YES | — | — |
| 22 | **`deleted_reason`** | `text` | YES | — | — |
| 23 | **`fortspy_id`** | `text` | YES | — | DRM: FortSpy video encryption metadata (141) |
| 24 | **`fortspy_key`** | `text` | YES | — | DRM: FortSpy video encryption metadata (141) |
| 25 | **`is_encrypted`** | `boolean` | YES | `false` | — |
| 26 | **`encryption_type`** | `character varying` | YES | `'AES-256-CTR'::character varying` | — |

### 4.132 `subjects` (BASE TABLE, 23 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('subjects_id_seq'::regclass)` | — |
| 2 | **`name`** | `character varying` | NO | — | — |
| 3 | **`slug`** | `character varying` | NO | — | — |
| 4 | **`icon`** | `character varying` | YES | `'📚'::character varying` | — |
| 5 | **`color`** | `character varying` | YES | `'#667eea'::character varying` | — |
| 6 | **`description`** | `text` | YES | — | — |
| 7 | **`is_active`** | `boolean` | YES | `true` | — |
| 8 | **`sort_order`** | `integer` | YES | `0` | — |
| 9 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 10 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 11 | **`subject_group`** | `character varying` | YES | `NULL::character varying` | — |
| 12 | **`exam_ids`** | `ARRAY` | YES | `'{}'::text[]` | Array type: _text |
| 13 | **`stage_ids`** | `ARRAY` | YES | `'{}'::integer[]` | Array type: _int4 |
| 14 | **`public_id_uuid`** | `uuid` | NO | `gen_random_uuid()` | — |
| 15 | **`public_id`** | `text` | YES | — | — |
| 16 | **`parent_id`** | `integer` | YES | — | — |
| 17 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 18 | **`deleted_by`** | `integer` | YES | — | — |
| 19 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 20 | **`stage_id`** | `integer` | YES | — | — |
| 21 | **`_orphaned`** | `boolean` | YES | `false` | — |
| 22 | **`order`** | `integer` | YES | `0` | — |
| 23 | **`deleted_reason`** | `text` | YES | — | — |

### 4.133 `subscription_features` (BASE TABLE, 8 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('subscription_features_id_seq'::regclass)` | — |
| 2 | **`plan_type`** | `character varying` | NO | — | — |
| 3 | **`feature_key`** | `character varying` | NO | — | — |
| 4 | **`feature_name`** | `character varying` | NO | — | — |
| 5 | **`is_enabled`** | `boolean` | YES | `true` | — |
| 6 | **`limit_value`** | `integer` | YES | — | — |
| 7 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 8 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.134 `subscription_plans` (BASE TABLE, 19 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('subscription_plans_id_seq'::regclass)` | — |
| 2 | **`plan_id`** | `character varying` | NO | — | — |
| 3 | **`name`** | `character varying` | NO | — | — |
| 4 | **`price`** | `numeric` | NO | — | — |
| 5 | **`original_price`** | `numeric` | YES | `NULL::numeric` | — |
| 6 | **`period`** | `character varying` | NO | — | — |
| 7 | **`features`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 8 | **`button_text`** | `character varying` | YES | `'Get Started'::character varying` | — |
| 9 | **`button_class`** | `character varying` | YES | — | — |
| 10 | **`popular`** | `boolean` | YES | `false` | — |
| 11 | **`savings`** | `character varying` | YES | — | — |
| 12 | **`is_active`** | `boolean` | YES | `true` | — |
| 13 | **`sort_order`** | `integer` | YES | `0` | — |
| 14 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 15 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 16 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 17 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 18 | **`deleted_by`** | `integer` | YES | — | — |
| 19 | **`deleted_reason`** | `text` | YES | — | — |

### 4.135 `subscriptions` (BASE TABLE, 19 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('subscriptions_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | NO | — | — |
| 3 | **`plan_type`** | `character varying` | NO | — | — |
| 4 | **`start_date`** | `timestamp without time zone` | NO | `now()` | — |
| 5 | **`expiry_date`** | `timestamp without time zone` | NO | — | — |
| 6 | **`status`** | `character varying` | YES | `'active'::character varying` | — |
| 7 | **`auto_renew`** | `boolean` | YES | `false` | — |
| 8 | **`payment_method`** | `character varying` | YES | — | — |
| 9 | **`transaction_id`** | `character varying` | YES | — | — |
| 10 | **`amount_paid`** | `numeric` | YES | — | — |
| 11 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 12 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 13 | **`public_id_uuid`** | `uuid` | NO | `gen_random_uuid()` | — |
| 14 | **`public_id`** | `text` | YES | — | — |
| 15 | **`is_active`** | `boolean` | YES | `true` | — |
| 16 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 17 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 18 | **`deleted_by`** | `integer` | YES | — | — |
| 19 | **`deleted_reason`** | `text` | YES | — | — |

### 4.136 `tag_configs` (BASE TABLE, 17 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('tag_configs_id_seq'::regclass)` | — |
| 2 | **`slug`** | `character varying` | NO | — | — |
| 3 | **`title`** | `character varying` | NO | — | — |
| 4 | **`icon`** | `character varying` | YES | — | — |
| 5 | **`description`** | `text` | YES | — | — |
| 6 | **`filter_type`** | `character varying` | YES | — | — |
| 7 | **`filter_value`** | `character varying` | YES | — | — |
| 8 | **`color`** | `character varying` | YES | — | — |
| 9 | **`bg_color`** | `character varying` | YES | — | — |
| 10 | **`is_active`** | `boolean` | YES | `true` | — |
| 11 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 12 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 13 | **`exam_id`** | `integer` | YES | — | — |
| 14 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 15 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 16 | **`deleted_by`** | `integer` | YES | — | — |
| 17 | **`deleted_reason`** | `text` | YES | — | — |

### 4.137 `tags` (BASE TABLE, 11 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('tags_id_seq'::regclass)` | — |
| 2 | **`name`** | `character varying` | NO | — | — |
| 3 | **`slug`** | `character varying` | NO | — | — |
| 4 | **`category`** | `character varying` | YES | — | — |
| 5 | **`color`** | `character varying` | YES | `'gray'::character varying` | — |
| 6 | **`is_active`** | `boolean` | YES | `true` | — |
| 7 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 8 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 9 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 10 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 11 | **`deleted_by`** | `integer` | YES | — | — |

### 4.138 `test_attempts` (BASE TABLE, 14 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('test_attempts_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | YES | — | — |
| 3 | **`test_id`** | `integer` | YES | — | — |
| 4 | **`series_id`** | `integer` | YES | — | — |
| 5 | **`status`** | `character varying` | YES | `'in_progress'::character varying` | — |
| 6 | **`score`** | `numeric` | YES | — | — |
| 7 | **`total_marks`** | `numeric` | YES | — | — |
| 8 | **`time_taken`** | `integer` | YES | — | — |
| 9 | **`is_completed`** | `boolean` | YES | `false` | — |
| 10 | **`started_at`** | `timestamp without time zone` | YES | `now()` | — |
| 11 | **`completed_at`** | `timestamp without time zone` | YES | — | — |
| 12 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 13 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 14 | **`attempt_number`** | `integer` | YES | `1` | — |

### 4.139 `test_categories` (BASE TABLE, 20 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('test_categories_id_seq'::regclass)` | — |
| 2 | **`name`** | `character varying` | NO | — | — |
| 3 | **`slug`** | `character varying` | NO | — | — |
| 4 | **`description`** | `text` | YES | — | — |
| 5 | **`parent_id`** | `integer` | YES | — | — |
| 6 | **`level`** | `integer` | YES | `0` | — |
| 7 | **`order`** | `integer` | YES | `0` | — |
| 8 | **`is_active`** | `boolean` | YES | `true` | — |
| 9 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 10 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 11 | **`icon`** | `character varying` | YES | — | — |
| 12 | **`order_index`** | `integer` | YES | `0` | — |
| 15 | **`stage_ids`** | `ARRAY` | YES | `'{}'::integer[]` | Array type: _int4 |
| 16 | **`display_order`** | `integer` | YES | `0` | — |
| 17 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 18 | **`deleted_by`** | `integer` | YES | — | — |
| 19 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 20 | **`public_id_uuid`** | `uuid` | YES | `gen_random_uuid()` | — |
| 21 | **`public_id`** | `text` | YES | — | — |
| 23 | **`exam_category_id`** | `character varying` | YES | — | — |

### 4.140 `test_category_series` (BASE TABLE, 3 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`test_category_id`** | `integer` | NO | — | — |
| 2 | **`test_series_id`** | `integer` | NO | — | — |
| 3 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.141 `test_id_remap_backup` (BASE TABLE, 7 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`old_id`** | `integer` | NO | — | — |
| 2 | **`new_id`** | `integer` | YES | — | — |
| 3 | **`title`** | `text` | YES | — | — |
| 4 | **`series_id`** | `integer` | YES | — | — |
| 5 | **`series_title`** | `text` | YES | — | — |
| 6 | **`category`** | `text` | YES | — | — |
| 7 | **`reindexed_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.142 `test_questions` (BASE TABLE, 13 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `uuid` | NO | `uuid_generate_v4()` | — |
| 2 | **`test_id`** | `integer` | YES | — | — |
| 3 | **`question_id`** | `integer` | YES | — | — |
| 4 | **`order_index`** | `integer` | YES | — | — |
| 5 | **`marks`** | `numeric` | YES | `2` | — |
| 6 | **`negative_marks`** | `numeric` | YES | `0.5` | — |
| 7 | **`section_id`** | `integer` | YES | — | — |
| 8 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 9 | **`is_active`** | `boolean` | YES | `true` | — |
| 10 | **`question_number`** | `integer` | YES | — | — |
| 11 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 12 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 13 | **`deleted_by`** | `integer` | YES | — | — |

### 4.143 `test_sections` (BASE TABLE, 41 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('test_sections_id_seq'::regclass)` | — |
| 2 | **`name`** | `character varying` | NO | — | — |
| 3 | **`category_id`** | `integer` | YES | — | — |
| 4 | **`description`** | `text` | YES | — | — |
| 5 | **`duration`** | `integer` | YES | `60` | — |
| 6 | **`passing_marks`** | `integer` | YES | `0` | — |
| 7 | **`is_active`** | `boolean` | YES | `true` | — |
| 8 | **`display_order`** | `integer` | YES | `0` | — |
| 9 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 10 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 11 | **`test_id`** | `integer` | YES | — | — |
| 12 | **`marks_per_question`** | `numeric` | YES | `2` | — |
| 13 | **`negative_marks`** | `numeric` | YES | `0.5` | — |
| 14 | **`time_limit`** | `integer` | YES | `1800` | — |
| 15 | **`is_locked`** | `boolean` | YES | `false` | — |
| 16 | **`instructions`** | `text` | YES | — | — |
| 17 | **`difficulty`** | `character varying` | YES | `'medium'::character varying` | — |
| 18 | **`shuffle_questions`** | `boolean` | YES | `false` | — |
| 19 | **`shuffle_options`** | `boolean` | YES | `false` | — |
| 20 | **`expected_questions`** | `integer` | YES | `0` | — |
| 21 | **`total_marks`** | `numeric` | YES | `0` | — |
| 22 | **`exam_stage`** | `character varying` | YES | — | — |
| 23 | **`paper`** | `character varying` | YES | — | — |
| 24 | **`session`** | `character varying` | YES | — | — |
| 25 | **`section_code`** | `character varying` | YES | — | — |
| 26 | **`is_qualifying`** | `boolean` | YES | `false` | — |
| 27 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 28 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 29 | **`deleted_by`** | `integer` | YES | — | — |
| 30 | **`total_questions`** | `integer` | YES | — | — |
| 31 | **`subject_id`** | `integer` | YES | — | — |
| 32 | **`question_count`** | `integer` | YES | `0` | — |
| 33 | **`negative_marking`** | `numeric` | YES | `0` | — |
| 34 | **`mandatory`** | `boolean` | YES | `true` | — |
| 35 | **`optional`** | `boolean` | YES | `false` | — |
| 36 | **`qualifying`** | `boolean` | YES | `false` | — |
| 37 | **`allow_navigation`** | `boolean` | YES | `true` | — |
| 38 | **`test_series_id`** | `integer` | YES | — | — |
| 39 | **`stage_id`** | `integer` | YES | — | — |
| 40 | **`exam_alias`** | `character varying` | YES | — | — |
| 41 | **`deleted_reason`** | `text` | YES | — | — |

### 4.144 `test_series` (BASE TABLE, 48 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('test_series_id_seq'::regclass)` | — |
| 2 | **`slug`** | `character varying` | NO | — | — |
| 3 | **`title`** | `character varying` | NO | — | — |
| 4 | **`category`** | `character varying` | NO | — | — |
| 5 | **`subcategory`** | `character varying` | YES | — | — |
| 6 | **`description`** | `text` | YES | — | — |
| 7 | **`image`** | `character varying` | YES | — | — |
| 8 | **`thumbnail`** | `character varying` | YES | — | — |
| 9 | **`icon`** | `character varying` | YES | `'📝'::character varying` | — |
| 10 | **`total_tests`** | `integer` | YES | `0` | — |
| 11 | **`free_tests`** | `integer` | YES | `0` | — |
| 12 | **`active_users`** | `character varying` | YES | `'0'::character varying` | — |
| 13 | **`users_count`** | `character varying` | YES | `'0'::character varying` | — |
| 14 | **`rating`** | `numeric` | YES | `4.5` | — |
| 15 | **`tags`** | `ARRAY` | YES | `'{}'::text[]` | Array type: _text |
| 16 | **`test_types`** | `ARRAY` | YES | `'{}'::text[]` | Array type: _text |
| 17 | **`is_pro`** | `boolean` | YES | `false` | — |
| 18 | **`price`** | `numeric` | YES | `0` | — |
| 19 | **`difficulty`** | `character varying` | YES | `'Medium'::character varying` | — |
| 20 | **`is_active`** | `boolean` | YES | `true` | — |
| 21 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 22 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 23 | **`is_pinned`** | `boolean` | YES | `false` | — |
| 24 | **`sections`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 25 | **`languages`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 26 | **`colour_hex`** | `character varying` | YES | — | — |
| 27 | **`total_attempts`** | `integer` | YES | `0` | — |
| 28 | **`stages`** | `ARRAY` | YES | `'{}'::integer[]` | Array type: _int4 |
| 29 | **`public_id_uuid`** | `uuid` | NO | `gen_random_uuid()` | — |
| 30 | **`public_id`** | `text` | YES | — | — |
| 31 | **`is_coming_soon`** | `boolean` | YES | `false` | — |
| 32 | **`order`** | `integer` | YES | `0` | — |
| 33 | **`season_id`** | `integer` | YES | — | — |
| 34 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 35 | **`deleted_by`** | `integer` | YES | — | — |
| 36 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 37 | **`_orphaned_exam_category_id`** | `character varying` | YES | — | — |
| 38 | **`_orphaned_at`** | `timestamp without time zone` | YES | — | — |
| 40 | **`orphaned_at`** | `timestamp without time zone` | YES | — | — |
| 41 | **`exam_id`** | `integer` | YES | — | — |
| 42 | **`stage_id`** | `integer` | YES | — | — |
| 43 | **`_orphaned`** | `boolean` | YES | `false` | — |
| 44 | **`_deleted_test_id`** | `integer` | YES | — | — |
| 45 | **`exam_category_id`** | `integer` | YES | — | — |
| 46 | **`exam_id_fk`** | `integer` | YES | — | — |
| 47 | **`deleted_reason`** | `text` | YES | — | — |
| 48 | **`banner_asset_id`** | `integer` | YES | — | — |
| 49 | **`promotion_banner_asset_id`** | `integer` | YES | — | — |

### 4.145 `test_state_machine` (BASE TABLE, 9 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('test_state_machine_id_seq'::regclass)` | — |
| 2 | **`test_id`** | `integer` | NO | — | — |
| 3 | **`from_state`** | `character varying` | YES | — | — |
| 4 | **`to_state`** | `character varying` | NO | — | — |
| 5 | **`changed_by`** | `integer` | YES | — | — |
| 6 | **`reason`** | `text` | YES | — | — |
| 7 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 8 | **`transitioned_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 9 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.146 `test_templates` (BASE TABLE, 22 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('test_templates_id_seq'::regclass)` | — |
| 2 | **`public_id_uuid`** | `uuid` | YES | `gen_random_uuid()` | — |
| 3 | **`public_id`** | `text` | YES | — | — |
| 4 | **`name`** | `character varying` | NO | — | — |
| 5 | **`description`** | `text` | YES | — | — |
| 6 | **`exam_id`** | `character varying` | YES | — | — |
| 7 | **`stage_id`** | `integer` | YES | — | — |
| 8 | **`subject_id`** | `integer` | YES | — | — |
| 9 | **`config_json`** | `jsonb` | NO | `'{}'::jsonb` | — |
| 10 | **`total_questions`** | `integer` | YES | `0` | — |
| 11 | **`total_marks`** | `integer` | YES | `0` | — |
| 12 | **`duration`** | `integer` | YES | `60` | — |
| 13 | **`difficulty`** | `character varying` | YES | `'Medium'::character varying` | — |
| 14 | **`is_active`** | `boolean` | YES | `true` | — |
| 15 | **`is_system`** | `boolean` | YES | `false` | — |
| 16 | **`usage_count`** | `integer` | YES | `0` | — |
| 17 | **`created_by`** | `integer` | YES | — | — |
| 18 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 19 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 20 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 21 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 22 | **`deleted_by`** | `integer` | YES | — | — |

### 4.147 `testimonials` (BASE TABLE, 15 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('testimonials_id_seq'::regclass)` | — |
| 2 | **`name`** | `character varying` | NO | — | — |
| 3 | **`role`** | `character varying` | YES | — | — |
| 4 | **`avatar`** | `character varying` | YES | — | — |
| 5 | **`content`** | `text` | NO | — | — |
| 6 | **`rating`** | `integer` | YES | `5` | — |
| 7 | **`is_active`** | `boolean` | YES | `true` | — |
| 8 | **`display_order`** | `integer` | YES | `0` | — |
| 9 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 10 | **`user_id`** | `integer` | YES | — | — |
| 11 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 12 | **`public_id`** | `character varying` | YES | — | — |
| 13 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 14 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 15 | **`deleted_by`** | `integer` | YES | — | — |

### 4.148 `tests` (BASE TABLE, 92 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('tests_id_seq'::regclass)` | — |
| 2 | **`series_id`** | `integer` | YES | — | — |
| 3 | **`slug`** | `character varying` | NO | — | — |
| 4 | **`title`** | `character varying` | NO | — | — |
| 6 | **`category`** | `character varying` | NO | — | — |
| 7 | **`sub_category`** | `character varying` | YES | — | — |
| 8 | **`type`** | `character varying` | YES | `'Pro'::character varying` | — |
| 9 | **`total_questions`** | `integer` | YES | `0` | — |
| 10 | **`total_marks`** | `integer` | YES | `0` | — |
| 11 | **`duration`** | `integer` | NO | — | — |
| 12 | **`passing_marks`** | `integer` | YES | `0` | — |
| 13 | **`negative_marking`** | `numeric` | YES | `0.5` | — |
| 14 | **`tags`** | `ARRAY` | YES | `'{}'::text[]` | Array type: _text |
| 15 | **`is_live`** | `boolean` | YES | `false` | — |
| 16 | **`live_schedule`** | `timestamp without time zone` | YES | — | — |
| 17 | **`scheduled_at`** | `timestamp without time zone` | YES | — | — |
| 18 | **`difficulty`** | `character varying` | YES | `'Medium'::character varying` | — |
| 19 | **`is_active`** | `boolean` | YES | `true` | — |
| 20 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 21 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 22 | **`subject_id`** | `integer` | YES | — | — |
| 23 | **`is_pro`** | `boolean` | YES | `false` | — |
| 24 | **`stage_id`** | `integer` | YES | — | — |
| 25 | **`banner_asset_id`** | `integer` | YES | — | — |
| 26 | **`promotion_banner_asset_id`** | `integer` | YES | — | — |
| 27 | **`is_coming_soon`** | `boolean` | YES | `false` | — |
| 28 | **`public_id_uuid`** | `uuid` | NO | `gen_random_uuid()` | — |
| 29 | **`public_id`** | `text` | YES | — | — |
| 30 | **`category_path_ids`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 31 | **`category_path_names`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 32 | **`languages`** | `jsonb` | YES | `'[]'::jsonb` | — |
| 33 | **`coming_soon_date`** | `timestamp with time zone` | YES | — | — |
| 34 | **`test_category_id`** | `integer` | YES | — | — |
| 36 | **`stage_ids`** | `ARRAY` | YES | `'{}'::integer[]` | Array type: _int4 |
| 37 | **`section_id`** | `integer` | YES | — | — |
| 38 | **`status`** | `character varying` | YES | `'draft'::character varying` | — |
| 39 | **`year`** | `integer` | YES | — | — |
| 40 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 41 | **`deleted_by`** | `integer` | YES | — | — |
| 42 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 43 | **`_orphaned`** | `boolean` | YES | `false` | — |
| 44 | **`_deleted_series_id`** | `integer` | YES | — | — |
| 45 | **`orphaned_at`** | `timestamp without time zone` | YES | — | — |
| 47 | **`cutoff_marks`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 48 | **`published_at`** | `timestamp without time zone` | YES | — | — |
| 49 | **`live_at`** | `timestamp without time zone` | YES | — | — |
| 50 | **`expired_at`** | `timestamp without time zone` | YES | — | — |
| 51 | **`archived_at`** | `timestamp without time zone` | YES | — | — |
| 52 | **`state_updated_by`** | `integer` | YES | — | — |
| 53 | **`moderation_status`** | `character varying` | YES | `'approved'::character varying` | — |
| 54 | **`reviewed_by`** | `integer` | YES | — | — |
| 55 | **`reviewed_at`** | `timestamp without time zone` | YES | — | — |
| 56 | **`review_notes`** | `text` | YES | — | — |
| 57 | **`instructions`** | `text` | YES | — | — |
| 58 | **`test_type`** | `character varying` | YES | — | — |
| 59 | **`start_time`** | `timestamp without time zone` | YES | — | — |
| 60 | **`end_time`** | `timestamp without time zone` | YES | — | — |
| 61 | **`shuffle_questions`** | `boolean` | YES | `false` | — |
| 62 | **`shuffle_options`** | `boolean` | YES | `false` | — |
| 63 | **`allow_review`** | `boolean` | YES | `true` | — |
| 64 | **`max_attempts`** | `integer` | YES | `0` | — |
| 65 | **`version`** | `integer` | YES | `1` | — |
| 66 | **`attempt_count`** | `integer` | YES | `0` | — |
| 67 | **`imported_from`** | `character varying` | YES | — | — |
| 68 | **`source_test_id`** | `character varying` | YES | — | — |
| 69 | **`ai_explanation_enabled`** | `boolean` | YES | `true` | — |
| 70 | **`_deleted_test_id`** | `integer` | YES | — | — |
| 71 | **`short_title`** | `character varying` | YES | — | — |
| 72 | **`question_language_mode`** | `character varying` | YES | `'bilingual'::character varying` | — |
| 73 | **`is_pyq`** | `boolean` | YES | `false` | — |
| 74 | **`pyq_year`** | `integer` | YES | — | — |
| 75 | **`show_config`** | `jsonb` | YES | `'{"timer": true, "bookmark": true, "calculator": false, "reportIssue": true, "sectionPalette": true, "questionPalette": true}'::jsonb` | — |
| 76 | **`timing_config`** | `jsonb` | YES | `'{"mode": "overall", "autoSubmit": true, "navigationMode": "free", "sectionTimeShared": false, "autoMoveNextSection": false}'::jsonb` | — |
| 77 | **`optional_section_config`** | `jsonb` | YES | `'{"enabled": false, "maxSelectableSections": 0}'::jsonb` | — |
| 78 | **`attempt_rules`** | `jsonb` | YES | `'{"allowPause": false, "allowResume": true, "allowReattempt": true}'::jsonb` | — |
| 79 | **`analysis_config`** | `jsonb` | YES | `'{"enabled": true, "showRank": true, "showSolutions": true, "showPercentile": true, "showLeaderboard": true, "showTopicAnalysis": true, "showChapterAnalysis": true, "showSectionAnalysis": true, "showSubjectAnalysis": true, "showQuestionAnalysis": true, "showSubtopicAnalysis": true}'::jsonb` | — |
| 80 | **`access_config`** | `jsonb` | YES | `'{"type": "free", "batchIds": [], "subscriptionIds": [], "requiresPurchase": false}'::jsonb` | — |
| 81 | **`availability`** | `jsonb` | YES | `'{"availableFrom": null, "availableTill": null}'::jsonb` | — |
| 82 | **`is_featured`** | `boolean` | YES | `false` | — |
| 83 | **`seo`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 84 | **`exam_category_id`** | `integer` | YES | — | — |
| 85 | **`proctoring`** | `jsonb` | YES | `'{"enabled": false, "tabSwitchLimit": 0, "cameraMonitoring": false, "copyPasteDisabled": false}'::jsonb` | — |
| 86 | **`adaptive`** | `jsonb` | YES | `'{"enabled": false, "algorithm": null}'::jsonb` | — |
| 87 | **`features`** | `jsonb` | YES | `'{"certificate": false, "leaderboard": true}'::jsonb` | — |
| 88 | **`shift`** | `character varying` | YES | — | — |
| 89 | **`pdf_asset_id`** | `integer` | YES | — | — |
| 90 | **`content_source`** | `character varying` | YES | `'database'::character varying` | — |
| 91 | **`content_path`** | `character varying` | YES | `NULL::character varying` | — |
| 92 | **`exam_id`** | `integer` | YES | — | Migrated: integer (legacy varchar resolved in 086/097) |
| 93 | **`deleted_reason`** | `text` | YES | — | — |
| 94 | **`category_cutoffs`** | `jsonb` | YES | — | — |
| 95 | **`shuffle_seed`** | `character varying` | YES | `NULL::character varying` | — |

### 4.149 `topic_analytics` (BASE TABLE, 15 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('topic_analytics_id_seq'::regclass)` | — |
| 2 | **`date_bucket`** | `date` | NO | — | — |
| 3 | **`topic`** | `character varying` | NO | — | — |
| 4 | **`subject`** | `character varying` | YES | — | — |
| 5 | **`attempt_count`** | `integer` | YES | `0` | — |
| 6 | **`correct_count`** | `integer` | YES | `0` | — |
| 7 | **`wrong_count`** | `integer` | YES | `0` | — |
| 8 | **`unattempted_count`** | `integer` | YES | `0` | — |
| 9 | **`avg_accuracy`** | `numeric` | YES | `0` | — |
| 10 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 11 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 12 | **`is_active`** | `boolean` | YES | `true` | — |
| 13 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 14 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 15 | **`deleted_by`** | `integer` | YES | — | — |

### 4.150 `topic_resources` (BASE TABLE, 7 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `bigint` | NO | `nextval('topic_resources_id_seq'::regclass)` | — |
| 2 | **`topic_id`** | `integer` | YES | — | — |
| 3 | **`subtopic_id`** | `integer` | YES | — | — |
| 4 | **`resource_type`** | `character varying` | NO | — | — |
| 5 | **`resource_id`** | `character varying` | NO | — | — |
| 6 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 7 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.151 `topic_tests` (BASE TABLE, 15 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('topic_tests_id_seq'::regclass)` | — |
| 2 | **`study_material_id`** | `integer` | NO | — | — |
| 3 | **`chapter_id`** | `integer` | YES | — | — |
| 4 | **`test_id`** | `integer` | YES | — | — |
| 5 | **`test_type`** | `character varying` | YES | `'practice'::character varying` | — |
| 6 | **`order_index`** | `integer` | YES | `0` | — |
| 7 | **`is_active`** | `boolean` | YES | `true` | — |
| 8 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 9 | **`display_order`** | `integer` | YES | `0` | — |
| 10 | **`topic_id`** | `integer` | YES | — | — |
| 11 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 12 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 13 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 14 | **`deleted_by`** | `integer` | YES | — | — |
| 15 | **`deleted_reason`** | `text` | YES | — | — |

### 4.152 `transactions` (BASE TABLE, 10 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('transactions_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | YES | — | — |
| 3 | **`order_id`** | `character varying` | NO | — | — |
| 4 | **`payment_id`** | `character varying` | NO | — | — |
| 5 | **`amount`** | `numeric` | NO | — | — |
| 6 | **`currency`** | `character varying` | YES | `'INR'::character varying` | — |
| 7 | **`status`** | `character varying` | YES | `'completed'::character varying` | — |
| 8 | **`plan_id`** | `character varying` | YES | — | — |
| 9 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 10 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.153 `two_factor_secrets` (BASE TABLE, 5 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`user_id`** | `integer` | NO | — | — |
| 2 | **`secret`** | `text` | NO | — | — |
| 3 | **`backup_codes`** | `jsonb` | NO | `'[]'::jsonb` | — |
| 4 | **`enabled`** | `boolean` | NO | `false` | — |
| 5 | **`enrolled_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.154 `ui_tag_configs` (BASE TABLE, 18 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `character varying` | NO | — | — |
| 2 | **`label`** | `character varying` | NO | — | — |
| 3 | **`description`** | `text` | YES | — | — |
| 4 | **`icon`** | `character varying` | YES | — | — |
| 5 | **`color`** | `character varying` | YES | `'blue'::character varying` | — |
| 6 | **`route`** | `character varying` | YES | — | — |
| 7 | **`filterKey`** | `character varying` | YES | — | — |
| 8 | **`filterValue`** | `character varying` | YES | — | — |
| 9 | **`isActive`** | `boolean` | YES | `true` | — |
| 10 | **`createdAt`** | `timestamp without time zone` | YES | `now()` | — |
| 11 | **`updatedAt`** | `timestamp without time zone` | YES | `now()` | — |
| 12 | **`deletedAt`** | `timestamp without time zone` | YES | — | — |
| 13 | **`is_active`** | `boolean` | YES | `true` | — |
| 14 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 15 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 16 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 17 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 18 | **`deleted_by`** | `integer` | YES | — | — |

### 4.155 `user_achievements` (BASE TABLE, 15 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('user_achievements_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | NO | — | — |
| 3 | **`achievement_id`** | `integer` | NO | — | — |
| 4 | **`earned_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 5 | **`is_active`** | `boolean` | YES | `true` | — |
| 6 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 7 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 8 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 9 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 10 | **`deleted_by`** | `integer` | YES | — | — |
| 11 | **`achievement_code`** | `character varying` | YES | — | — |
| 12 | **`progress`** | `integer` | YES | `0` | — |
| 13 | **`progress_target`** | `integer` | YES | `100` | — |
| 14 | **`is_unlocked`** | `boolean` | YES | `false` | — |
| 15 | **`unlocked_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.156 `user_activity_events` (BASE TABLE, 11 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `bigint` | NO | `nextval('user_activity_events_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | NO | — | — |
| 3 | **`session_id`** | `character varying` | NO | — | — |
| 4 | **`event_type`** | `character varying` | NO | — | — |
| 5 | **`entity_type`** | `character varying` | NO | — | — |
| 6 | **`entity_id`** | `character varying` | YES | — | — |
| 7 | **`subject_id`** | `integer` | YES | — | — |
| 8 | **`topic_id`** | `integer` | YES | — | — |
| 9 | **`payload`** | `jsonb` | NO | `'{}'::jsonb` | — |
| 10 | **`client_timestamp`** | `timestamp with time zone` | NO | `now()` | — |
| 11 | **`created_at`** | `timestamp with time zone` | NO | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.157 `user_fundamental_mastery` (BASE TABLE, 8 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('user_fundamental_mastery_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | NO | — | — |
| 3 | **`category`** | `character varying` | NO | — | — |
| 4 | **`level`** | `integer` | YES | `1` | — |
| 5 | **`score`** | `integer` | YES | `0` | — |
| 6 | **`best_speed_ms`** | `integer` | YES | `0` | — |
| 7 | **`total_attempts`** | `integer` | YES | `0` | — |
| 8 | **`last_practiced_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.158 `user_history_archive` (BASE TABLE, 14 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('user_history_archive_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | NO | — | — |
| 3 | **`series_id`** | `integer` | YES | — | — |
| 4 | **`material_id`** | `integer` | YES | — | — |
| 5 | **`type`** | `character varying` | NO | — | — |
| 6 | **`original_id`** | `integer` | YES | — | — |
| 7 | **`data`** | `jsonb` | NO | — | — |
| 8 | **`archived_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 9 | **`is_active`** | `boolean` | YES | `true` | — |
| 10 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 11 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 12 | **`deleted_by`** | `integer` | YES | — | — |
| 13 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 14 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.159 `user_node_skill` (BASE TABLE, 10 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('user_node_skill_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | NO | — | — |
| 3 | **`node_id`** | `integer` | NO | — | — |
| 4 | **`mastery_score`** | `double precision` | YES | `0.0` | — |
| 5 | **`confidence_score`** | `double precision` | YES | `0.0` | — |
| 6 | **`attempt_count`** | `integer` | YES | `0` | — |
| 7 | **`correct_count`** | `integer` | YES | `0` | — |
| 8 | **`last_attempted_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 9 | **`created_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |
| 10 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.160 `user_recommendations` (BASE TABLE, 13 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('user_recommendations_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | NO | — | — |
| 3 | **`recommendation_type`** | `character varying` | NO | — | — |
| 4 | **`payload`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 5 | **`score`** | `numeric` | YES | `0` | — |
| 6 | **`generated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 7 | **`expires_at`** | `timestamp without time zone` | YES | — | — |
| 8 | **`is_active`** | `boolean` | YES | `true` | — |
| 9 | **`updated_at`** | `timestamp without time zone` | YES | `now()` | — |
| 10 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 11 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 12 | **`deleted_by`** | `integer` | YES | — | — |
| 13 | **`deleted_reason`** | `text` | YES | — | — |

### 4.161 `user_roles` (BASE TABLE, 3 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`user_id`** | `integer` | NO | — | — |
| 2 | **`role_id`** | `integer` | NO | — | — |
| 3 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |

### 4.162 `user_sessions` (BASE TABLE, 25 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `character varying` | NO | — | — |
| 2 | **`user_id`** | `integer` | NO | — | — |
| 3 | **`device_info`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 4 | **`ip_address`** | `character varying` | YES | `'unknown'::character varying` | — |
| 5 | **`user_agent`** | `text` | YES | `''::text` | — |
| 6 | **`created_at`** | `timestamp without time zone` | YES | `now()` | — |
| 7 | **`expires_at`** | `timestamp without time zone` | YES | — | — |
| 8 | **`last_active`** | `timestamp without time zone` | YES | `now()` | — |
| 9 | **`is_active`** | `boolean` | YES | `true` | — |
| 10 | **`session_id`** | `character varying` | YES | — | — |
| 11 | **`device_type`** | `character varying` | YES | `'desktop'::character varying` | — |
| 12 | **`browser`** | `character varying` | YES | `'unknown'::character varying` | — |
| 13 | **`os`** | `character varying` | YES | `'unknown'::character varying` | — |
| 14 | **`country`** | `character varying` | YES | — | — |
| 15 | **`country_code`** | `character varying` | YES | — | — |
| 16 | **`city`** | `character varying` | YES | — | — |
| 17 | **`region`** | `character varying` | YES | — | — |
| 18 | **`session_type`** | `character varying` | YES | `'web'::character varying` | — |
| 19 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 20 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 21 | **`deleted_by`** | `integer` | YES | — | — |
| 22 | **`refresh_token_hash`** | `character varying` | YES | — | — |
| 23 | **`prev_refresh_token_hash`** | `character varying` | YES | — | — |
| 24 | **`rotated_at`** | `timestamp without time zone` | YES | — | — |
| 25 | **`last_activity`** | `timestamp with time zone` | YES | `now()` | — |

### 4.163 `user_topic_stats` (BASE TABLE, 18 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('user_topic_stats_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | NO | — | — |
| 3 | **`topic`** | `character varying` | NO | — | — |
| 4 | **`subject`** | `character varying` | YES | — | — |
| 5 | **`total_attempts`** | `integer` | YES | `0` | — |
| 6 | **`correct_answers`** | `integer` | YES | `0` | — |
| 7 | **`wrong_answers`** | `integer` | YES | `0` | — |
| 8 | **`unattempted_answers`** | `integer` | YES | `0` | — |
| 9 | **`total_time_spent_seconds`** | `integer` | YES | `0` | — |
| 10 | **`accuracy`** | `numeric` | YES | `0` | — |
| 11 | **`last_attempted_at`** | `timestamp without time zone` | YES | — | — |
| 12 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 13 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 14 | **`is_active`** | `boolean` | YES | `true` | — |
| 15 | **`topic_id`** | `integer` | YES | — | — |
| 16 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 17 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 18 | **`deleted_by`** | `integer` | YES | — | — |

### 4.164 `users` (BASE TABLE, 45 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('users_id_seq'::regclass)` | — |
| 2 | **`name`** | `character varying` | NO | — | — |
| 3 | **`email`** | `character varying` | NO | — | — |
| 4 | **`password`** | `character varying` | NO | — | — |
| 5 | **`mobile`** | `character varying` | YES | — | Legacy column: code uses mobile; phone plaintext column absent |
| 6 | **`avatar`** | `character varying` | YES | — | — |
| 7 | **`role`** | `character varying` | YES | `'user'::character varying` | — |
| 8 | **`is_pro_user`** | `boolean` | YES | `false` | — |
| 9 | **`pro_pass_expiry`** | `timestamp without time zone` | YES | — | — |
| 10 | **`enrolled_series`** | `ARRAY` | YES | `'{}'::integer[]` | Array type: _int4 |
| 11 | **`attempted_tests`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 12 | **`is_active`** | `boolean` | YES | `true` | — |
| 13 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 14 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 15 | **`pro_expiry`** | `timestamp with time zone` | YES | — | — |
| 16 | **`pass_type`** | `character varying` | YES | `'free'::character varying` | — |
| 17 | **`public_id_uuid`** | `uuid` | NO | `gen_random_uuid()` | — |
| 18 | **`public_id`** | `text` | YES | — | — |
| 19 | **`date_of_birth`** | `date` | YES | — | — |
| 20 | **`location`** | `character varying` | YES | — | — |
| 21 | **`education`** | `character varying` | YES | — | — |
| 22 | **`bio`** | `character varying` | YES | — | — |
| 23 | **`notification_preferences`** | `jsonb` | YES | — | — |
| 25 | **`exam_sub_category_id`** | `ARRAY` | YES | `'{}'::integer[]` | Array type: _int4 |
| 26 | **`enrolled_study_materials`** | `ARRAY` | YES | `'{}'::integer[]` | Array type: _int4 |
| 27 | **`enrolled_exams`** | `ARRAY` | YES | `'{}'::integer[]` | Array type: _int4 |
| 28 | **`banner`** | `text` | YES | — | — |
| 29 | **`privacy`** | `jsonb` | YES | `'{"showProgress": true, "allowMessages": true, "profileVisibility": "public", "showOnLeaderboard": true}'::jsonb` | — |
| 30 | **`exam_preferences`** | `jsonb` | YES | — | — |
| 31 | **`session_limit`** | `integer` | YES | — | — |
| 32 | **`refresh_token_version`** | `integer` | YES | `0` | — |
| 33 | **`reset_password_token`** | `text` | YES | — | — |
| 34 | **`reset_password_expires`** | `timestamp without time zone` | YES | — | — |
| 35 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 36 | **`deleted_by`** | `integer` | YES | — | — |
| 37 | **`full_name`** | `character varying` | YES | — | — |
| 38 | **`session_state`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 39 | **`is_email_verified`** | `boolean` | NO | `true` | — |
| 40 | **`deleted_at`** | `timestamp without time zone` | YES | — | — |
| 41 | **`phone_enc`** | `text` | YES | — | Security: AES-256-GCM shadow encrypted column (088) |
| 42 | **`dob_enc`** | `text` | YES | — | Security: AES-256-GCM shadow encrypted column (088) |
| 43 | **`location_enc`** | `text` | YES | — | — |
| 44 | **`education_enc`** | `text` | YES | — | — |
| 45 | **`bio_enc`** | `text` | YES | — | — |
| 46 | **`category`** | `character varying` | YES | `'UR'::character varying` | — |

### 4.165 `v_group_messages` (VIEW, 14 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | YES | — | — |
| 2 | **`group_id`** | `integer` | YES | — | — |
| 3 | **`user_id`** | `integer` | YES | — | — |
| 4 | **`user_name`** | `character varying` | YES | — | — |
| 5 | **`user_avatar`** | `character varying` | YES | — | — |
| 6 | **`content`** | `text` | YES | — | — |
| 7 | **`message_type`** | `character varying` | YES | — | — |
| 8 | **`reply_to_id`** | `integer` | YES | — | — |
| 9 | **`is_edited`** | `boolean` | YES | — | — |
| 10 | **`is_deleted`** | `boolean` | YES | — | — |
| 11 | **`metadata`** | `jsonb` | YES | — | — |
| 12 | **`is_active`** | `boolean` | YES | — | — |
| 13 | **`created_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 14 | **`updated_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.166 `video_progress` (BASE TABLE, 7 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('video_progress_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | NO | — | — |
| 3 | **`video_id`** | `character varying` | NO | — | — |
| 4 | **`last_timestamp`** | `numeric` | YES | `0` | — |
| 5 | **`total_time_spent`** | `numeric` | YES | `0` | — |
| 6 | **`completed`** | `boolean` | YES | `false` | — |
| 7 | **`updated_at`** | `timestamp with time zone` | YES | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.167 `webhook_events` (BASE TABLE, 11 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('webhook_events_id_seq'::regclass)` | — |
| 2 | **`gateway`** | `character varying` | NO | `'razorpay'::character varying` | — |
| 3 | **`event`** | `character varying` | NO | — | — |
| 4 | **`gateway_payment_id`** | `character varying` | YES | — | — |
| 5 | **`order_id`** | `character varying` | YES | — | — |
| 6 | **`status`** | `character varying` | NO | `'received'::character varying` | — |
| 7 | **`payload`** | `jsonb` | NO | `'{}'::jsonb` | — |
| 8 | **`headers`** | `jsonb` | NO | `'{}'::jsonb` | — |
| 9 | **`signature_valid`** | `boolean` | NO | `true` | — |
| 10 | **`error`** | `text` | YES | — | — |
| 11 | **`created_at`** | `timestamp with time zone` | NO | `now()` | Info: timestamptz (differs from standard timestamp without time zone) |

### 4.168 `wrong_questions` (BASE TABLE, 16 columns)

| # | Column | Data Type | Nullable | Default | Known Drift / Warning |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`id`** | `integer` | NO | `nextval('wrong_questions_id_seq'::regclass)` | — |
| 2 | **`user_id`** | `integer` | NO | — | — |
| 3 | **`test_id`** | `integer` | YES | — | — |
| 4 | **`question_id`** | `integer` | YES | — | — |
| 5 | **`source_attempt_id`** | `integer` | YES | — | — |
| 6 | **`wrong_count`** | `integer` | YES | `1` | — |
| 7 | **`last_seen_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 8 | **`metadata`** | `jsonb` | YES | `'{}'::jsonb` | — |
| 9 | **`is_active`** | `boolean` | YES | `true` | — |
| 10 | **`created_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 11 | **`updated_at`** | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` | — |
| 12 | **`public_id_uuid`** | `uuid` | NO | `gen_random_uuid()` | — |
| 13 | **`public_id`** | `text` | YES | — | — |
| 14 | **`is_deleted`** | `boolean` | YES | `false` | — |
| 15 | **`deleted_at`** | `timestamp with time zone` | YES | — | Info: timestamptz (differs from standard timestamp without time zone) |
| 16 | **`deleted_by`** | `integer` | YES | — | — |

