-- =====================================================
-- Migration 053: Drop Redundant Owner Write Policies
-- Purpose: Drop `{table}_owner_write` policies on 11 tables
--          since they are logically identical to `{table}_access_policy`.
--
-- Idempotent: every DROP uses IF EXISTS.
-- Depends on: 000-052
-- =====================================================

BEGIN;

DROP POLICY IF EXISTS community_comments_owner_write ON community_comments;
DROP POLICY IF EXISTS community_votes_owner_write ON community_votes;
DROP POLICY IF EXISTS discussion_votes_owner_write ON discussion_votes;
DROP POLICY IF EXISTS discussions_owner_write ON discussions;
DROP POLICY IF EXISTS group_messages_owner_write ON group_messages;
DROP POLICY IF EXISTS group_post_comments_owner_write ON group_post_comments;
DROP POLICY IF EXISTS group_post_likes_owner_write ON group_post_likes;
DROP POLICY IF EXISTS group_posts_owner_write ON group_posts;
DROP POLICY IF EXISTS study_group_members_owner_write ON study_group_members;
DROP POLICY IF EXISTS study_group_messages_owner_write ON study_group_messages;
DROP POLICY IF EXISTS study_groups_owner_write ON study_groups;

INSERT INTO schema_migrations_metadata (migration_name, description, blocks_audit_findings)
VALUES
  ('053_drop_redundant_owner_write_policies.sql',
   'Drop redundant owner_write policies on 11 tables to resolve remaining multiple permissive policy warnings.',
   ARRAY['WARNING-multiple-permissive-policies'])
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
