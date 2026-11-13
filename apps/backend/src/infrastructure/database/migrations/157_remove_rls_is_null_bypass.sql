-- Migration 155: Remove active RLS IS NULL bypass from all 43 tables (SEC-02)
-- Hardens tenant isolation so unset user identity fails closed rather than failing open.

-- Table: achievements, Policy: achievements_admin_write
ALTER POLICY "achievements_admin_write" ON public."achievements" USING (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: affiliates, Policy: affiliates_self
ALTER POLICY "affiliates_self" ON public."affiliates" USING (((current_user_id_setting() = user_id) OR (current_is_admin() = true)));

-- Table: ai_conversations, Policy: ai_conversations_user_policy
ALTER POLICY "ai_conversations_user_policy" ON public."ai_conversations" USING ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: ai_messages, Policy: ai_messages_user_policy
ALTER POLICY "ai_messages_user_policy" ON public."ai_messages" USING (((EXISTS ( SELECT 1
   FROM ai_conversations c
  WHERE ((c.id = ai_messages.conversation_id) AND (((c.user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = c.user_id))))) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK (((EXISTS ( SELECT 1
   FROM ai_conversations c
  WHERE ((c.id = ai_messages.conversation_id) AND (((c.user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = c.user_id))))) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: audit_logs, Policy: audit_logs_user_policy
ALTER POLICY "audit_logs_user_policy" ON public."audit_logs" USING ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: certificates, Policy: certificates_user_policy
ALTER POLICY "certificates_user_policy" ON public."certificates" USING ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: dead_letter_jobs, Policy: dead_letter_jobs_service_role_policy
ALTER POLICY "dead_letter_jobs_service_role_policy" ON public."dead_letter_jobs" USING (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: discussion_replies, Policy: discussion_replies_author_write
ALTER POLICY "discussion_replies_author_write" ON public."discussion_replies" USING ((((author_id)::text = (auth.uid())::text) OR (current_user_id_setting() = author_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK ((((author_id)::text = (auth.uid())::text) OR (current_user_id_setting() = author_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: document_chunks, Policy: document_chunks_service_role_policy
ALTER POLICY "document_chunks_service_role_policy" ON public."document_chunks" USING (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: email_templates, Policy: email_templates_service_role_policy
ALTER POLICY "email_templates_service_role_policy" ON public."email_templates" USING (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: embeddings, Policy: embeddings_service_role_policy
ALTER POLICY "embeddings_service_role_policy" ON public."embeddings" USING (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: fundamental_skill_drills, Policy: fundamental_skill_drills_admin_write
ALTER POLICY "fundamental_skill_drills_admin_write" ON public."fundamental_skill_drills" USING (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: knowledge_vault_items, Policy: knowledge_vault_items_user_policy
ALTER POLICY "knowledge_vault_items_user_policy" ON public."knowledge_vault_items" USING ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: learner_mistake_vault, Policy: learner_mistake_vault_user_policy
ALTER POLICY "learner_mistake_vault_user_policy" ON public."learner_mistake_vault" USING ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: learner_recommendation_feedback, Policy: learner_recommendation_feedback_user_policy
ALTER POLICY "learner_recommendation_feedback_user_policy" ON public."learner_recommendation_feedback" USING ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: learner_recommendations, Policy: learner_recommendations_user_policy
ALTER POLICY "learner_recommendations_user_policy" ON public."learner_recommendations" USING ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: learner_study_health, Policy: learner_study_health_user_policy
ALTER POLICY "learner_study_health_user_policy" ON public."learner_study_health" USING ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: learner_topic_mastery, Policy: learner_topic_mastery_user_policy
ALTER POLICY "learner_topic_mastery_user_policy" ON public."learner_topic_mastery" USING ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: nodes, Policy: nodes_admin_write
ALTER POLICY "nodes_admin_write" ON public."nodes" USING (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: payments, Policy: payments_user_policy
ALTER POLICY "payments_user_policy" ON public."payments" USING ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: permissions, Policy: permissions_service_role_policy
ALTER POLICY "permissions_service_role_policy" ON public."permissions" USING (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: practice_answers, Policy: practice_answers_user_policy
ALTER POLICY "practice_answers_user_policy" ON public."practice_answers" USING ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: practice_daily_sets, Policy: practice_daily_sets_user_policy
ALTER POLICY "practice_daily_sets_user_policy" ON public."practice_daily_sets" USING ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: practice_sessions, Policy: practice_sessions_user_policy
ALTER POLICY "practice_sessions_user_policy" ON public."practice_sessions" USING ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: practice_streaks, Policy: practice_streaks_user_policy
ALTER POLICY "practice_streaks_user_policy" ON public."practice_streaks" USING ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: pro_passes, Policy: pro_passes_self
ALTER POLICY "pro_passes_self" ON public."pro_passes" USING (((current_user_id_setting() = user_id) OR (current_is_admin() = true)));

-- Table: prompt_templates, Policy: prompt_templates_service_role_policy
ALTER POLICY "prompt_templates_service_role_policy" ON public."prompt_templates" USING (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: question_approaches, Policy: question_approaches_user_policy
ALTER POLICY "question_approaches_user_policy" ON public."question_approaches" USING ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: question_bookmarks, Policy: question_bookmarks_user_policy
ALTER POLICY "question_bookmarks_user_policy" ON public."question_bookmarks" USING ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: question_explanations_v2, Policy: question_explanations_v2_admin_write
ALTER POLICY "question_explanations_v2_admin_write" ON public."question_explanations_v2" USING (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: question_learning_telemetry, Policy: question_learning_telemetry_user_policy
ALTER POLICY "question_learning_telemetry_user_policy" ON public."question_learning_telemetry" USING ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: question_reports, Policy: question_reports_user_policy
ALTER POLICY "question_reports_user_policy" ON public."question_reports" USING ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: role_permissions, Policy: role_permissions_service_role_policy
ALTER POLICY "role_permissions_service_role_policy" ON public."role_permissions" USING (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: roles, Policy: roles_service_role_policy
ALTER POLICY "roles_service_role_policy" ON public."roles" USING (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: section_aliases, Policy: section_aliases_admin_write
ALTER POLICY "section_aliases_admin_write" ON public."section_aliases" USING (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: subject_parts, Policy: subject_parts_admin_write
ALTER POLICY "subject_parts_admin_write" ON public."subject_parts" USING (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK (((current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: test_attempts, Policy: test_attempts_user_policy
ALTER POLICY "test_attempts_user_policy" ON public."test_attempts" USING ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: transactions, Policy: transactions_self
ALTER POLICY "transactions_self" ON public."transactions" USING (((current_user_id_setting() = user_id) OR (current_is_admin() = true)));

-- Table: two_factor_secrets, Policy: two_factor_secrets_user_policy
ALTER POLICY "two_factor_secrets_user_policy" ON public."two_factor_secrets" USING ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: user_activity_events, Policy: user_activity_events_user_policy
ALTER POLICY "user_activity_events_user_policy" ON public."user_activity_events" USING ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: user_fundamental_mastery, Policy: user_fundamental_mastery_user_policy
ALTER POLICY "user_fundamental_mastery_user_policy" ON public."user_fundamental_mastery" USING ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: user_node_skill, Policy: user_node_skill_user_policy
ALTER POLICY "user_node_skill_user_policy" ON public."user_node_skill" USING ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));

-- Table: user_roles, Policy: user_roles_user_policy
ALTER POLICY "user_roles_user_policy" ON public."user_roles" USING ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true))) WITH CHECK ((((user_id)::text = (auth.uid())::text) OR (current_user_id_setting() = user_id) OR (current_setting('role'::text, true) = 'service_role'::text) OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text) OR (current_is_admin() = true)));
