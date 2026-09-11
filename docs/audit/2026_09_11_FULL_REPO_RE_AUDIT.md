# TRSTPREP V2.1 — Comprehensive Repository Re-Audit Report

**Audit Date:** September 11, 2026  
**Auditor:** Antigravity Autonomous Agent  
**Baseline Git Commit:** `6f832a03` (Working Tree Verified)  
**Corpus Size:** 1,607 files · ~5,895,877 words · 15,341 graph nodes · 20,686 edges · 1,047 communities

---

## 1. Executive Summary & Readiness Scorecard

| Area                             |       Status       | Score (/10) | Key Evidence & Notes                                                                                                                                                                     |
| -------------------------------- | :----------------: | :---------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Build & Compilation**          |    🟢 **PASS**     |    10/10    | Vite production build for both `frontend` (59.68s) and `admin-panel` (23.17s) pass with 0 errors.                                                                                        |
| **Automated Test Suite**         |    🟢 **PASS**     |    10/10    | **3/3 packages pass (100%)**: Backend (76/76 suites, 680/680 tests), Frontend (26/26 files, 241/241 tests), Admin-panel (all vitest passed). Total **921+ automated tests green**.       |
| **Database Schema & Migrations** |    🟢 **PASS**     |    9/10     | **138/138 migrations** applied (`schema_migrations` verified). 164 live PostgreSQL tables. Primary tables populated: 45,178 questions, 44,993 test-questions, 493 tests, 1,779 sections. |
| **API & Route Integrity**        |    🟢 **PASS**     |    9/10     | Route validation passes 100%. Public endpoints correctly resolve live services; admin chain strictly enforced.                                                                           |
| **Security & Auth Posture**      |   🟡 **MONITOR**   |    8/10     | Full admin middleware chain enforced. PII encryption active (AES-256-GCM). DPDP history scrub / credential rotation tracked. 1 rate limiter gap on `/:id/submit-for-review`.             |
| **Code Quality & Architecture**  |  🟡 **TECH DEBT**  |    7/10     | 86 God modules (>800 lines); 92 duplicate function clusters across admin/frontend; unhandled async error handling in UI event handlers.                                                  |
| **UI/UX & Design System**        | 🟡 **ACCEPTABLE**  |   7.5/10    | 1,850 missing `dark:bg-*` parity classes; 1,566 unstyled button tags needing design tokens; responsive breakpoints needed on fixed containers.                                           |
| **Study Workflows & Analytics**  |   🟢 **HEALTHY**   |   8.5/10    | 85/100 score: Spaced repetition (100%), Weak Area Diagnostics (100%), Speed vs Accuracy (100%). Recommendation explainability can be improved.                                           |
| **End-to-End Workflows**         | 🟢 **OPERATIONAL** |   8.5/10    | W1 (Student Tests) ✅, W2 (Admin Management) ✅, W4 (Live Tests) ✅, W5 (Practice Lab) ✅, W3 (Payments) ⚠️ (Sandbox/Razorpay dual-mode).                                                |

---

## 2. Test & Build Execution Results

### 2.1 Production Builds

```bash
pnpm --filter trstprep-frontend build  --> ✓ Built in 59.68s (PWA precache 149 entries, 4.14 MB)
pnpm --filter trstprep-admin build     --> ✓ Built in 23.17s (PWA precache 84 entries, 3.11 MB)
```

- **Zero build errors**.
- Rollup/Vite code chunking operates correctly across both web clients.

### 2.2 Turbo Monorepo Automated Tests

```
 trstprep-backend: 76 passed suites, 680 passed tests (19.788s)
 trstprep-frontend: 26 passed files, 241 passed tests (56.15s)
 trstprep-admin:    Passed vitest run
 Tasks: 3 successful, 3 total (Time: 1m5s)
```

---

## 3. Database Schema & Live Data Audit

Audited via `scripts/run-database-audit.js` and `scripts/audit-all-tables-missing-data.mjs` against live Supabase PostgreSQL:

### 3.1 Schema & Migrations State

- **Applied Migrations**: **138** (spanning `000` through `138_practice_revision_pipeline_reconciliation.sql`).
- **Total Tables in Public Schema**: **164 base tables**.
- **Junction Foreign Keys**: Validated (`test_category_series`, `test_questions`, `tests`).
- **PII Encryption**: Active and validated (`encrypt_pii` / `decrypt_pii` using AES-256-GCM with `DB_ENCRYPTION_KEY`).
- **Vector Search Tuning**: HNSW indexes (`idx_embeddings_vector_hnsw`, `idx_question_search_vector_hnsw`) confirmed tuned (`m=32`, `ef_construction=200`).
- **Index Naming**: Migration 137 reconciled `idx_topics_subject` -> `idx_subject_topics_subject`.

### 3.2 Live Database Ground-Truth Counts (Key Tables)

| Table                  | Live Row Count | Columns | Status            |
| ---------------------- | :------------: | :-----: | ----------------- |
| `questions`            |   **45,178**   |   71    | Populated         |
| `test_questions`       |   **44,993**   |   13    | Synchronized      |
| `tests`                |    **493**     |   92    | Populated         |
| `test_sections`        |   **1,779**    |   40    | Populated         |
| `subject_subtopics`    |   **3,484**    |   17    | Populated         |
| `subject_topics`       |   **2,063**    |   26    | Populated         |
| `subject_chapters`     |    **553**     |   23    | Populated         |
| `subject_units`        |    **110**     |   14    | Populated         |
| `subjects`             |     **15**     |   23    | Populated         |
| `test_categories`      |     **32**     |   21    | Populated         |
| `test_category_series` |     **62**     |    3    | Populated         |
| `audit_logs`           |    **512**     |   13    | Active logging    |
| `user_sessions`        |    **292**     |   25    | Active            |
| `users`                |     **24**     |   45    | Active            |
| `attempts`             |     **14**     |   32    | Live records      |
| `results`              |     **15**     |   29    | Dual-write active |
| `schema_migrations`    |    **138**     |    3    | Up to date        |

---

## 4. Security & Access Control Findings (Redcell SAST)

### 4.1 Admin Route Security Chain

The admin router enforces the canonical defense-in-depth pipeline on all admin routes:
`restrictAdminOrigin -> validateAdminApiKey -> validateCsrfToken -> protect -> admin -> loadAdminPermissions -> requireAdminPermission -> auditMiddleware`

- Verified intact in `apps/backend/src/api/routes/admin.js` and sub-routers (e.g. `leaderboards-admin.js`).

### 4.2 Security Audit Action Items & Remediation

1. **[RESOLVED] Rate Limiter Applied on Test Review Submission**:
   - Location: [`apps/backend/src/modules/tests/test.controller.js:35`](file:///e:/Tech/Testprep/Trstprep%20V2.1/apps/backend/src/modules/tests/test.controller.js#L35).
   - Applied: `createRateLimiter("moderate")` (`testReviewLimiter`) attached to `POST /:id/submit-for-review`.
   - Verified: Redcell SAST scanner re-run confirmed 0 HIGH findings.
2. **[CWE-798] Local Secrets in `.env`**:
   - `apps/backend/.env` is ignored by git, but active rotation and Git history scrubbing (`git filter-repo`) per [SECURITY_CREDENTIAL_ROTATION_AND_DPDP_RUNBOOK.md](file:///e:/Tech/Testprep/Trstprep%20V2.1/docs/SECURITY_CREDENTIAL_ROTATION_AND_DPDP_RUNBOOK.md) should be executed prior to production release.

---

## 5. Code Quality & Refactoring Findings

Audited via `.agents/skills/code-quality-refactor-audit/scripts/audit_code_quality.js`:

### 5.1 Top 10 Monolithic God Components (>800 Lines)

| Rank | Component / File                                  | Lines | Recommended Decoupling                                  |
| :--: | ------------------------------------------------- | :---: | ------------------------------------------------------- |
|  1   | `apps/admin-panel/.../TestsManager.jsx`           | 3,423 | Extract SeriesWorkspace, TestFormModal, BulkModals      |
|  2   | `apps/admin-panel/.../SectionsManager.jsx`        | 2,707 | Extract SectionForm, SectionReorderGrid                 |
|  3   | `apps/admin-panel/.../ContentManagement.jsx`      | 2,607 | Split into Video, PDF, and Hierarchy sub-managers       |
|  4   | `apps/frontend/src/pages/tests/TestDetails.jsx`   | 2,591 | Extract TestHeader, SectionList, AttemptHistory         |
|  5   | `apps/backend/src/api/routes/practice.js`         | 2,574 | Split into sessions, analytics, wrong-questions, topics |
|  6   | `apps/frontend/src/pages/tests/TestInterface.jsx` | 2,555 | Separate QuestionCanvas, TimerBar, SubmissionModal      |
|  7   | `apps/admin-panel/.../CategoriesManager.jsx`      | 2,531 | Extract CategoryTree, CategoryModal, CategoryActions    |
|  8   | `apps/admin-panel/.../CurriculumBuilder.jsx`      | 2,524 | Decouple Unit/Topic drag-and-drop trees                 |
|  9   | `apps/frontend/src/pages/community/Community.jsx` | 2,401 | Extract PostFeed, GroupCard, DiscussionThread           |
|  10  | `apps/backend/.../postgres-helpers.js`            | 2,399 | Extract QueryBuilder, SchemaReflector, CacheLayer       |

### 5.2 Duplicate Utility Clusters

Common helper functions defined redundantly across multiple files:

- `getCategoryLabel()` / `getCategoryPathLabel()`: Found in 8 files across `admin-panel`.
- `refsFrom()`: Duplicated between `TestsManager.jsx` and `questionHelpers.js`.
- `formatRelativeTime()` and `getDeviceIcon()`: Duplicated between admin and frontend login modules.
- _Recommendation_: Centralize into `@trstprep/shared-config` or `shared/utils/`.

---

## 6. End-to-End Workflow Status

| Workflow                                 |     Status     | Verification Detail                                                                                                                                                                                                         |
| ---------------------------------------- | :------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **W1: Student Test-Taking**              |  🟢 **GREEN**  | Dual-write on submit (`attempt.service.js:346-372`) persists to both `attempts` and `results`. Public leaderboard reads `leaderboards` -> `results` -> `attempts` fallback chain. Normalization of answer indices verified. |
| **W2: Admin Test & Question Creation**   |  🟢 **GREEN**  | `syncTestQuestionsJunction` (`admin-questions.js:63-97`) inserts into `test_questions` on creation. Series, test, and section CRUD operational.                                                                             |
| **W3: Payments & Subscriptions**         | 🟡 **SANDBOX** | Live order creation and signature verification wired via Razorpay. Sandbox fallback present for local development without credentials. Plans load from `subscription_plans` table.                                          |
| **W4: Live Tests Flow**                  |  🟢 **GREEN**  | `/api/live-tests` public route is composed with `liveMockRoutes`. Real ranks computed from completed results without hardcoded stubs.                                                                                       |
| **W5: Practice Lab & Spaced Repetition** |  🟢 **GREEN**  | Taxonomy hierarchy drill-down (`subject_units` -> `subject_chapters` -> `subject_topics` -> `subject_subtopics`) backed by 45k+ questions. Spaced repetition queue and mistake vault integration active.                    |

---

## 7. Actions Executed & Verified

1. ✅ **Removed Stray Files**:
   - Deleted `apps/backend/1` (untracked command redirect artifact).
2. ✅ **Applied Rate Limiter on Test Review Endpoint**:
   - Attached `createRateLimiter("moderate")` (`testReviewLimiter`) to `POST /:id/submit-for-review` in [test.controller.js](file:///e:/Tech/Testprep/Trstprep%20V2.1/apps/backend/src/modules/tests/test.controller.js#L35).
   - Re-ran Redcell automated security scan; HIGH severity vulnerabilities reduced to 0. All 76 backend test suites / 680 tests passed.
3. ✅ **Knowledge Graph & REPO_BRAIN Synchronized**:
   - Rebuilt knowledge graph via `graphify update .` (15,361 nodes, 20,707 edges, 1,053 communities).
   - Ran `node scripts/sync-repo-brain.mjs` — verified all 58 spans up to date in [REPO_BRAIN.html](file:///e:/Tech/Testprep/Trstprep%20V2.1/docs/REPO_BRAIN.html) to maintain 100% AST freshness.
