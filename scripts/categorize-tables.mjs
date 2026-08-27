import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const reportPath = path.join(rootDir, 'scripts', 'full_db_missing_data_audit.json');
if (fs.existsSync(reportPath)) {
  const audit = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

  // Define domains
  const domains = {
    '1. Assessments & Questions (Core Engine)': [
      'tests', 'test_series', 'test_categories', 'test_category_series', 'test_sections', 
      'test_questions', 'questions', 'wrong_questions', 'question_versions', 'question_tag_map',
      'question_search_index', 'question_reports', 'question_patterns', 'question_learning_telemetry',
      'question_explanations_v2', 'question_bookmarks', 'question_attempts', 'question_assets',
      'question_approaches', 'pyp_papers', 'pyp_attempts', 'passages', 'live_tests', 'topic_tests',
      'test_templates', 'test_state_machine', 'test_attempts', 'quizzes', 'daily_quizzes',
      'daily_quiz_questions', 'daily_quiz_attempts', 'ca_quizzes', 'ca_quiz_attempts', 'practice_sessions',
      'practice_daily_sets', 'practice_answers', 'practice_streaks', 'practice_ai_cache'
    ],
    '2. Taxonomy & Knowledge Hierarchy': [
      'exams', 'exam_categories', 'exam_info', 'exam_rooms', 'exam_seasons', 'exam_static_content',
      'exam_updates', 'exam_yearly_data', 'stages', 'subjects', 'subject_units', 'subject_chapters',
      'subject_topics', 'subject_subtopics', 'subject_parts', 'subject_relations', 'nodes', 'concepts',
      'section_aliases', 'tags', 'tag_configs', 'ui_tag_configs', 'study_materials', 'subject_pdfs',
      'subject_videos', 'study_material_stats', 'study_progress', 'study_streaks'
    ],
    '3. User, Auth, Access & Subscriptions': [
      'users', 'user_sessions', 'user_roles', 'roles', 'permissions', 'role_permissions',
      'two_factor_secrets', 'login_attempts', 'csrf_tokens', 'subscriptions', 'subscription_plans',
      'subscription_features', 'pro_passes', 'promotions', 'coupons', 'payments', 'transactions',
      'affiliates', 'referrals'
    ],
    '4. Student Analytics & Mistake Vault': [
      'attempts', 'attempt_answers', 'attempt_events', 'attempt_question_snapshots', 'attempt_section_scores',
      'results', 'leaderboards', 'leaderboard_entries', 'leaderboard_snapshots', 'learner_mistake_vault',
      'learner_recommendation_feedback', 'learner_recommendations', 'learner_study_health', 'learner_topic_mastery',
      'topic_analytics', 'user_topic_stats', 'user_recommendations', 'user_history_archive',
      'user_fundamental_mastery', 'user_node_skill', 'user_achievements', 'achievements',
      'achievement_definitions', 'fundamental_skill_drills', 'revision_queue', 'certificates', 'bookmarks'
    ],
    '5. Community, Social & Discussions': [
      'discussions', 'discussion_replies', 'discussion_votes', 'doubts', 'doubt_replies',
      'group_posts', 'group_post_comments', 'group_post_likes', 'group_messages', 'study_groups',
      'study_group_members', 'study_group_messages', 'v_group_messages', 'community_comments',
      'community_votes', 'messages', 'current_affairs', 'blogs', 'testimonials', 'faqs'
    ],
    '6. System, AI, Audit & Infrastructure': [
      'ai_logs', 'ai_generation_logs', 'ai_messages', 'ai_conversations', 'activity_logs',
      'audit_logs', 'backups', 'banners', 'content_moderation_queue', 'dead_letter_jobs',
      'document_chunks', 'email_templates', 'embeddings', 'import_logs', 'knowledge_vault_items',
      'media', 'migration_progress', 'navigation_config', 'notifications', 'outbox_events',
      'page_content', 'platform_stats', 'prompt_templates', 'quick_access', 'schema_migrations',
      'schema_migrations_metadata', 'test_id_remap_backup', 'topic_resources', 'webhook_events',
      'assets', 'app_settings'
    ]
  };

  console.log('=== DOMAIN BREAKDOWN OF 162 TABLES ===\n');

  for (const [domainName, tbls] of Object.entries(domains)) {
    console.log(`\n======================================================`);
    console.log(`${domainName} (${tbls.length} tables)`);
    console.log(`======================================================`);
    
    let domainPopulated = 0;
    let domainEmpty = 0;
    let domainRows = 0;

    tbls.forEach(tName => {
      const info = audit.find(a => a.table === tName);
      if (info) {
        if (info.rowCount > 0) {
          domainPopulated++;
          domainRows += info.rowCount;
          console.log(`  🟢 ${tName.padEnd(30)} : ${String(info.rowCount).padStart(7)} rows`);
        } else {
          domainEmpty++;
          console.log(`  ⚪ ${tName.padEnd(30)} :       0 rows (Empty/Unused)`);
        }
      } else {
        console.log(`  ❓ ${tName.padEnd(30)} : Not in audit`);
      }
    });

    console.log(`--- Domain Total: ${domainPopulated} Populated, ${domainEmpty} Empty, ${domainRows.toLocaleString()} total rows ---`);
  }
}
