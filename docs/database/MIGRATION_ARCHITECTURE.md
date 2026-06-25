# Migration Architecture Guide

## Overview

Trstprep V2.1 uses a **dual schema source** approach:

1. **SQL Migrations** (`apps/backend/src/infrastructure/database/migrations/`) — 49 files (000-048)
2. **Runtime DDL** (`apps/backend/src/infrastructure/database/postgres-helpers.js`) — `initTables()` runs on every startup

## Why This Exists

The original schema was created via a database dump, not SQL migrations. Migrations 003-017 were never committed to git. The core tables (`users`, `exams`, `stages`, `subjects`, `chapters`, `topics`, `tests`, `questions`, `attempts`, `test_series`, `test_sections`, `test_questions`, `question_options`, `subscriptions`, `results`, `bookmarks`, `notifications`, etc.) are created by `postgres-helpers.js:initTables()` at application startup using `CREATE TABLE IF NOT EXISTS`.

## Table Ownership

### Tables Created by SQL Migrations (canonical)
| Migration | Tables Created |
|-----------|---------------|
| 000 | Extensions + baseline RPC functions |
| 000a | RLS policies for core tables |
| 001 | permissions, roles, user_roles, role_permissions, audit_logs, email_templates, navigation_config, coming_soon_features, ai_api_usage |
| 018 | test_attempts, daily_quizzes, daily_quiz_attempts, pro_passes, user_topic_stats, study_streaks, revision_queue, wrong_questions, banners, promotions, blogs, referrals, assets, enrollments, leaderboard_entries, messages, affiliates, study_groups, subject_videos, subject_pdfs, topic_tests |
| 019 | study_materials, test_category_series, quizzes, ca_quizzes, exam_yearly_data, exam_updates |
| 020 | question_versions (enhanced) |
| 021 | attempt_question_snapshots |
| 025 | user_answers, user_topic_performance, import_logs |
| 026 | subtopics, question_assets, topic_resources |
| 027 | test_templates, ai_generation_logs, question_search_index |
| 029 | transactions |
| 030 | current_affairs, community_comments, question_tag_map, attempt_section_scores, leaderboard_snapshots, email_templates (recreated) |
| 038 | doubt_replies, subject_relations, study_progress, user_history_archive |
| 039 | attempt_answers, passages, community_votes, content_moderation_queue, ai_logs |
| 041 | tags, test_state_machine |
| 043 | exam_rooms |
| 044-045 | live_tests |
| 046 | app_settings, navigation_menu, exam_seasons, coupons, promotions (recreated), discussions, study_groups (recreated), study_group_members, study_group_messages, referrals (recreated), achievement_definitions, user_achievements |

### Tables Created by `postgres-helpers.js:initTables()` (runtime)
These tables are created via `CREATE TABLE IF NOT EXISTS` at startup:

- `users`, `exams`, `stages`, `subjects`, `chapters`, `topics`
- `tests`, `questions`, `question_options`
- `test_series`, `test_categories`, `test_sections`, `test_questions`
- `attempts`, `question_attempts`, `attempt_events`
- `subscriptions`, `subscription_plans`, `subscription_features`
- `results`, `bookmarks`, `notifications`
- `doubts`, `practice_questions`, `practice_answers`
- `user_sessions`, `login_attempts`, `activity_logs`
- `leaderboards`, `faqs`, `testimonials`, `page_content`
- `platform_stats`, `quick_access`, `media`, `backups`
- `exam_info`, `ui_tag_configs`, `pyp_papers`, `pyp_attempts`
- `group_messages`, `group_posts`, `group_post_comments`, `group_post_likes`
- `user_achievements`, `achievements`

## Key Migrations That Modify Existing Tables

| Migration | Changes |
|-----------|---------|
| 024 | Re-adds audit_logs columns lost by 019 |
| 025 | Adds exam_id, subject_id, topic_id FKs to core tables |
| 028 | Adds topic_id to user_topic_stats |
| 031 | Adds is_active to attempts |
| 032 | Adds is_deleted, deleted_at, deleted_by to 70+ tables |
| 034 | Ensures is_read on notifications |
| 035 | Adds 40+ GIN indexes on JSONB columns |
| 036 | Adds CHECK constraints on status columns |
| 037 | Adds index on csrf_tokens.expires_at |
| 039 | Consolidates test_attempts → view, creates ENUM types |
| 040 | Adds users.full_name, fixes exam_seasons.exam_id type |
| 047 | Enables RLS on 80+ tables |
| 048 | Adds RLS policies for all tables |

## Important Notes

1. **Never drop `postgres-helpers.js:initTables()`** — it's the actual schema source for core tables
2. **Migrations are idempotent** — most use `IF NOT EXISTS` / `IF EXISTS` guards
3. **No down migrations exist** — manual rollback required
4. **`test_attempts` is a VIEW** — created by migration 039, not a real table
5. **`audit_logs` was dropped and recreated** — data loss risk if re-running migration 019
