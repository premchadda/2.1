# Pre-Deployment Checklist — Trstprep V2.1

## CRITICAL — Must complete before deploy

### Secrets (B1)
- [ ] `apps/backend/.env` rotated — see `docs/SECURITY_INCIDENT_2026-06-14.md`
- [ ] `DATABASE_URL` rotated in Supabase
- [ ] `JWT_SECRET` rotated (generates new 64-char hex; invalidates all user sessions)
- [ ] `JWT_REFRESH_SECRET` rotated
- [ ] `RAZORPAY_WEBHOOK_SECRET` rotated in Razorpay dashboard
- [ ] `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` set (added to .env.example)
- [ ] `VITE_GOOGLE_CLIENT_ID` set in apps/frontend/.env and apps/admin-panel/.env (no more 'dummy-client-id' fallback)
- [ ] `VITE_RAZORPAY_KEY_ID` set in apps/frontend/.env
- [ ] `GOOGLE_CLIENT_ID` set in apps/backend/.env
- [ ] All other secrets in `.env` rotated
- [ ] `.env` removed from git history (`git filter-repo` or BFG)
- [ ] CI check added: fail if `.env` ever committed (workflow: .github/workflows/no-env.yml)
- [ ] All team members pull the new secrets from a password manager

### Database (B2, B3, B5, H1, H4, H5, M1, M3, M5, M6)
- [ ] Run `pg_dump --schema-only` from CURRENT Supabase project and commit missing migrations 003-017 to `apps/backend/src/infrastructure/database/migrations/`
- [ ] Apply new migration `000_baseline_functions.sql` (creates 5 missing functions)
- [ ] Apply `000_enable_rls_policies.sql`
- [ ] Apply `030_create_missing_tables.sql` (6 missing tables + _orphaned column)
- [ ] Apply `031_add_is_active_to_attempts.sql` (B4 fix)
- [ ] Apply `032_standardize_soft_delete.sql` (M1 fix)
- [ ] Apply `033_reconcile_subtopics.sql` (M3 fix)
- [ ] Apply `034_rename_notifications_read.sql` (H4 fix)
- [ ] Apply `035_add_jsonb_gin_indexes.sql` (M5 fix)
- [ ] Apply `036_add_check_constraints.sql` (status column constraints)
- [ ] Apply `037_add_csrf_expires_at_index.sql`
- [ ] Apply `038_create_remaining_missing_tables.sql` (12 tables: app_settings, navigation_menu, exam_seasons, coupons, promotions, discussions, study_groups, study_group_members, study_group_messages, referrals, achievement_definitions, user_achievements)
- [ ] Verify all migrations idempotent by re-running

### Frontend env vars
- [ ] `VITE_GOOGLE_CLIENT_ID` set to real Google OAuth client ID (currently falls back to 'dummy-client-id')
- [ ] `VITE_SOCKET_URL` set to backend WebSocket URL
- [ ] `VITE_ADMIN_URL` set to admin panel URL
- [ ] `VITE_API_URL` set to backend API URL
- [ ] `VITE_FRONTEND_URL` set to frontend URL

### Backend env vars (in addition to .env)
- [ ] `NODE_ENV=production`
- [ ] `FRONTEND_URL` set to frontend domain
- [ ] `ADMIN_PANEL_URL` set to admin domain
- [ ] `ADMIN_API_KEY` set to strong secret
- [ ] CORS allowlist reviewed (no dev localhost ports in production)
- [ ] Auth rate limiter enabled (currently disabled in dev)

### Code cleanup (HIGH priority)
- [x] `Signup.jsx` @gmail.com filter removed
- [x] `GroupDetail.jsx` shows real Chat + Discussions (still relies on backend tables now created in 038)
- [x] `ExamInfoNew.jsx` hardcoded DEFAULT_CONTENT replaced with PLACEHOLDER_TEXT
- [x] `ExamInfoNew.jsx` hardcoded "Key Points" bullet list removed
- [x] `ExamInfoNew.jsx` hardcoded FAQ list now reads from `examData.faqs` (DB-driven)
- [x] `ExamInfoNew.jsx` hardcoded PYP year list now reads from API
- [x] `Profile.jsx` "Coming Soon" pills on Payment Methods removed (in two locations)
- [x] `Profile.jsx` "More languages coming soon" hint removed
- [x] `Profile.jsx` "More Features Coming Soon!" banner removed
- [x] `StudyMaterial.jsx` "popular" sort uses real views if available, falls back to content-depth and labels as "Featured"
- [x] `EmailTemplatesManager` test-send button enabled, calls /api/admin/email-templates/test (render-only) and shows rendered preview
- [x] `PromotionManager` and `QuizzesManager` demo toasts removed
- [ ] `ProtectedRoute` honors super_admin (frontend accepts only 'admin', admin panel accepts both)
- [ ] `SubscriptionPlansManager` polling reduced
- [x] `Login` redirects to /admin
- [x] `AuditLogViewer.jsx` deleted
- [x] `ExamSeasonsManager` backend now wired (table created in 038)
- [x] `ComingSoonManager` `/api/admin/coming-soon-config` endpoint exists and uses `app_settings` (table created in 038)
- [x] UnhandledRejection exits process in production

### Backend hardening
- [ ] `parseAssetId` deduplicated (single source of truth)
- [ ] `mapBulkRowToQuestionPayload` deduplicated
- [ ] `auth.middleware.js` isVerified default → false (not true)
- [ ] `csrf.middleware.js` memory fallback uses hashed key
- [ ] `uncaughtException` logs in production
- [ ] `unhandledRejection` exits in production (now wired in app-port5001.js)
- [ ] `/api/health` error message leak fixed
- [ ] Dead code `modules/tests/test.engine.routes.js` removed (moved to apps/backend/scratch/)
- [ ] Stub routes (testimonials, email-templates, roles, permissions, passages, backups) return 501 instead of fake data
- [ ] BACKUPS route returns 501 on serverless (VERCEL/AWS_LAMBDA/SERVERLESS=1) — no more failed pg_dump
- [ ] CORS dev origins removed for production
- [ ] `VITE_GOOGLE_CLIENT_ID` no longer falls back to 'dummy-client-id' (warns + disables Google button)

### Database hardening
- [ ] `attempts.is_active` column verified
- [ ] `_orphaned` column verified on tests/questions/test_series
- [ ] `subtopics` schema unified
- [ ] GIN indexes on JSONB columns
- [ ] CHECK constraints on status columns

## Post-deploy verification

- [ ] Sign up with a non-@gmail.com email works
- [ ] Google login works
- [ ] All 5 critical RPC functions callable: `SELECT update_updated_at_column(); SELECT log_audit_event(1, 'test', 'user', 1, 'desc'); SELECT update_study_material_counts(1);`
- [ ] All 6 missing tables exist: `\dt current_affairs community_comments question_tag_map attempt_section_scores leaderboard_snapshots email_templates`
- [ ] `attempts.is_active` filter works: `SELECT COUNT(*) FROM attempts WHERE is_active = true;`
- [ ] RLS policies exist: `SELECT * FROM pg_policies;`
- [ ] No .env in git: `git log --all --full-history -- apps/backend/.env`
- [ ] No "demo" toasts in admin panel
- [ ] No "Coming Soon" placeholders in critical user flows
- [ ] `npm run lint` passes
- [ ] `npm test` passes (where tests exist)
- [ ] No `Math.random()` in any page initial state
- [ ] No hardcoded `5 Lakh+` stats shown to users

## Rollback plan

If a critical issue is found post-deploy:
1. Revert via Supabase point-in-time recovery
2. Revert backend to previous container
3. Revert frontend CDN to previous build
4. Communicate to users via status page
5. Post-mortem within 24 hours
