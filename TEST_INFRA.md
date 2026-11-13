# TEST_INFRA.md — Trstprep V2.1 E2E Test Harness & Execution Infrastructure

## 1. Test Philosophy & Design Principles

- **Opaque-Box Testing**: Tests interact solely through external boundaries (HTTP endpoints, database queries, browser DOM events, and CLI commands). Zero white-box access to private functions or monkey-patched internal modules.
- **Requirement-Driven**: Derived strictly from `ORIGINAL_REQUEST.md` across R1 (Security, Bug & Import Remediation), R2 (Dead Code Activation & Integration), and R3 (Hardcoded & Mock Page Synchronization).
- **Zero Mocking of Core Business Logic**: E2E test runs execute against real PostgreSQL schemas, genuine Express middleware chains, and true React/DOM component trees. Mocking is restricted strictly to external third-party integrations (e.g. Razorpay payment gateways, AWS SES emails, and OpenRouter AI upstream HTTP calls).
- **Idempotency & Isolation**: Every test suite manages its own state fixtures or executes within rollback transactions. Running a test suite twice in succession produces identical outcomes without database pollution or state leaks.
- **Deterministic Assertion**: Asynchronous operations employ explicit wait-for-condition polling rather than arbitrary sleep timers (`setTimeout`).

---

## 2. Feature Inventory (Mapping to Requirements R1, R2, R3)

The 27 features under test span the full scope of the system remediation, dead-code activation, and mock-data synchronization:

| #   | Feature Code | Feature Name                                 | Scope & Target Files                                                                              |  Req   | Tier 1 (Min 5) | Tier 2 (Min 5) | Tier 3 | Tier 4 |
| --- | :----------- | :------------------------------------------- | :------------------------------------------------------------------------------------------------ | :----: | :------------: | :------------: | :----: | :----: |
| 1   | F1           | Monorepo Import Integrity                    | Root, Apps & Packages (`scripts/check-package-imports.mjs`, `packages/shared-hooks/package.json`) |   R1   |       5        |       5        |   ✓    |   ✓    |
| 2   | F2           | Backend Jest & Test Reliability              | Backend Mocks & Savepoints (`postgres-helpers.js`, `execSavepoint`, import tests)                 |   R1   |       5        |       5        |   ✓    |   ✓    |
| 3   | F3           | Linter & Syntax Compliance                   | Monorepo ESLint & Syntax (`apps/backend`, `apps/frontend`, `apps/admin-panel`, `packages/*`)      |   R1   |       5        |       5        |   ✓    |   ✓    |
| 4   | F4           | Security Pipeline & Route Guarding           | Admin Pipeline & Auth Routes (`stages.js`, `fortspy.js`, `bulkImport.routes.js`, Nginx headers)   |   R1   |       5        |       5        |   ✓    |   ✓    |
| 5   | F5           | Audit Log Query Sanitization                 | Audit Middleware Query Redaction (`audit.middleware.js`, `req.originalUrl` sanitization)          |   R1   |       5        |       5        |   ✓    |   ✓    |
| 6   | F6           | DB Migrations & Schema Health                | Migrations 155+ & DB Audit (`run-database-audit.js`, 19 core tables, shadow encryption)           |   R1   |       5        |       5        |   ✓    |   ✓    |
| 7   | F7           | Question Notes API & Service                 | Backend `/api/notes` CRUD (`notes.js`, user-scoped notes, `question_notes` table)                 | R2, R3 |       5        |       5        |   ✓    |   ✓    |
| 8   | F8           | Deep Analytics Diagnostics API               | Backend `/admin/analytics/deep/diagnostics` (`admin-deep-analytics.js`, RBAC)                     | R2, R3 |       5        |       5        |   ✓    |   ✓    |
| 9   | F9           | Question Import History API                  | Backend `/admin/questions/import-history` (`admin-import.js`, audit log query)                    | R2, R3 |       5        |       5        |   ✓    |   ✓    |
| 10  | F10          | Fundamentals Drill History API               | Backend `/api/practice/fundamentals/history` (`practice.js`, session persistence)                 | R2, R3 |       5        |       5        |   ✓    |   ✓    |
| 11  | F11          | Dynamic Exam Shifts & Tests                  | Backend `exam.routes.js` dynamic tests query (removal of hardcoded mock shifts)                   |   R3   |       5        |       5        |   ✓    |   ✓    |
| 12  | F12          | Shared Hooks Package Export & Integration    | `packages/shared-hooks` exports (`useUndoRedo`, `useFormManager`, `useDraggableScroll`)           |   R2   |       5        |       5        |   ✓    |   ✓    |
| 13  | F13          | Frontend TestReview Activation               | `apps/frontend/src/pages/tests/TestReview.jsx` (route mounting & solution review flow)            |   R2   |       5        |       5        |   ✓    |   ✓    |
| 14  | F14          | Frontend PypsExam Activation                 | `apps/frontend/src/pages/pyps/PypsExam.jsx` (route mounting at `/pyps/exam/:examSlug`)            |   R2   |       5        |       5        |   ✓    |   ✓    |
| 15  | F15          | Frontend SocraticHintModal Activation        | `apps/frontend/src/pages/tests/components/SocraticHintModal.jsx` (3-tier hint progression)        |   R2   |       5        |       5        |   ✓    |   ✓    |
| 16  | F16          | Frontend PracticeSessionCanvas Activation    | `apps/frontend/src/pages/tests/components/PracticeSessionCanvas.jsx` (focus canvas practice mode) |   R2   |       5        |       5        |   ✓    |   ✓    |
| 17  | F17          | Frontend Exam Catalog Components             | `RelatedExams.jsx`, `Timeline.jsx`, `YearSelector.jsx` in exam catalog views                      |   R2   |       5        |       5        |   ✓    |   ✓    |
| 18  | F18          | Frontend Audio Explainer & Media Hook        | `useAudioExplainer.js` (speech synthesis) & `LazyImage.jsx` (intersection observer)               |   R2   |       5        |       5        |   ✓    |   ✓    |
| 19  | F19          | Frontend QuestionNotes Dynamic Sync          | `apps/frontend/src/shared/components/QuestionNotes.jsx` (live sync with `/api/notes`)             |   R3   |       5        |       5        |   ✓    |   ✓    |
| 20  | F20          | Frontend User Intelligence Sync              | XP summary, streak freeze, mistakes vault, daily quiz dynamic synchronization                     |   R3   |       5        |       5        |   ✓    |   ✓    |
| 21  | F21          | Admin AuditQuestionsView Activation          | `apps/admin-panel/.../AuditQuestionsView.jsx` (QA inspector in `QuestionsManager`)                |   R2   |       5        |       5        |   ✓    |   ✓    |
| 22  | F22          | Admin ImportHistoryModal Activation          | `apps/admin-panel/.../ImportHistoryModal.jsx` (wired to `BulkImportModal` & `adminAPI`)           | R2, R3 |       5        |       5        |   ✓    |   ✓    |
| 23  | F23          | Admin Content Hierarchy & Media Preview      | `ContentHierarchySidebar`, `ContentReader`, `PDFViewer`, `VideoPlayer`                            |   R2   |       5        |       5        |   ✓    |   ✓    |
| 24  | F24          | Admin VirtualizedTree & Settings Activation  | `VirtualizedTree.jsx` in Hierarchy & `settingsSchema.js` Zod validation in Settings               |   R2   |       5        |       5        |   ✓    |   ✓    |
| 25  | F25          | Admin BlogManager Route & Activation         | `BlogManager.jsx` mounted on `/blogs` in `apps/admin-panel/src/App.jsx`                           |   R2   |       5        |       5        |   ✓    |   ✓    |
| 26  | F26          | Admin DeepAnalytics Diagnostics Dynamic Sync | Tab 5 in `DeepAnalytics.jsx` dynamically bound to `/admin/analytics/deep/diagnostics`             |   R3   |       5        |       5        |   ✓    |   ✓    |
| 27  | F27          | Admin Role Privilege Escalation Guard        | `RolePermissionsManager.jsx` restricted strictly to super-admin (`isSuperPerms`)                  |   R1   |       5        |       5        |   ✓    |   ✓    |

---

## 3. Test Architecture & Directory Layout

```
tests/e2e/
├── runner.js                           # Master CLI test runner & reporter
├── harness/
│   ├── testContext.js                  # Assertion library, suite registry, report collector
│   ├── apiClient.js                    # HTTP client with JWT minters (Student, Admin, SuperAdmin)
│   ├── dbClient.js                     # Postgres client helper with transaction rollback support
│   └── domTester.js                    # DOM / React component testing helper using happy-dom / jsdom
├── fixtures/
│   ├── authTokens.js                   # Pre-signed and dynamic JWTs for various roles
│   ├── questionFixtures.js             # Sample questions with KaTeX formulas, options, explanations
│   ├── examFixtures.js                 # Exam categories, exam shifts, syllabus hierarchy
│   └── auditFixtures.js                # URL payloads with sensitive tokens, PII, and import batches
└── tiers/
    ├── tier1_contracts/                # 27 suites (Min 5 tests per feature F1-F27 = 135+ tests)
    │   ├── tier1_f1_monorepo_imports.test.js
    │   ├── tier1_f2_jest_mock_stability.test.js
    │   ├── tier1_f3_linter_syntax.test.js
    │   ├── tier1_f4_security_pipeline.test.js
    │   ├── tier1_f5_audit_sanitization.test.js
    │   ├── tier1_f6_db_migrations.test.js
    │   ├── tier1_f7_question_notes_api.test.js
    │   ├── tier1_f8_deep_analytics_api.test.js
    │   ├── tier1_f9_import_history_api.test.js
    │   ├── tier1_f10_fundamentals_drill_api.test.js
    │   ├── tier1_f11_dynamic_exam_shifts.test.js
    │   ├── tier1_f12_shared_hooks_exports.test.js
    │   ├── tier1_f13_frontend_test_review.test.js
    │   ├── tier1_f14_frontend_pyps_exam.test.js
    │   ├── tier1_f15_socratic_hint_modal.test.js
    │   ├── tier1_f16_practice_canvas.test.js
    │   ├── tier1_f17_exam_catalog_widgets.test.js
    │   ├── tier1_f18_audio_explainer_lazy_image.test.js
    │   ├── tier1_f19_question_notes_sync.test.js
    │   ├── tier1_f20_user_intelligence_sync.test.js
    │   ├── tier1_f21_admin_audit_questions.test.js
    │   ├── tier1_f22_admin_import_history_modal.test.js
    │   ├── tier1_f23_admin_content_media.test.js
    │   ├── tier1_f24_admin_virtualized_settings.test.js
    │   ├── tier1_f25_admin_blog_manager.test.js
    │   ├── tier1_f26_admin_deep_analytics_sync.test.js
    │   └── tier1_f27_admin_privilege_escalation.test.js
    ├── tier2_edge_cases/               # 27 suites (Min 5 tests per feature F1-F27 = 135+ tests)
    │   ├── tier2_f1_imports_boundaries.test.js
    │   ├── tier2_f2_mock_rollback_edge_cases.test.js
    │   ├── tier2_f3_linter_strictness.test.js
    │   ├── tier2_f4_security_attack_vectors.test.js
    │   ├── tier2_f5_audit_leak_evasion.test.js
    │   ├── tier2_f6_schema_drift_anomalies.test.js
    │   ├── tier2_f7_notes_security_idor.test.js
    │   ├── tier2_f8_analytics_edge_cases.test.js
    │   ├── tier2_f9_import_history_boundaries.test.js
    │   ├── tier2_f10_drill_history_anomalies.test.js
    │   ├── tier2_f11_shifts_edge_cases.test.js
    │   ├── tier2_f12_shared_hooks_boundaries.test.js
    │   ├── tier2_f13_review_edge_cases.test.js
    │   ├── tier2_f14_pyps_edge_cases.test.js
    │   ├── tier2_f15_socratic_boundaries.test.js
    │   ├── tier2_f16_canvas_boundaries.test.js
    │   ├── tier2_f17_catalog_boundaries.test.js
    │   ├── tier2_f18_audio_lazy_boundaries.test.js
    │   ├── tier2_f19_notes_sync_boundaries.test.js
    │   ├── tier2_f20_intelligence_boundaries.test.js
    │   ├── tier2_f21_audit_questions_boundaries.test.js
    │   ├── tier2_f22_import_history_resilience.test.js
    │   ├── tier2_f23_media_preview_security.test.js
    │   ├── tier2_f24_virtualized_settings_stress.test.js
    │   ├── tier2_f25_blog_manager_edge_cases.test.js
    │   ├── tier2_f26_diagnostics_edge_cases.test.js
    │   └── tier2_f27_privilege_escalation_attacks.test.js
    ├── tier3_cross_feature/            # 7 stateful pairwise cross-feature suites
    │   ├── tier3_pair1_notes_and_review.test.js
    │   ├── tier3_pair2_practice_and_gamification.test.js
    │   ├── tier3_pair3_import_and_audit_redaction.test.js
    │   ├── tier3_pair4_shifts_and_pyps.test.js
    │   ├── tier3_pair5_socratic_and_mistakes.test.js
    │   ├── tier3_pair6_diagnostics_and_sessions.test.js
    │   └── tier3_pair7_hooks_and_virtualized_tree.test.js
    └── tier4_user_journeys/            # 3 comprehensive real-world application user journeys
        ├── tier4_journey1_student_mastery.test.js
        ├── tier4_journey2_admin_curriculum_qa.test.js
        └── tier4_journey3_exam_enrollment_analytics.test.js
```

---

## 4. Test Runner Specifications & CLI Interface

### Command Usage

```bash
node tests/e2e/runner.js [options]
```

### Supported CLI Flags

- `--tier=1|2|3|4`: Run tests only from the specified tier.
- `--feature=F<N>`: Filter tests to a specific feature (e.g. `--feature=F1` or `--feature=F11`).
- `--all`: Execute all test suites across Tiers 1 through 4 (default behavior when no flags provided).
- `--bail`: Stop test execution immediately on the first failure.
- `--json`: Output structured JSON test execution report to `tests/e2e-report.json`.
- `--help`: Display available CLI options and usage documentation.

### Exit Code Contract

- `0`: All executed tests passed with 0 errors.
- `1`: One or more tests failed, or an unhandled exception occurred.

---

## 5. Test Harness Components

### 5.1 `testContext.js`

Provides test registration and execution primitives (`describe`, `test`, `it`, `beforeEach`, `afterEach`, `beforeAll`, `afterAll`) and assertion matchers (`expect(val).toBe()`, `.toEqual()`, `.toBeDefined()`, `.toBeNull()`, `.toBeGreaterThanOrEqual()`, `.toContain()`, `.toThrow()`, etc.). Collects durations, assertion counts, pass/fail status, and stack traces.

### 5.2 `apiClient.js`

Lightweight HTTP client with token minters for simulated roles:

- `.asAnonymous()`
- `.asStudent(userPayload)`
- `.asAdmin(adminPayload)`
- `.asSuperAdmin(superAdminPayload)`
  Automatically configures `Authorization: Bearer <token>`, `x-csrf-token`, and base URL (`http://localhost:5001` or active test server).

### 5.3 `dbClient.js`

PostgreSQL connection helper wrapping the database pool. Supports:

- Query execution with prepared statements
- Transaction isolation: `withTransaction(async (client) => { ... })` with automatic `ROLLBACK` for zero database pollution
- Table existence and schema inspection helpers

### 5.4 `domTester.js`

In-memory DOM rendering environment leveraging `jsdom` and virtual DOM primitives to verify React component lifecycle, props rendering, and event handlers headlessly without requiring a live browser.

---

## 6. Coverage Thresholds & Gate Criteria

- **Tier 1 (Contract & Sanity)**: Minimum 5 tests per feature (27 features × 5 = 135 tests minimum).
- **Tier 2 (Boundary & Corner Cases)**: Minimum 5 tests per feature (27 features × 5 = 135 tests minimum).
- **Tier 3 (Stateful Pairwise Cross-Feature Suites)**: 7 stateful interaction suites.
- **Tier 4 (Real-World End-to-End User Journeys)**: 3 multi-step comprehensive application journeys.
- **Total Minimum Test Cases**: 135 + 135 + 7 + 3 = 280 test cases.
- **Passing Gate Criteria**: 100% pass rate, exit code 0, 0 linter errors, 0 unhandled promise rejections.
