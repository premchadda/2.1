# Trstprep V2.1 — Comprehensive Database Schema Audit

**Audit Date:** 2026-08-23  
**Database:** PostgreSQL (Supabase) — live read Aug 23, 2026  
**Migrations on disk:** 000–112 (112 SQL files + 7 legacy in `docs/legacy-migrations/`) — was 000–093 (94) in Jul 2026 audit
**Estimated tables:** ~80 active (allowlist) / 154 live incl. legacy (`pg_stat_user_tables` per `FINAL_SITE_READINESS_REPORT.md`)  

---

## 1. MIGRATION FILE INVENTORY

### Active migrations (apps/backend/src/infrastructure/database/migrations/)
| Range | Count | Purpose |
|-------|-------|---------|
| 000 | 1 | Baseline functions, extensions, triggers |
| 001–002 | 2 | Admin features, audit_logs extension |
| 003–017 | 15 | **Reconstructed** in 098_reconstructed_baseline.sql |
| 018–029 | 12 | Core tables, hierarchy, content moderation |
| 030–037 | 8 | Missing tables, soft delete, JSONB indexes, CHECK constraints |
| 038–041 | 4 | Audit fixes, schema consolidation, discussions |
| 042–059 | 18 | Live tests, exam rooms, RLS, consolidation, imports |
| 060–068 | 9 | Missing tables, initTables, PYP hierarchy, schema consolidation |
| 069–075 | 7 | Schema audit fixes, FKs/indexes, critical fixes, AI tables |
| 076–093 | 18 | Embeddings, assets, subject videos, performance indexes, HNSW |
| 094–101 | 8 | Certificates, missing tables, soft-delete, exam_id type fix, RLS, duplicate reconciliation, achievement consolidation |
| 102–112 | 11 | Recent fixes (102+ adds per-file audit, 112 latest — verify `ls migrations/ | sort`) |

### Legacy migrations (docs/legacy-migrations/)
| File | Purpose |
|------|---------|
| schema-enhancement-migration.sql | FK indexes, missing NOT NULL |
| p0-rbac-and-analytics-migration.sql | Permissions, roles, audit_logs |
| p2-navigation-coming-soon-migration.sql | navigation_config, coming_soon_features |
| analytics-tables-migration.sql | user_topic_stats, topic_analytics, wrong_questions |
| 005_create_user_sessions.sql | user_sessions |
| 007_create_test_sections.sql | test_sections |
| 008-standardize-ids-and-fix-relations.sql | UUID→INTEGER, junction tables, missing FKs |
| 009-full-schema-audit.sql | Audit queries (no DDL) |
| 010-section-series-stage-linking.sql | Section-series links |
| cleanup-migration.sql | Cleanup |
| maintenance-scripts.sql | Maintenance |

---

## 2. COMPLETE TABLE INVENTORY

### A. User & Auth (4 tables)

#### `users`
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| name | VARCHAR(255) | NOT NULL |
| full_name | VARCHAR(200) | — |
| password | VARCHAR(255) | — |
| role | VARCHAR(50) | DEFAULT 'user' |
| is_verified | BOOLEAN | DEFAULT false |
| is_active | BOOLEAN | DEFAULT true |
| phone | VARCHAR(20) | ENCRYPTED |
| public_id | VARCHAR(50) | UNIQUE |
| public_id_uuid | UUID | DEFAULT gen_random_uuid() |
| attempted_tests | INTEGER[] | — |
| session_state | JSONB | DEFAULT '{}' |
| refresh_token | TEXT | — |
| refresh_token_version | INTEGER | — |
|otp | VARCHAR | — |
| reset_token | VARCHAR | — |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |

#### `user_sessions`
| Column | Type | Constraints |
|--------|------|-------------|
| id | VARCHAR(255) | PK |
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| session_id | VARCHAR(255) | UNIQUE NOT NULL |
| ip_address | VARCHAR(45) | — |
| user_agent | TEXT | — |
| device_type | VARCHAR(50) | — |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMP | DEFAULT NOW() |
| last_active | TIMESTAMP | DEFAULT NOW() |

#### `login_attempts`
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| email | VARCHAR(255) | NOT NULL |
| ip_address | VARCHAR(100) | NOT NULL |
| attempted_at | TIMESTAMP | DEFAULT NOW() |
| successful | BOOLEAN | DEFAULT false |

#### `two_factor_secrets`
| Column | Type | Constraints |
|--------|------|-------------|
| (defined in migration 064) | | |

#### `csrf_tokens`
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| csrf_token | TEXT | UNIQUE NOT NULL |
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| expires_at | TIMESTAMP | NOT NULL |
| created_at | TIMESTAMP | DEFAULT NOW() |

### B. RBAC (4 tables)

#### `roles`
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| name | VARCHAR(50) | UNIQUE NOT NULL |
| description | TEXT | — |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |

#### `permissions`
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| name | VARCHAR(100) | UNIQUE NOT NULL |
| resource | VARCHAR(50) | NOT NULL |
| action | VARCHAR(50) | NOT NULL |
| description | TEXT | — |
| UNIQUE(resource, action) | | |

#### `user_roles`
| Column | Type | Constraints |
|--------|------|-------------|
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE, PK |
| role_id | INTEGER | FK→roles(id) ON DELETE CASCADE, PK |
| created_at | TIMESTAMP | DEFAULT NOW() |

#### `role_permissions`
| Column | Type | Constraints |
|--------|------|-------------|
| role_id | INTEGER | FK→roles(id) ON DELETE CASCADE, PK |
| permission_id | INTEGER | FK→permissions(id) ON DELETE CASCADE, PK |
| created_at | TIMESTAMP | DEFAULT NOW() |

### C. Exams & Hierarchy (7 tables)

#### `exams`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL/VARCHAR | PK (type varies by migration) |
| exam_id | VARCHAR(255) | External ID |
| name | VARCHAR(255) | NOT NULL |
| slug | VARCHAR(255) | UNIQUE |
| description | TEXT | — |
| is_active | BOOLEAN | DEFAULT true |
| _orphaned | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMP | DEFAULT NOW() |

#### `exam_categories`
| Column | Type | Notes |
|--------|------|-------|
| category_id | VARCHAR(255)/SERIAL | PK |
| name | VARCHAR(255) | NOT NULL |
| slug | VARCHAR(255) | UNIQUE |
| is_active | BOOLEAN | DEFAULT true |

#### `stages`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| name | VARCHAR(255) | NOT NULL |
| exam_id | INTEGER | FK→exams(id) ON DELETE SET NULL |
| display_order | INTEGER | DEFAULT 1 |
| is_active | BOOLEAN | DEFAULT true |

#### `subjects`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| name | VARCHAR(255) | NOT NULL |
| stage_id | INTEGER | FK→stages(id) ON DELETE SET NULL |
| parent_id | INTEGER | FK→subjects(id) ON DELETE CASCADE |
| slug | VARCHAR(255) | — |
| is_active | BOOLEAN | DEFAULT true |
| _orphaned | BOOLEAN | DEFAULT false |

#### `chapters` (subject_chapters)
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| name | VARCHAR(255) | NOT NULL |
| unit_id | INTEGER | FK→units(id) ON DELETE SET NULL |
| study_material_id | INTEGER | FK→study_materials(id) |
| is_active | BOOLEAN | DEFAULT true |
| _orphaned | BOOLEAN | DEFAULT false |

#### `topics` (subject_topics)
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| name | VARCHAR(255) | NOT NULL |
| chapter_id | INTEGER | FK→chapters(id) ON DELETE SET NULL |
| subject_id | INTEGER | FK→subjects(id) ON DELETE SET NULL |
| slug | VARCHAR(255) | — |
| is_active | BOOLEAN | DEFAULT true |
| _orphaned | BOOLEAN | DEFAULT false |

#### `subtopics` (subject_subtopics)
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| name | VARCHAR(255) | NOT NULL |
| topic_id | INTEGER | FK→topics(id) ON DELETE CASCADE |
| is_active | BOOLEAN | DEFAULT true |
| _orphaned | BOOLEAN | DEFAULT false |

#### `exam_seasons`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| exam_id | VARCHAR(100) | FK→exams(id) ON DELETE CASCADE |
| exam_internal_id | INTEGER | FK→exams(id) ON DELETE SET NULL |
| season_name | VARCHAR(255) | NOT NULL |
| year | INTEGER | NOT NULL |
| start_date | DATE | — |
| exam_date | DATE | — |
| is_active | BOOLEAN | DEFAULT true |

#### `exam_yearly_data`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| exam_id | VARCHAR(255) | — |
| year | INTEGER | — |
| data | JSONB | DEFAULT '{}' |

#### `exam_updates`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| exam_id | VARCHAR(255) | — |
| title | VARCHAR(255) | — |
| content | TEXT | — |
| is_active | BOOLEAN | DEFAULT true |

### D. Tests & Questions (8 tables)

#### `tests`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| title | VARCHAR(255) | NOT NULL |
| slug | VARCHAR(255) | UNIQUE |
| description | TEXT | — |
| duration | INTEGER | DEFAULT 60 |
| total_questions | INTEGER | DEFAULT 0 |
| total_marks | NUMERIC | DEFAULT 0 |
| negative_marking | NUMERIC | DEFAULT 0.25 |
| difficulty | VARCHAR(20) | DEFAULT 'medium' |
| is_pro | BOOLEAN | DEFAULT true |
| is_active | BOOLEAN | DEFAULT true |
| is_live | BOOLEAN | DEFAULT false |
| status | VARCHAR(50) | DEFAULT 'draft' |
| series_id | INTEGER | FK→test_series(id) ON DELETE SET NULL |
| stage_id | INTEGER | FK→stages(id) ON DELETE SET NULL |
| subject_id | INTEGER | FK→subjects(id) ON DELETE SET NULL |
| section_id | INTEGER | FK→test_sections(id) ON DELETE SET NULL |
| exam_id | VARCHAR(255) | — |
| test_category_id | INTEGER | — |
| test_type | VARCHAR(50) | — |
| instructions | TEXT | — |
| shuffle_questions | BOOLEAN | DEFAULT false |
| max_attempts | INTEGER | DEFAULT 0 |
| ai_explanation_enabled | BOOLEAN | DEFAULT true |
| banner_asset_id | INTEGER | FK→assets(id) ON DELETE SET NULL |
| promotion_banner_asset_id | INTEGER | FK→assets(id) ON DELETE SET NULL |
| _orphaned | BOOLEAN | DEFAULT false |
| is_coming_soon | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |

#### `test_series`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| name | VARCHAR(255) | NOT NULL |
| slug | VARCHAR(255) | UNIQUE |
| description | TEXT | — |
| exam_id | INTEGER | FK→exams(id) ON DELETE SET NULL |
| stage_id | INTEGER | FK→stages(id) ON DELETE SET NULL |
| is_active | BOOLEAN | DEFAULT true |
| is_pro | BOOLEAN | DEFAULT false |
| _orphaned | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMP | DEFAULT NOW() |

#### `test_categories`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| name | VARCHAR(255) | NOT NULL |
| slug | VARCHAR(255) | UNIQUE |
| exam_category_id | VARCHAR(255) | — |
| is_active | BOOLEAN | DEFAULT true |
| stage_ids | INTEGER[] | — |
| test_series_id | INTEGER[] | — |
| public_id_uuid | UUID | — |
| _orphaned | BOOLEAN | DEFAULT false |

#### `test_sections`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| name | VARCHAR(255) | NOT NULL |
| category_id | INTEGER | FK→test_categories(id) ON DELETE SET NULL |
| test_id | INTEGER | FK→tests(id) ON DELETE CASCADE |
| duration | INTEGER | DEFAULT 60 |
| passing_marks | INTEGER | DEFAULT 0 |
| negative_marks | NUMERIC | — |
| total_marks | NUMERIC | — |
| total_questions | INTEGER | — |
| is_active | BOOLEAN | DEFAULT true |
| display_order | INTEGER | DEFAULT 0 |

#### `test_questions` (junction)
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| test_id | INTEGER | FK→tests(id) ON DELETE CASCADE |
| question_id | INTEGER | FK→questions(id) ON DELETE CASCADE |
| section_id | INTEGER | FK→test_sections(id) ON DELETE SET NULL |
| order_index | INTEGER | DEFAULT 0 |
| marks | NUMERIC | — |
| negative_marks | NUMERIC | — |

#### `questions`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| question_text | TEXT | NOT NULL |
| question_text_hi | TEXT | — |
| options | JSONB | DEFAULT '[]' |
| correct_answer | INTEGER | DEFAULT 0 |
| correct_option | INTEGER | DEFAULT 0 |
| explanation | TEXT | — |
| marks | DECIMAL(5,2) | DEFAULT 1.00 |
| negative_marks | DECIMAL(5,2) | DEFAULT 0.00 |
| difficulty | VARCHAR(20) | DEFAULT 'medium' |
| question_type | VARCHAR(50) | DEFAULT 'single_correct' |
| status | VARCHAR(50) | DEFAULT 'active' |
| is_active | BOOLEAN | DEFAULT true |
| is_practice | BOOLEAN | DEFAULT false |
| test_id | INTEGER | FK→tests(id) ON DELETE SET NULL |
| series_id | INTEGER | FK→test_series(id) ON DELETE SET NULL |
| section_id | INTEGER | FK→test_sections(id) ON DELETE SET NULL |
| subject_id | INTEGER | FK→subjects(id) ON DELETE SET NULL |
| chapter_id | INTEGER | FK→chapters(id) ON DELETE SET NULL |
| topic_id | INTEGER | FK→topics(id) ON DELETE SET NULL |
| passage_id | INTEGER | FK→passages(id) ON DELETE SET NULL |
| created_by | INTEGER | FK→users(id) ON DELETE SET NULL |
| image_asset_id | INTEGER | FK→assets(id) ON DELETE SET NULL |
| quiz_id | INTEGER | FK→quizzes(id) ON DELETE SET NULL |
| study_material_id | INTEGER | FK→study_materials(id) ON DELETE SET NULL |
| language | VARCHAR(20) | DEFAULT 'en' |
| _orphaned | BOOLEAN | DEFAULT false |
| is_deleted | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMP | DEFAULT NOW() |

#### `question_options`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| question_id | INTEGER | NOT NULL |
| text | TEXT | — |
| is_correct | BOOLEAN | DEFAULT false |

#### `question_tag_map` (junction)
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| question_id | INTEGER | FK→questions(id) ON DELETE CASCADE |
| tag_id | INTEGER | FK→tags(id) ON DELETE CASCADE |
| UNIQUE(question_id, tag_id) | | |

#### `tags`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| name | VARCHAR(100) | UNIQUE NOT NULL |
| slug | VARCHAR(100) | UNIQUE NOT NULL |
| category | VARCHAR(100) | — |
| color | VARCHAR(50) | DEFAULT 'gray' |
| is_active | BOOLEAN | DEFAULT true |

### E. Attempts & Results (7 tables)

#### `attempts`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE, NOT NULL |
| test_id | INTEGER | FK→tests(id) ON DELETE CASCADE |
| series_id | INTEGER | FK→test_series(id) ON DELETE SET NULL |
| status | VARCHAR(50) | DEFAULT 'not_started' |
| score | NUMERIC | DEFAULT 0 |
| total_marks | NUMERIC | DEFAULT 0 |
| time_taken | INTEGER | DEFAULT 0 |
| is_completed | BOOLEAN | DEFAULT false |
| is_reattempt | BOOLEAN | DEFAULT false |
| is_active | BOOLEAN | DEFAULT true |
| started_at | TIMESTAMP | — |
| submitted_at | TIMESTAMP | — |
| last_activity | TIMESTAMP | — |
| percentile | NUMERIC | CHECK 0–100 |
| rank | INTEGER | — |
| attempted | INTEGER | DEFAULT 0 |
| incorrect | INTEGER | DEFAULT 0 |
| skipped | INTEGER | DEFAULT 0 |
| section_scores | JSONB | DEFAULT '{}' |
| section_times | JSONB | DEFAULT '{}' |
| section_timers | JSONB | — |
| question_results | JSONB | — |
| solutions | JSONB | — |

#### `attempt_answers`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| attempt_id | INTEGER | FK→attempts(id) ON DELETE CASCADE |
| question_id | INTEGER | FK→questions(id) ON DELETE CASCADE |
| selected_option | INTEGER | — |
| is_correct | BOOLEAN | — |
| is_unattempted | BOOLEAN | DEFAULT false |
| time_spent | INTEGER | DEFAULT 0 |
| section | VARCHAR(100) | — |

#### `attempt_events`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| attempt_id | INTEGER | FK→attempts(id) ON DELETE CASCADE |
| question_id | INTEGER | FK→questions(id) ON DELETE SET NULL |
| event_type | VARCHAR(50) | — |
| event_data | JSONB | — |
| created_at | TIMESTAMP | DEFAULT NOW() |

#### `attempt_section_scores`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| attempt_id | INTEGER | FK→attempts(id) ON DELETE CASCADE |
| section_id | INTEGER | FK→test_sections(id) ON DELETE CASCADE |
| correct | INTEGER | DEFAULT 0 |
| incorrect | INTEGER | DEFAULT 0 |
| skipped | INTEGER | DEFAULT 0 |
| score | NUMERIC(10,2) | DEFAULT 0 |
| marks | NUMERIC(10,2) | DEFAULT 0 |
| negative_marks | NUMERIC(10,2) | DEFAULT 0 |
| time_spent_seconds | INTEGER | DEFAULT 0 |

#### `question_attempts`
| Column | Type | Notes |
|--------|------|-------|
| (legacy table, kept for backward compat) | | |

#### `results`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| user_id | INTEGER | FK→users(id) |
| test_id | INTEGER | FK→tests(id) |
| attempt_id | INTEGER | FK→attempts(id) |
| score | NUMERIC | — |
| percentage | NUMERIC | CHECK 0–100 |
| total_marks | NUMERIC | — |
| time_taken | INTEGER | — |

#### `leaderboard_snapshots`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| leaderboard_id | INTEGER | — |
| test_id | INTEGER | — |
| user_id | INTEGER | — |
| rank | INTEGER | — |
| score | NUMERIC(12,2) | DEFAULT 0 |
| snapshot_date | DATE | — |
| rankings | JSONB | DEFAULT '[]' |

### F. Study Materials (5 tables)

#### `study_materials`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| title | VARCHAR(255) | NOT NULL |
| slug | VARCHAR(255) | UNIQUE |
| description | TEXT | — |
| type | VARCHAR(50) | DEFAULT 'video' |
| url | TEXT | — |
| file_path | TEXT | — |
| subject_id | INTEGER | FK→subjects(id) ON DELETE SET NULL |
| chapter_id | INTEGER | FK→chapters(id) ON DELETE SET NULL |
| topic_id | INTEGER | FK→topics(id) ON DELETE SET NULL |
| is_pro | BOOLEAN | DEFAULT false |
| is_active | BOOLEAN | DEFAULT true |
| chapter_count | INTEGER | DEFAULT 0 |
| video_count | INTEGER | DEFAULT 0 |
| pdf_count | INTEGER | DEFAULT 0 |
| test_count | INTEGER | DEFAULT 0 |
| total_count | INTEGER | DEFAULT 0 |
| _orphaned | BOOLEAN | DEFAULT false |

#### `subject_videos`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| subject_id | INTEGER | FK→subjects(id) ON DELETE CASCADE |
| topic_id | INTEGER | — |
| study_material_id | INTEGER | FK→study_materials(id) ON DELETE SET NULL |
| chapter_id | INTEGER | FK→chapters(id) ON DELETE SET NULL |
| title | VARCHAR(255) | — |
| video_url | TEXT | — |
| slug | VARCHAR(255) | — |
| is_pro | BOOLEAN | DEFAULT false |
| is_active | BOOLEAN | DEFAULT true |

#### `subject_pdfs`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| subject_id | INTEGER | FK→subjects(id) ON DELETE CASCADE |
| topic_id | INTEGER | — |
| study_material_id | INTEGER | FK→study_materials(id) ON DELETE SET NULL |
| chapter_id | INTEGER | FK→chapters(id) ON DELETE SET NULL |
| title | VARCHAR(255) | — |
| file_url | TEXT | — |
| is_active | BOOLEAN | DEFAULT true |

#### `topic_tests`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| topic_id | INTEGER | FK→topics(id) |
| subject_id | INTEGER | FK→subjects(id) ON DELETE CASCADE |
| study_material_id | INTEGER | FK→study_materials(id) ON DELETE SET NULL |
| test_id | INTEGER | FK→tests(id) ON DELETE SET NULL |
| title | VARCHAR(255) | — |
| is_active | BOOLEAN | DEFAULT true |

#### `passages`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| title | VARCHAR(500) | — |
| content | TEXT | NOT NULL |
| subject_id | INTEGER | FK→subjects(id) ON DELETE SET NULL |
| topic_id | INTEGER | FK→topics(id) ON DELETE SET NULL |
| chapter_id | INTEGER | FK→chapters(id) ON DELETE SET NULL |
| difficulty | VARCHAR(50) | DEFAULT 'medium' |
| is_active | BOOLEAN | DEFAULT true |

### G. Quizzes & Daily (5 tables)

#### `quizzes`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| title | VARCHAR(255) | NOT NULL |
| slug | VARCHAR(255) | UNIQUE |
| category | VARCHAR(100) | — |
| difficulty | VARCHAR(20) | DEFAULT 'medium' |
| total_questions | INTEGER | DEFAULT 0 |
| status | VARCHAR(50) | DEFAULT 'draft' |
| created_by | INTEGER | FK→users(id) ON DELETE SET NULL |
| is_active | BOOLEAN | DEFAULT true |
| instructions | TEXT | — |
| is_public | BOOLEAN | DEFAULT true |
| shuffle_questions | BOOLEAN | DEFAULT false |
| topic | VARCHAR(255) | — |
| subject | VARCHAR(255) | — |
| question_count | INTEGER | DEFAULT 0 |
| passing_score | INTEGER | — |

#### `ca_quizzes`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| title | VARCHAR(255) | NOT NULL |
| quiz_date | DATE | — |
| questions | JSONB | DEFAULT '[]' |
| total_questions | INTEGER | DEFAULT 0 |
| is_active | BOOLEAN | DEFAULT true |

#### `ca_quiz_attempts`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| ca_id | INTEGER | FK→ca_quizzes(id) ON DELETE CASCADE |
| answers | JSONB | — |
| correct_count | INTEGER | DEFAULT 0 |

#### `daily_quizzes`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| title | VARCHAR(255) | — |
| quiz_date | DATE | — |
| questions | JSONB | DEFAULT '[]' |
| total_questions | INTEGER | DEFAULT 0 |
| is_active | BOOLEAN | DEFAULT true |

#### `daily_quiz_attempts`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| quiz_id | INTEGER | FK→daily_quizzes(id) ON DELETE CASCADE |
| score | NUMERIC | — |
| answers | JSONB | DEFAULT '[]' |

#### `daily_quiz_questions`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| quiz_id | INTEGER | FK→daily_quizzes(id) ON DELETE CASCADE |
| question_id | INTEGER | FK→questions(id) ON DELETE CASCADE |
| position | INTEGER | DEFAULT 0 |

### H. Practice (6 tables)

#### `practice_sessions`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| exam_id | VARCHAR(255) | — |
| subject_id | INTEGER | FK→subjects(id) ON DELETE SET NULL |
| chapter_id | INTEGER | FK→chapters(id) ON DELETE SET NULL |
| topic_id | INTEGER | FK→topics(id) ON DELETE SET NULL |
| mode | VARCHAR(32) | NOT NULL |
| questions_json | JSONB | DEFAULT '[]' |
| is_active | BOOLEAN | DEFAULT true |

#### `practice_answers`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| session_id | INTEGER | FK→practice_sessions(id) ON DELETE CASCADE |
| question_id | INTEGER | NOT NULL |
| selected_option | INTEGER | — |
| is_correct | BOOLEAN | — |
| UNIQUE(user_id, question_id, session_id) | | |

#### `practice_streaks`
| Column | Type | Notes |
|--------|------|-------|
| user_id | INTEGER | PK, FK→users(id) ON DELETE CASCADE |
| current_streak | INTEGER | DEFAULT 0 |
| longest_streak | INTEGER | DEFAULT 0 |
| last_practice_date | DATE | — |

#### `practice_ai_cache`
| Column | Type | Notes |
|--------|------|-------|
| question_id | INTEGER | PK |
| feature | VARCHAR(32) | PK |
| content | JSONB | NOT NULL |
| model | VARCHAR(64) | — |

#### `practice_daily_sets`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| set_date | DATE | NOT NULL |
| questions | JSONB | DEFAULT '[]' |
| UNIQUE(user_id, set_date) | | |

#### `question_bookmarks`
| Column | Type | Notes |
|--------|------|-------|
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE, PK |
| question_id | INTEGER | NOT NULL, PK |
| created_at | TIMESTAMP | DEFAULT NOW() |

### I. Community (6 tables)

#### `discussions`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| title | VARCHAR(255) | NOT NULL |
| content | TEXT | — |
| author_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| parent_id | INTEGER | FK→discussions(id) ON DELETE CASCADE |
| type | VARCHAR(50) | DEFAULT 'discussion' |
| category | VARCHAR(100) | — |
| tags | TEXT[] | — |
| upvotes | INTEGER | DEFAULT 0 |
| views | INTEGER | DEFAULT 0 |
| is_pinned | BOOLEAN | DEFAULT false |
| is_active | BOOLEAN | DEFAULT true |

#### `discussion_replies`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| discussion_id | INTEGER | FK→discussions(id) ON DELETE CASCADE |
| author_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| parent_id | INTEGER | FK→discussion_replies(id) ON DELETE CASCADE |
| content | TEXT | NOT NULL |
| upvotes | INTEGER | DEFAULT 0 |

#### `discussion_votes`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| discussion_id | INTEGER | FK→discussions(id) ON DELETE CASCADE |
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| vote_type | VARCHAR(20) | CHECK IN ('upvote','downvote') |

#### `community_comments`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| post_id | INTEGER | FK→group_posts(id) ON DELETE CASCADE |
| user_id | INTEGER | FK→users(id) ON DELETE SET NULL |
| parent_id | INTEGER | FK→community_comments(id) ON DELETE CASCADE |
| content | TEXT | NOT NULL |
| is_active | BOOLEAN | DEFAULT true |

#### `community_votes`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| post_id | INTEGER | NOT NULL |
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| vote_type | VARCHAR(20) | CHECK IN ('upvote','downvote') |
| UNIQUE(post_id, user_id) | | |

#### `group_posts` / `group_post_likes` / `group_messages`
(Legacy tables, kept alongside newer community tables)

### J. Study Groups (3 tables)

#### `study_groups`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| name | VARCHAR(255) | NOT NULL |
| slug | VARCHAR(255) | UNIQUE |
| description | TEXT | — |
| exam_id | VARCHAR(100) | FK→exams(id) |
| owner_id | INTEGER | FK→users(id) ON DELETE SET NULL |
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| max_members | INTEGER | DEFAULT 50 |
| is_public | BOOLEAN | DEFAULT true |
| is_active | BOOLEAN | DEFAULT true |

#### `study_group_members`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| group_id | INTEGER | FK→study_groups(id) ON DELETE CASCADE |
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| role | VARCHAR(20) | DEFAULT 'member' CHECK |
| UNIQUE(group_id, user_id) | | |

#### `study_group_messages`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| group_id | INTEGER | FK→study_groups(id) ON DELETE CASCADE |
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| content | TEXT | NOT NULL |
| message_type | VARCHAR(20) | DEFAULT 'text' CHECK |

### K. Doubts (2 tables)

#### `doubts`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| title | VARCHAR(255) | — |
| content | TEXT | — |
| is_active | BOOLEAN | DEFAULT true |

#### `doubt_replies`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| doubt_id | INTEGER | FK→doubts(id) ON DELETE CASCADE |
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| content | TEXT | NOT NULL |
| is_accepted | BOOLEAN | DEFAULT false |
| public_id | TEXT | GENERATED |

### L. Commerce (6 tables)

#### `subscriptions`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| plan_type | VARCHAR(50) | CHECK constraint |
| status | VARCHAR(20) | DEFAULT 'active' |
| starts_at | TIMESTAMP | — |
| expires_at | TIMESTAMP | — |

#### `subscription_plans`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| name | VARCHAR(255) | — |
| price | NUMERIC | — |
| duration_days | INTEGER | — |
| is_active | BOOLEAN | DEFAULT true |

#### `enrollments`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| series_id | INTEGER | FK→test_series(id) ON DELETE CASCADE |
| study_material_id | INTEGER | FK→study_materials(id) ON DELETE SET NULL |
| status | VARCHAR(20) | DEFAULT 'active' |
| enrolled_at | TIMESTAMP | DEFAULT NOW() |

#### `transactions`
| Column | Type | Notes |
|--------|------|-------|
| (defined in migration 029) | | |

#### `payments`
| Column | Type | Notes |
|--------|------|-------|
| (created in admin-payments.js at runtime) | | |

#### `coupons`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| code | VARCHAR(50) | UNIQUE NOT NULL |
| discount_type | VARCHAR(20) | CHECK 'percentage'/'fixed' |
| discount_value | DECIMAL(10,2) | NOT NULL |
| max_discount | DECIMAL(10,2) | — |
| usage_limit | INTEGER | — |
| usage_count | INTEGER | DEFAULT 0 |
| valid_from | TIMESTAMPTZ | — |
| valid_until | TIMESTAMPTZ | — |
| is_active | BOOLEAN | DEFAULT true |
| created_by | INTEGER | FK→users(id) |

#### `promotions`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| title | VARCHAR(255) | NOT NULL |
| type | VARCHAR(50) | CHECK 'banner'/'popup'/'notification' |
| banner_asset_id | INTEGER | FK→assets(id) ON DELETE SET NULL |
| is_active | BOOLEAN | DEFAULT true |

#### `pro_passes`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| pass_type | VARCHAR(50) | — |
| starts_at | TIMESTAMP | — |
| expires_at | TIMESTAMP | — |
| is_active | BOOLEAN | DEFAULT true |

### M. Content & Media (8 tables)

#### `assets`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| name | VARCHAR(255) | — |
| file_path | TEXT | — |
| file_type | VARCHAR(50) | — |
| file_size | INTEGER | — |
| mime_type | VARCHAR(100) | — |
| uploaded_by | INTEGER | FK→users(id) ON DELETE SET NULL |
| is_active | BOOLEAN | DEFAULT true |

#### `banners`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| title | VARCHAR(255) | — |
| image_url | TEXT | — |
| link_url | TEXT | — |
| position | VARCHAR(50) | — |
| asset_id | INTEGER | FK→assets(id) ON DELETE SET NULL |
| exam_id | INTEGER | FK→exams(id) ON DELETE SET NULL |
| is_active | BOOLEAN | DEFAULT true |

#### `blogs`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| title | VARCHAR(255) | — |
| slug | VARCHAR(255) | UNIQUE |
| content | TEXT | — |
| author_id | INTEGER | FK→users(id) ON DELETE SET NULL |
| status | VARCHAR(20) | DEFAULT 'draft' |
| is_active | BOOLEAN | DEFAULT true |

#### `current_affairs`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| title | VARCHAR(500) | NOT NULL |
| slug | VARCHAR(500) | UNIQUE |
| content | TEXT | — |
| category | VARCHAR(100) | — |
| author_id | INTEGER | — |
| is_active | BOOLEAN | DEFAULT true |
| is_featured | BOOLEAN | DEFAULT false |
| view_count | INTEGER | DEFAULT 0 |

#### `email_templates`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| name | VARCHAR(100) | UNIQUE NOT NULL |
| type | VARCHAR(50) | — |
| subject | VARCHAR(500) | NOT NULL |
| body | TEXT | — |
| variables | JSONB | DEFAULT '[]' |
| enabled | BOOLEAN | DEFAULT true |

#### `faqs`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| question | TEXT | — |
| answer | TEXT | — |
| category_id | INTEGER | FK→test_categories(id) ON DELETE SET NULL |
| is_active | BOOLEAN | DEFAULT true |

#### `testimonials`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| user_id | INTEGER | FK→users(id) ON DELETE SET NULL |
| content | TEXT | — |
| is_active | BOOLEAN | DEFAULT true |

#### `media`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| uploaded_by | INTEGER | FK→users(id) ON DELETE SET NULL |
| (other columns vary) | | |

#### `navigation_config`
| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR(50)/SERIAL | PK |
| label | VARCHAR(100) | NOT NULL |
| icon | VARCHAR(50) | — |
| route | VARCHAR(100) | — |
| parent_id | INTEGER | — |
| display_order | INTEGER | DEFAULT 0 |
| is_active | BOOLEAN | DEFAULT true |
| badge | VARCHAR(50) | — |
| badge_color | VARCHAR(50) | — |
| metadata | JSONB | DEFAULT '{}' |

### N. Analytics & AI (12 tables)

#### `audit_logs`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| user_id | INTEGER | FK→users(id) ON DELETE SET NULL |
| admin_id | INTEGER | FK→users(id) ON DELETE SET NULL |
| action | VARCHAR(100) | NOT NULL |
| table_name | VARCHAR(100) | — |
| record_id | INTEGER | — |
| old_data | JSONB | — |
| new_data | JSONB | — |
| old_values | JSONB | — |
| new_values | JSONB | — |
| details | JSONB | — |
| resource | VARCHAR | — |
| resource_id | VARCHAR | — |
| status | VARCHAR | DEFAULT 'success' |
| description | TEXT | — |
| ip_address | VARCHAR(45)/INET | — |
| user_agent | TEXT | — |
| admin_email | VARCHAR | — |
| admin_name | VARCHAR | — |
| created_at | TIMESTAMP | DEFAULT NOW() |

#### `activity_logs`
| Column | Type | Notes |
|--------|------|-------|
| (referenced in tableMap) | | |

#### `user_topic_stats`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| topic_id | INTEGER | FK→topics(id) ON DELETE SET NULL |
| topic | VARCHAR(255) | — |
| subject | VARCHAR(255) | — |
| total_attempts | INTEGER | DEFAULT 0 |
| correct_answers | INTEGER | DEFAULT 0 |
| accuracy | NUMERIC | DEFAULT 0 |
| is_active | BOOLEAN | DEFAULT true |

#### `user_topic_performance`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL | PK |
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| topic_id | INTEGER | FK→topics(id) ON DELETE CASCADE |
| total_attempted | INTEGER | DEFAULT 0 |
| total_correct | INTEGER | DEFAULT 0 |
| accuracy | NUMERIC | DEFAULT 0 |
| metadata | JSONB | DEFAULT '{}' |
| UNIQUE(user_id, topic_id) | | |

#### `leaderboard_entries`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| test_id | INTEGER | FK→tests(id) ON DELETE CASCADE |
| series_id | INTEGER | FK→test_series(id) ON DELETE CASCADE |
| score | NUMERIC | — |
| rank | INTEGER | — |

#### `leaderboards`
| Column | Type | Notes |
|--------|------|-------|
| (referenced in tableMap) | | |

#### `study_streaks`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE, UNIQUE |
| current_streak | INTEGER | DEFAULT 0 |
| longest_streak | INTEGER | DEFAULT 0 |
| last_active_date | DATE | — |

#### `wrong_questions`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| question_id | INTEGER | FK→questions(id) ON DELETE CASCADE |
| attempt_id/source_attempt_id | INTEGER | FK→attempts(id) ON DELETE CASCADE |
| wrong_count | INTEGER | DEFAULT 1 |

#### `revision_queue`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| question_id | INTEGER | FK→questions(id) ON DELETE CASCADE |
| priority | VARCHAR(20) | DEFAULT 'medium' |
| next_review_at | TIMESTAMP | — |
| due_at | TIMESTAMP | — |

#### `ai_generation_logs` / `ai_logs`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| entity_type | VARCHAR(50) | — |
| prompt | TEXT | — |
| model | VARCHAR(100) | — |
| tokens_input | INTEGER | DEFAULT 0 |
| tokens_output | INTEGER | DEFAULT 0 |
| cost_usd | NUMERIC(10,6) | DEFAULT 0 |
| status | VARCHAR(20) | DEFAULT 'success' |
| created_by | INTEGER | FK→users(id) ON DELETE SET NULL |

#### `ai_api_usage`
| Column | Type | Notes |
|--------|------|-------|
| (dropped in 039, replaced by ai_generation_logs) | | |

#### `import_logs`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL | PK |
| source | VARCHAR(100) | NOT NULL |
| file_name | VARCHAR(255) | — |
| total_records | INTEGER | DEFAULT 0 |
| imported | INTEGER | DEFAULT 0 |
| imported_by | INTEGER | FK→users(id) ON DELETE SET NULL |

### O. AI / Embeddings (5 tables)

#### `embeddings`
| Column | Type | Notes |
|--------|------|-------|
| (defined in migration 076, vector column) | | |

#### `document_chunks`
| Column | Type | Notes |
|--------|------|-------|
| (defined in migration 075) | | |

#### `ai_conversations`
| Column | Type | Notes |
|--------|------|-------|
| (defined in migration 075) | | |

#### `ai_messages`
| Column | Type | Notes |
|--------|------|-------|
| (defined in migration 075) | | |

#### `prompt_templates`
| Column | Type | Notes |
|--------|------|-------|
| (defined in migration 075) | | |

### P. Infrastructure (6 tables)

#### `live_tests`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| test_id | INTEGER | FK→tests(id) ON DELETE SET NULL |
| start_time | TIMESTAMPTZ | — |
| end_time | TIMESTAMPTZ | — |
| result_time | TIMESTAMPTZ | — |
| is_active | BOOLEAN | DEFAULT true |
| CHECK: end > start | | |

#### `schema_migrations`
| Column | Type | Notes |
|--------|------|-------|
| (created by migrationRunner.js) | | |

#### `schema_migrations_metadata`
| Column | Type | Notes |
|--------|------|-------|
| (defined in migration 071) | | |

#### `dead_letter_jobs`
| Column | Type | Notes |
|--------|------|-------|
| (defined in migration 075) | | |

#### `question_assets`
| Column | Type | Notes |
|--------|------|-------|
| (defined in migration 026) | | |

#### `topic_resources`
| Column | Type | Notes |
|--------|------|-------|
| (defined in migration 026) | | |

### Q. Junction / Support Tables

#### `test_category_series`
| Column | Type | Notes |
|--------|------|-------|
| test_category_id | INTEGER | FK→test_categories(id) ON DELETE CASCADE, PK |
| test_series_id | INTEGER | FK→test_series(id) ON DELETE CASCADE, PK |

#### `subject_parts`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| subject_id | INTEGER | FK→subjects(id) ON DELETE CASCADE |

#### `subject_relations`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| subject_id | INTEGER | FK→subjects(id) ON DELETE CASCADE |
| related_subject_id | INTEGER | FK→subjects(id) ON DELETE CASCADE |

#### `study_progress`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| series_id | INTEGER | FK→test_series(id) ON DELETE CASCADE |
| material_id | INTEGER | FK→study_materials(id) ON DELETE CASCADE |

#### `user_history_archive`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| user_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| series_id | INTEGER | FK→test_series(id) ON DELETE CASCADE |
| material_id | INTEGER | FK→study_materials(id) ON DELETE CASCADE |

#### `question_reports`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| user_id | INTEGER | FK→users(id) ON DELETE SET NULL |
| question_id | INTEGER | NOT NULL |
| reason | VARCHAR(100) | — |
| status | VARCHAR(32) | DEFAULT 'open' |

#### `referrals`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| referrer_id | INTEGER | FK→users(id) ON DELETE CASCADE |
| referred_email | VARCHAR(255) | — |
| referral_code | VARCHAR(50) | NOT NULL |
| status | VARCHAR(20) | CHECK |

#### `app_settings`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| key | VARCHAR(255) | UNIQUE NOT NULL |
| value | JSONB | — |
| description | TEXT | — |

#### `content_moderation_queue`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| entity_type | VARCHAR(50) | NOT NULL |
| entity_id | INTEGER | NOT NULL |
| submitted_by | INTEGER | FK→users(id) ON DELETE SET NULL |
| reviewed_by | INTEGER | FK→users(id) ON DELETE SET NULL |
| status | VARCHAR(20) | CHECK |

#### `backups`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| created_by | INTEGER | FK→users(id) ON DELETE SET NULL |

#### `messages`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| sender_id | INTEGER | FK→users(id) ON DELETE SET NULL |
| receiver_id | INTEGER | FK→users(id) ON DELETE SET NULL |
| content | TEXT | — |
| is_read | BOOLEAN | DEFAULT false |

#### `notifications`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| user_id | INTEGER | FK→users(id) |
| title | VARCHAR(255) | — |
| message | TEXT | — |
| is_read | BOOLEAN | DEFAULT false |
| type | VARCHAR(50) | — |

#### `test_state_machine`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| test_id | INTEGER | FK→tests(id) ON DELETE CASCADE |
| from_state | VARCHAR(50) | — |
| to_state | VARCHAR(50) | NOT NULL |
| changed_by | INTEGER | FK→users(id) ON DELETE SET NULL |

---

## 3. COMPLETE FOREIGN KEY CATALOG

### ON DELETE CASCADE (cascade deletions)
| Parent Table | Child Table | FK Column |
|-------------|-------------|-----------|
| users | user_sessions | user_id |
| users | user_roles | user_id |
| users | attempts | user_id |
| users | bookmarks | user_id |
| users | question_bookmarks | user_id |
| users | practice_sessions | user_id |
| users | practice_answers | user_id |
| users | practice_streaks | user_id |
| users | practice_daily_sets | user_id |
| users | csrf_tokens | user_id |
| users | daily_quiz_attempts | user_id |
| users | daily_quiz_questions | (via quiz) |
| users | pro_passes | user_id |
| users | enrollments | user_id |
| users | leaderboard_entries | user_id |
| users | study_streaks | user_id |
| users | wrong_questions | user_id |
| users | revision_queue | user_id |
| users | user_topic_stats | user_id |
| users | user_topic_performance | user_id |
| users | doubts | user_id |
| users | doubt_replies | user_id |
| users | discussions | author_id |
| users | discussion_replies | author_id |
| users | discussion_votes | user_id |
| users | community_votes | user_id |
| users | study_groups | user_id |
| users | study_group_members | user_id |
| users | study_group_messages | user_id |
| users | referrals | referrer_id |
| users | user_achievements | user_id |
| users | user_history_archive | user_id |
| users | study_progress | user_id |
| users | ai_api_usage | user_id (SET NULL) |
| users | ca_quiz_attempts | user_id |
| roles | user_roles | role_id |
| roles | role_permissions | role_id |
| permissions | role_permissions | permission_id |
| tests | test_questions | test_id |
| tests | attempts | test_id |
| tests | test_state_machine | test_id |
| tests | live_tests | test_id (SET NULL) |
| questions | test_questions | question_id |
| questions | attempt_answers | question_id |
| questions | question_tag_map | question_id |
| questions | wrong_questions | question_id |
| questions | revision_queue | question_id |
| questions | daily_quiz_questions | question_id |
| questions | attempt_events | question_id (SET NULL) |
| attempts | attempt_answers | attempt_id |
| attempts | attempt_events | attempt_id |
| attempts | attempt_section_scores | attempt_id |
| attempts | question_attempts | attempt_id (legacy) |
| tags | question_tag_map | tag_id |
| discussions | discussion_replies | discussion_id |
| discussions | discussion_votes | discussion_id |
| discussions | discussions (self) | parent_id |
| discussion_replies | discussion_replies (self) | parent_id |
| study_groups | study_group_members | group_id |
| study_groups | study_group_messages | group_id |
| doubts | doubt_replies | doubt_id |
| ca_quizzes | ca_quiz_attempts | ca_id |
| daily_quizzes | daily_quiz_questions | quiz_id |
| daily_quizzes | daily_quiz_attempts | quiz_id |
| practice_sessions | practice_answers | session_id |
| achievements | user_achievements | achievement_id |
| achievement_definitions | user_achievements | achievement_id |
| group_posts | community_comments | post_id |
| community_comments | community_comments (self) | parent_id |
| exams | exam_seasons | exam_id |
| test_category_series | (junction) | test_category_id, test_series_id |
| navigation_menu | navigation_menu (self) | parent_id |
| subjects | subject_relations | subject_id, related_subject_id |
| subjects | subjects (self) | parent_id |

### ON DELETE SET NULL (preserve child, nullify FK)
| Parent Table | Child Table | FK Column |
|-------------|-------------|-----------|
| test_series | tests | series_id |
| stages | tests | stage_id |
| subjects | tests | subject_id |
| test_sections | tests | section_id |
| test_sections | test_questions | section_id |
| test_sections | test_sections | category_id |
| test_categories | test_sections | category_id |
| test_categories | test_categories | exam_category_id |
| assets | tests | banner_asset_id |
| assets | tests | promotion_banner_asset_id |
| assets | promotions | banner_asset_id |
| assets | banners | asset_id |
| assets | questions | image_asset_id |
| users | questions | created_by |
| users | quizzes | created_by |
| users | assets | uploaded_by |
| users | questions | deleted_by |
| users | attempts | series_id |
| topics | questions | topic_id |
| chapters | questions | chapter_id |
| subjects | questions | subject_id |
| passages | questions | passage_id |
| quizzes | questions | quiz_id |
| study_materials | questions | study_material_id |
| subjects | study_materials | subject_id |
| chapters | study_materials | chapter_id |
| topics | study_materials | topic_id |
| study_materials | subject_videos | study_material_id |
| study_materials | subject_pdfs | study_material_id |
| study_materials | topic_tests | study_material_id |
| chapters | subject_videos | chapter_id |
| chapters | subject_pdfs | chapter_id |
| chapters | topic_tests | chapter_id |
| topics | topic_tests | topic_id |
| tests | topic_tests | test_id |
| tests | live_tests | test_id |
| exams | study_groups | exam_id |
| users | study_groups | owner_id |
| users | community_comments | user_id |
| users | submissions | submitted_by |
| users | content_moderation_queue | submitted_by, reviewed_by |
| users | messages | sender_id, receiver_id |
| users | backups | created_by |
| users | coupons | created_by |
| users | promotions | created_by |
| users | ai_generation_logs | created_by |
| users | testimonials | user_id |
| users | faqs | category_id |
| users | blogs | author_id |
| users | import_logs | imported_by |
| users | enrollments | study_material_id |
| exams | page_content | exam_id |
| topics | passages | topic_id |
| subjects | passages | subject_id |
| chapters | passages | chapter_id |
| test_categories | test_sections | category_id |
| subjects | subject_parts | subject_id |
| subject_parts | units | part_id |
| units | chapters | unit_id |
| chapters | topics | chapter_id |
| topics | subtopics | topic_id |

### NO ACTION / Not explicitly set
| Table | Column | Notes |
|-------|--------|-------|
| test_questions | test_id | Set in 061 as ON DELETE CASCADE |
| test_questions | question_id | Set in 061 as ON DELETE CASCADE |
| question_options | question_id | No FK defined |
| question_bookmarks | question_id | No FK to questions |
| practice_answers | question_id | No FK to questions |
| question_reports | question_id | No FK to questions |
| exam_yearly_data | exam_id | VARCHAR, no FK (type mismatch) |
| exam_updates | exam_id | VARCHAR, no FK (type mismatch) |
| leaderboard_snapshots | various | No FKs defined |
| attempt_section_scores | various | FKs added in 072 |

---

## 4. SOFT DELETE PATTERN ANALYSIS

### Tables with `is_deleted` column:
| Table | Pattern |
|-------|---------|
| questions | is_deleted + deleted_at + deleted_by |
| test_categories | is_deleted + deleted_at + deleted_by |
| doubt_replies | is_deleted + deleted_at + deleted_by |
| subject_relations | is_deleted + deleted_at + deleted_by |
| study_progress | is_deleted + deleted_at + deleted_by |
| user_history_archive | is_deleted + deleted_at + deleted_by |
| community_comments | is_deleted |

### Tables with `_orphaned` column:
| Table |
|-------|
| tests |
| questions |
| test_series |
| topics |
| chapters |
| subtopics |
| subjects |
| study_materials |
| exams |

### Tables with `is_active` soft-delete (active/inactive):
Nearly ALL tables use `is_active BOOLEAN DEFAULT true` — this is the primary soft-delete mechanism.

### Inconsistency: **CRITICAL**
- Some tables use `is_deleted` + `deleted_at` + `deleted_by` (3-column pattern)
- Most tables use only `is_active` (1-column pattern)
- `_orphaned` is a separate concept (orphaned from parent), not soft-delete
- The `soft_delete_record()` RPC function in 000_baseline_functions expects `is_deleted`, `is_active`, `deleted_at`, `deleted_by` — but most tables don't have all 4 columns

---

## 5. AUDIT TRAIL ANALYSIS

### `audit_logs` table
- Created in 001 as UUID PK, **dropped and recreated** in 019 as SERIAL INTEGER PK
- Extended in 002 with old_values, new_values, details, resource, status, description
- Further extended in 068 with admin_email, admin_name

### `log_audit_event()` RPC function
- Defined in 000_baseline_functions.sql
- Dynamically checks which columns exist before inserting
- Called from middleware and application code

### Triggers:
| Trigger | Table | Function |
|---------|-------|----------|
| set_updated_at | 30+ tables | update_updated_at_column() |
| trg_users_full_name_sync | users | sync_users_full_name() |
| trg_sync_community_votes | community_votes | sync_community_votes_to_group_post_likes() |
| prevent_public_id_uuid_mutation | (entity tables) | prevent_public_id_uuid_mutation() |
| rls_auto_enable_trigger | (event trigger) | rls_auto_enable() |

---

## 6. INDEX ANALYSIS

### Well-indexed columns:
- `users.email` (idx_users_email — migration 087)
- `attempts.user_id` (idx_attempts_user_id — migration 087)
- `attempts.test_id` (idx_attempts_test_id — relationships.js)
- `attempts.series_id` (idx_attempts_series_id — migration 061)
- `questions.topic_id` (idx_questions_topic_id — migration 025)
- `questions.chapter_id` (idx_questions_chapter_id — relationships.js)
- `questions.subject_id` (idx_questions_subject — migration 061)
- `test_questions.test_id` + `question_id` (relationships.js)
- All `is_active` columns with partial indexes
- All `_orphaned` columns with partial indexes
- GIN indexes on JSONB columns (user_topic_performance.metadata, attempt_answers.metadata)

### Missing indexes (HIGH priority):
| Table | Column | Why needed |
|-------|--------|------------|
| notifications | user_id | Notification lookups by user |
| question_bookmarks | question_id | Lookup questions by bookmark |
| question_reports | question_id | Lookup reports by question |
| daily_quizzes | is_active | Filter active quizzes |
| enrollments | series_id | Lookup enrollments by series |
| live_tests | test_id | Live test lookups |
| attempt_events | created_at | Time-series queries |
| ai_generation_logs | created_by | AI usage per user |
| ai_generation_logs | created_at | Time-series queries |
| leaderboard_entries | test_id | Leaderboard per test |

---

## 7. CRITICAL ISSUES

### CRITICAL SEVERITY

#### Issue 1: Missing Migrations 003–017
- **File:** `docs/ARCHITECTURE.md:53,79`
- **Description:** 15 migration files (003–017) are documented as "MISSING FROM DISK". These were supposedly applied to production but the SQL files don't exist in the repo. The database state is unrecoverable from migrations alone.
- **Fix:** Run `pg_dump --schema-only` from production and commit the DDL as migrations 003–017.

#### Issue 2: exam_id Type Mismatch (VARCHAR vs INTEGER)
- **Files:** migrations 019, 025, 040, 060
- **Description:** `exams.id` is SERIAL INTEGER, but `exam_yearly_data.exam_id`, `exam_updates.exam_id`, and `exam_seasons.exam_id` store VARCHAR slug values. FK constraints cannot be created. Migration 040 adds `exam_internal_id` as a workaround but the original `exam_id` VARCHAR columns remain unfixed.
- **Fix:** Backfill `exam_internal_id` from slugs, add FK on `exam_internal_id`, eventually deprecate VARCHAR `exam_id` columns.

#### Issue 3: questions.test_id Denormalized Column
- **Files:** migration 061, ARCHITECTURE.md
- **Description:** `questions.test_id` exists as a denormalized FK alongside the canonical `test_questions` junction table. Some code reads from `questions.test_id`, some from `test_questions`. They can drift.
- **Fix:** Migrate all reads to use `test_questions` junction. Consider dropping `questions.test_id` FK constraint (keep column for backward compat).

#### Issue 4: Inconsistent Soft Delete Pattern
- **Files:** migration 032, postgres-helpers.js
- **Description:** `soft_delete_record()` RPC expects `is_deleted`, `is_active`, `deleted_at`, `deleted_by` columns, but most tables only have `is_active`. The function will fail silently on tables missing those columns.
- **Fix:** Either add the missing columns to all tables, or create a simplified `soft_delete_active()` function that only toggles `is_active`.

#### Issue 5: Duplicate Table Definitions (achievements vs achievement_definitions)
- **Files:** migration 039, 060
- **Description:** Two competing achievement tables exist. Migration 039 tries to drop `achievements` if empty but warns if it has data. Migration 060 recreates `achievements` with a different schema. Code references both.
- **Fix:** Decide on canonical table, migrate all code, drop the other.

### HIGH SEVERITY

#### Issue 6: Missing FK on question_bookmarks.question_id
- **File:** migration 065
- **Description:** `question_bookmarks` has no FK to `questions(id)`. Orphaned bookmarks possible.
- **Fix:** Add FK constraint.

#### Issue 7: Missing FK on question_reports.question_id
- **File:** migration 065
- **Description:** `question_reports` has no FK to `questions(id)`. Orphaned reports possible.
- **Fix:** Add FK constraint.

#### Issue 8: practice_answers Dropped Then Recreated
- **Files:** migration 061 drops `practice_answers`, migration 065 recreates it
- **Description:** Migration 061 drops `practice_answers` CASCADE, but 065 recreates it. If 065 runs before 061 in some ordering, data loss occurs.
- **Fix:** Ensure migration ordering is enforced. The 061 drop should be removed since 065 recreates the table.

#### Issue 9: notifications table — No CREATE TABLE in migrations
- **Files:** All migration files
- **Description:** The `notifications` table is referenced throughout the codebase but no `CREATE TABLE` statement exists in any migration. It was likely created at runtime by postgres-helpers.js or manually.
- **Fix:** Add a defensive `CREATE TABLE IF NOT EXISTS notifications` migration.

#### Issue 10: subscriptions table — No CREATE TABLE in migrations
- **Files:** All migration files
- **Description:** Same as notifications — referenced everywhere but never created in a migration file.
- **Fix:** Add migration.

#### Issue 11: results table — No CREATE TABLE in migrations
- **Files:** All migration files
- **Description:** Referenced by test result code but no migration creates it.
- **Fix:** Add migration.

#### Issue 12: group_posts / group_post_likes / group_messages — No CREATE TABLE
- **Files:** postgres-helpers.js tableMap
- **Description:** These legacy community tables are in the tableMap but never created by migrations.
- **Fix:** Add defensive CREATE TABLE migrations.

#### Issue 13: doubts table — No CREATE TABLE in migrations
- **File:** postgres-helpers.js tableMap
- **Description:** Referenced by doubt_replies FK but never created in a migration.
- **Fix:** Add migration.

#### Issue 14: RLS Policies Missing
- **File:** migration 000a, ARCHITECTURE.md
- **Description:** RLS is enabled on all tables (via event trigger), but only 1 policy exists (service role). Row-level security is effectively a no-op for authenticated users.
- **Fix:** Add per-table policies for authenticated users (read own data, read public data).

### MEDIUM SEVERITY

#### Issue 15: navigation_config vs navigation_menu Confusion
- **Files:** migrations 019, 039, 060
- **Description:** Three different tables (navigation_config from 001, navigation_menu from 038/060, dropped in 019) have been created and dropped. The current canonical table is `navigation_config` but code may still reference `navigation_menu`.
- **Fix:** Ensure all code uses `navigation_config`. Verify `navigation_menu` is dropped.

#### Issue 16: Duplicate promotion table definitions
- **Files:** migration 018 vs 060
- **Description:** `promotions` created in 018 with discount columns, recreated in 060 with different columns (type, content, image_url). Both survive via IF NOT EXISTS.
- **Fix:** Consolidate to single schema.

#### Issue 17: Duplicate referrals table definitions
- **Files:** migration 018 vs 060
- **Description:** Same pattern — 018 has `referred_id` FK, 060 has `referred_email` string.
- **Fix:** Consolidate.

#### Issue 18: Duplicate study_groups table definitions
- **Files:** migration 018 vs 039 vs 060
- **Description:** Three versions with different columns (created_by vs owner_id vs user_id).
- **Fix:** Consolidate to single schema.

#### Issue 19: Duplicate study_group_members / study_group_messages
- **Files:** migration 039 vs 060
- **Description:** Created in both with potentially different schemas.
- **Fix:** Consolidate.

#### Issue 20: Duplicate discussions table definitions
- **Files:** migration 039 vs 060
- **Description:** 039 creates with `user_id`, 060 creates with `author_id`. Both survive.
- **Fix:** Consolidate.

### LOW SEVERITY

#### Issue 21: practice_streaks vs study_streaks
- **Files:** migration 018, 065
- **Description:** Two separate streak tracking tables with overlapping purpose.
- **Fix:** Consider merging.

#### Issue 22: user_topic_stats vs user_topic_performance
- **Files:** migration 018, 025
- **Description:** Two tables for per-topic analytics. 039 attempts to backfill one from the other.
- **Fix:** Document which is canonical.

#### Issue 23: CHECK constraints NOT VALID
- **File:** migration 089
- **Description:** `results.percentage`, `questions.marks`, `questions.negative_marks` CHECK constraints added as NOT VALID. Pre-existing violations not cleaned.
- **Fix:** Run `VALIDATE CONSTRAINT` after cleaning data.

#### Issue 24: Multiple UUID vs INTEGER PK inconsistencies
- **Files:** migrations 001, 018
- **Description:** `permissions` and `roles` originally had UUID PKs, dropped and recreated with INTEGER in 018. `email_templates` also had UUID PK dropped in 039. Any production data in UUID versions was lost.
- **Fix:** Verify no UUID PKs remain in production.

---

## 8. TABLES REFERENCED IN CODE BUT MAY NOT EXIST IN DB

These tables appear in `postgres-helpers.js` tableMap, route files, or model files but have **no CREATE TABLE in any migration**:

| Table | Evidence of reference | Risk |
|-------|----------------------|------|
| `notifications` | tableMap, notificationService.js, routes | HIGH — core feature |
| `subscriptions` | tableMap, routes, SubscriptionService | HIGH — core feature |
| `results` | tableMap, test result routes | HIGH — core feature |
| `group_posts` | tableMap, communityComments FK target | HIGH — community feature |
| `group_post_likes` | tableMap, sync trigger target | MEDIUM |
| `group_messages` | tableMap | MEDIUM |
| `doubts` | tableMap, doubt_replies FK target | HIGH — doubt forum |
| `bookmarks` | tableMap, check_orphaned_records() | MEDIUM |
| `leaderboards` | tableMap | MEDIUM |
| `activity_logs` | tableMap | LOW |
| `media` | tableMap, routes | MEDIUM |
| `question_attempts` | tableMap, code references | MEDIUM — legacy |
| `backups` | routes, FK added in 019 | LOW |
| `topic_analytics` | analytics-tables-migration.sql | LOW |

---

## 9. SUMMARY STATISTICS

| Metric | Count |
|--------|-------|
| **Total migration files on disk** | 94 (000–093) + 7 legacy |
| **Missing migrations** | 15 (003–017) |
| **Estimated total tables** | ~75–80 |
| **Tables with explicit CREATE TABLE in migrations** | ~65 |
| **Tables missing from migrations** | ~10–15 |
| **Foreign keys defined** | ~130+ |
| **FKs with ON DELETE CASCADE** | ~80 |
| **FKs with ON DELETE SET NULL** | ~45 |
| **FKs with NO ACTION / missing** | ~5–10 |
| **Junction tables** | ~8 (test_questions, user_roles, role_permissions, question_tag_map, test_category_series, study_group_members, subject_relations, community_votes) |
| **Tables with is_active** | ~50+ |
| **Tables with is_deleted** | ~7 |
| **Tables with _orphaned** | ~9 |
| **CHECK constraints** | ~15 (attempts.status, live_tests, coupons, promotions, etc.) |
| **ENUM types defined** | 14 (user_role, attempt_status, etc.) — not used by columns |
| **Triggers** | ~35+ (updated_at, sync, RLS) |
| **RPC functions** | 13 (baseline) |
| **Indexes defined** | ~200+ |
| **GIN indexes** | ~10 (JSONB columns) |
| **Partial indexes (WHERE)** | ~30+ |

---

## 10. RECOMMENDED ACTIONS (Priority Order)

1. **CRITICAL:** Recover migrations 003–017 from production `pg_dump --schema-only`
2. **CRITICAL:** Add defensive CREATE TABLE for: notifications, subscriptions, results, doubts, group_posts, group_post_likes, group_messages, bookmarks, leaderboards
3. **CRITICAL:** Fix exam_id VARCHAR→INTEGER type mismatch with a backfill migration
4. **HIGH:** Consolidate duplicate table definitions (promotions, referrals, study_groups, discussions, achievements)
5. **HIGH:** Standardize soft-delete pattern across all tables
6. **HIGH:** Add missing FKs on question_bookmarks.question_id, question_reports.question_id
7. **HIGH:** Add RLS policies for authenticated users
8. **MEDIUM:** Add missing performance indexes (notifications.user_id, enrollments.series_id, etc.)
9. **MEDIUM:** Resolve practice_answers drop/recreate ordering issue
10. **LOW:** Validate all NOT VALID CHECK constraints
11. **LOW:** Merge duplicate analytics tables (user_topic_stats vs user_topic_performance)
12. **LOW:** Drop unused ENUM types or convert columns to use them
