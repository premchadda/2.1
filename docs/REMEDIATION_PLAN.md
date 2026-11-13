# TRSTPREP VULNERABILITY REMEDIATION ROADMAP

**Document Version**: 2.1.0  
**Effective Date**: 2026-11-10  
**Target Repository**: Trstprep V2.1  
**Classification**: Implementation & Remediation Tracking Roadmap  
**Tracking Status**: In Progress / Scheduled  
**Owner**: Multi-Agent Security Audit Team (`worker_m7_docs`, `orchestrator`)

---

## 1. Roadmap Architecture & Execution Principles

This remediation roadmap defines a prioritized, structured 4-phase execution plan to address all 31 confirmed security vulnerabilities identified during the comprehensive repository re-audit.

### Phase Prioritization Schema

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 0: Immediate Containment & Credential Remediation      │ (Hours 0 - 24)
│ - Git history purge (git filter-repo)                       │
│ - Live secret rotation (Supabase DB, JWT, Razorpay)         │
│ - Critical CSRF bypass & test engine protection             │
│ - Pro Pass unintentional subscription cancellation fix       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: High-Severity Architecture, Injection & Availability│ (Days 1 - 3)
│ - MathRenderer stored DOM XSS in admin panel                │
│ - Systemic DB connection pool crash (113 handlers)          │
│ - Critical supply-chain overrides (proxy-addr, follow-red.) │
│ - Admin pipeline convergence (retire out-of-pipeline routes)│
│ - RBAC role manager privilege escalation gate               │
│ - Backend container build & runtime config fix              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: Database Integrity, RLS & Regulatory Compliance    │ (Days 4 - 7)
│ - RLS fail-open policy removal (43 tables)                  │
│ - Operational activation of trstprep_app non-owner role     │
│ - FORCE ROW LEVEL SECURITY enablement                       │
│ - PII shadow encryption population (app.pgcrypto_key)       │
│ - DPDP Act 2023 Notice & privacy compliance                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: Infrastructure, Client Hardening & Defense-in-Depth│ (Days 8 - 14)
│ - Nginx security header inheritance (security-headers.conf) │
│ - Reverse proxy real IP resolution (real_ip)                │
│ - Environment secret ignore & pre-commit regexes            │
│ - Admin PDF Viewer iframe sandboxing                        │
│ - Multi-tab session synchronization race resolution         │
│ - CI/CD GITHUB_TOKEN permissions reduction & tool pinning   │
│ - Docker Compose service credential hardening               │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Phase 0: Immediate Containment & Critical Hotfixes

**Objective**: Eliminate active attack vectors that jeopardize authentication integrity, financial processing, exam attempts, or expose master credentials in version control history.

| Task ID | Finding ID | Vulnerability Title | Affected Module / File | Owner | Tracking Status | Verification Criteria |
|---|---|---|---|---|:---:|---|
| **T0.1** | `FINDING-BE-01` | Anti-CSRF Token Ambient Cookie Extraction | `apps/backend/src/middleware/csrf.middleware.js:437` | Backend Auth | **SCHEDULED** | Remove `req.cookies?._csrf_token`. Verify requests without `X-CSRF-Token` fail with 403. |
| **T0.2** | `FINDING-BE-02` | Unshielded Testing Engine & Session Routes | `apps/backend/src/app-port5001.js:1105, 1129, 1133` | Backend Routing | **SCHEDULED** | Mount `validateCsrfToken` on `/api/tests`, `/api/attempt`, `/api/sessions`. Verify cross-site POST/PUT rejected. |
| **T0.3** | `FINDING-BE-08` | Relative Path CSRF Exemption on Payments | `apps/backend/src/middleware/csrf.middleware.js:409-431` | Backend Billing | **SCHEDULED** | Scope exemptions strictly to `/api/webhooks/razorpay` via `req.originalUrl`. Admin payments require valid token. |
| **T0.4** | `FINDING-BE-09` | Pro Pass Revocation via CamelCase Mismatch | `apps/backend/src/api/routes/admin-users.js:116-133` | Admin API | **SCHEDULED** | Support snake_case `is_pro_user`. Administrative updates preserve active subscriptions. |
| **T0.5** | — | Git History Scrub of Leaked Credentials | Git repository object database (`.git/`) | DevOps / SecOps | **OPEN** | Run `git filter-repo --invert-paths` on `apps/backend/.env` and `M3 Key.txt`. Verify zero secret strings in commit history. |
| **T0.6** | — | Master Cryptographic Secret Rotation | Supabase, Razorpay, Backend Config | SecOps | **OPEN** | Rotate Supabase DB password, `JWT_SECRET`, `JWT_REFRESH_SECRET`, and Razorpay secret keys. |

---

## 3. Phase 1: High-Severity Architecture, Injection & Availability Fixes

**Objective**: Secure administrative execution contexts, eliminate denial-of-service risks, resolve supply-chain vulnerabilities, and guarantee container build integrity.

| Task ID | Finding ID | Vulnerability Title | Affected Module / File | Owner | Tracking Status | Verification Criteria |
|---|---|---|---|---|:---:|---|
| **T1.1** | `FINDING-CLIENT-01` | Stored DOM XSS in MathRenderer | `apps/admin-panel/src/shared/components/MathRenderer.jsx:75, 157` | Admin UI | **SCHEDULED** | Move `sanitizeHtml` to run *after* `formatExplanationTables`. Replace `title.innerHTML` with text node assignment. |
| **T1.2** | `FINDING-BE-04` | DB Pool Exhaustion Process Crash (113 Handlers) | `apps/backend/src/api/routes/*.js`, `apps/backend/src/app-port5001.js:1600` | Backend Core | **SCHEDULED** | Move `await pool.connect()` inside `try ... finally` or wrap handlers in `asyncHandler`. Node process survives pool saturation. |
| **T1.3** | `FINDING-INFRA-01` | Supply Chain `proxy-addr` IP Spoofing | `package.json:50-63`, `pnpm-workspace.yaml:11-23` | Root Tooling | **SCHEDULED** | Add `"proxy-addr": "^2.0.8"` to overrides. `pnpm audit` reports 0 critical advisories. |
| **T1.4** | `FINDING-INFRA-06` | Supply Chain `follow-redirects` Credential Leak | `package.json:50-63`, `pnpm-workspace.yaml:11-23` | Root Tooling | **SCHEDULED** | Add `"follow-redirects": "^1.16.2"` to overrides. |
| **T1.5** | `FINDING-BE-03` | Out-of-Pipeline Admin Route Bypasses | `apps/backend/src/app-port5001.js:1144`, `enrollments-admin.js` | Backend Admin | **SCHEDULED** | Retire `enrollments-admin.js`. Move `stages.js`, `fortspy.js`, `practice.js` admin routes inside `admin.js`. |
| **T1.6** | `FINDING-CLIENT-03` | Administrative RBAC Privilege Escalation | `RolePermissionsManager.jsx:71`, `ProtectedRoute.jsx:127` | Admin RBAC | **SCHEDULED** | Gate role creation/updates strictly on `isSuper` (`userPerms.includes("*")`). Prevent non-superadmin privilege grants. |
| **T1.7** | `FINDING-INFRA-02` | Broken Container Build Contexts | `apps/backend/Dockerfile:17`, `apps/frontend/Dockerfile:20` | DevOps | **SCHEDULED** | Add `COPY config/ ./config/` to backend Dockerfile. Update CI build context for workspace packages. Container boots clean. |

---

## 4. Phase 2: Database Integrity, RLS Hardening & Regulatory Compliance

**Objective**: Enforce multi-tenant Row Level Security, activate low-privilege database roles, populate PII shadow encryption, and achieve DPDP Act 2023 statutory compliance.

| Task ID | Finding ID | Vulnerability Title | Affected Module / File | Owner | Tracking Status | Verification Criteria |
|---|---|---|---|---|:---:|---|
| **T2.1** | `FINDING-DB-01` | RLS Fail-Open Policy Bypass via NULL Clause | `pg_policy` catalogs, Migration SQL | Database Admin | **SCHEDULED** | Execute DDL migration dropping `OR (current_user_id_setting() IS NULL)` across all 43 tables. Queries without GUC return 0 rows. |
| **T2.2** | `FINDING-DB-02` | Table Owner RLS Dormancy | `database-replicas.js:49`, PostgreSQL Roles | Database Admin | **SCHEDULED** | Provision password for `trstprep_app` (Migration 147), set `DATABASE_APP_URL`, and apply `FORCE ROW LEVEL SECURITY` on core tables. |
| **T2.3** | `FINDING-DB-03` | PII Shadow Encryption 0% Population | `database-replicas.js:159-169`, `trigger_users_pii_enc` | Backend DB / SecOps | **SCHEDULED** | Set `app.pgcrypto_key` in `applyIdentityGucs()`. Execute backfill script encrypting all plaintext user phone numbers and DOBs. |
| **T2.4** | — | DPDP Act 2023 Notice & Data Subject Rights | `apps/frontend/src/pages/legal/`, User API | Legal / Product | **SCHEDULED** | Publish DPDP Notice under Section 5. Deploy user self-service data export and deletion endpoints. |
| **T2.5** | `FINDING-BE-05` | Provisional Fail-Open Session Cache Injection | `apps/backend/src/middleware/auth.middleware.js:528` | Backend Auth | **SCHEDULED** | Remove 60s provisional cache allowance. Missing session rows immediately return 401 Unauthorized. |

---

## 5. Phase 3: Infrastructure, Client Hardening & Defense-in-Depth

**Objective**: Complete ingress hardening, resolve client lifecycle issues, secure continuous integration pipelines, and eliminate operational backup defects.

| Task ID | Finding ID | Vulnerability Title | Affected Module / File | Owner | Tracking Status | Verification Criteria |
|---|---|---|---|---|:---:|---|
| **T3.1** | `FINDING-INFRA-03` | Nginx Security Header Stripping | `deploy/nginx/nginx.conf:130-139, 208` | DevOps | **SCHEDULED** | Create `security-headers.conf` snippet and include across all location blocks. Verify HSTS, CSP, and X-Frame-Options on `/api`. |
| **T3.2** | `FINDING-INFRA-04` | Reverse Proxy Real IP Misattribution | `deploy/nginx/nginx.conf:12-14, 161-172` | DevOps | **SCHEDULED** | Configure `set_real_ip_from` and `real_ip_header X-Forwarded-For`. Verify `/metrics` inaccessible from public IPs. |
| **T3.3** | `FINDING-INFRA-05` | Gitignore & Pre-commit Environment Gaps | `.gitignore:22-30`, `.husky/pre-commit:3`, `data-guard.yml:54` | SecOps | **SCHEDULED** | Add `.env.*` to `.gitignore`. Update pre-commit hook regex. Staging `.env.development` is blocked by hook. |
| **T3.4** | `FINDING-CLIENT-04` | Admin PDF Viewer Iframe Injection | `apps/admin-panel/src/shared/components/common/PDFViewer.jsx:136` | Admin UI | **SCHEDULED** | Add `sandbox="allow-scripts allow-same-origin allow-forms"` to `<iframe>`. Restrict URLs to trusted backend asset origins. |
| **T3.5** | `FINDING-CLIENT-02` | Multi-Tab Session Wipe Race Condition | `apps/admin-panel/src/shared/lib/apiClient.js:90-116` | Admin UI | **SCHEDULED** | Remove `sessionStorage.removeItem` trigger from storage null event. Multi-tab workflows survive token rotation. |
| **T3.6** | `FINDING-INFRA-09` | Excessive Default CI Permissions | `.github/workflows/*.yml`, `ci.yml:90, 149` | DevOps | **SCHEDULED** | Add `permissions: contents: read` across all workflows. Pin Trivy action and Semgrep image tag (`1.98.0`). |
| **T3.7** | `FINDING-INFRA-07` | Unauthenticated Docker Compose Redis | `docker-compose.yml:240-274` | DevOps | **SCHEDULED** | Add `--requirepass ${REDIS_PASSWORD}` to Redis command. Require non-default Postgres password. |
| **T3.8** | `FINDING-INFRA-08` | Missing Docker Compose Environment Vars | `docker-compose.yml:38-47, 91-100` | DevOps | **SCHEDULED** | Add `env_file: - .env` to `backend-1` and `backend-2`. |
| **T3.9** | `FINDING-INFRA-10` | Database Backup Retention Pruning Defect | `deploy/backup-db.sh:18, 57` | DevOps | **SCHEDULED** | Add `umask 077` and append `-sun` suffix to Sunday backups. Weekly backups survive retention cleanup. |
| **T3.10** | `FINDING-INFRA-11` | Conflicting Admin API Key Guidance | `README.md:135` | Technical Docs | **SCHEDULED** | Delete `VITE_ADMIN_API_KEY` guidance from `README.md`. |
| **T3.11** | `FINDING-CLIENT-08` | Service Worker Auto-Reload in Admin Panel | `apps/admin-panel/vite.config.js:41` | Admin UI | **SCHEDULED** | Change `registerType` to `"prompt"`. Admin dashboard notifies rather than reloading automatically. |
| **T3.12** | `FINDING-BE-06` | Audit Log URL Query PII Retention | `apps/backend/src/middleware/audit.middleware.js:258` | Backend Audit | **SCHEDULED** | Strip query strings from `req.originalUrl` before recording `details.path`. |
| **T3.13** | `FINDING-BE-07` | Client IP Extraction via Raw Headers | `apps/backend/src/api/routes/phoneAuth.js:61` | Backend Auth | **SCHEDULED** | Standardize on `req.ip` rather than parsing `req.headers['x-forwarded-for']`. |
| **T3.14** | `FINDING-CLIENT-05` | Profile Banner CSS Injection | `apps/frontend/src/pages/dashboard/profile/ProfileHeader.jsx:52` | Frontend UI | **SCHEDULED** | Validate `user.banner` via `isSafeImageUrl()` and `encodeURI()`. |
| **T3.15** | `FINDING-CLIENT-06` | Leaderboard Export Filename Injection | `apps/frontend/src/pages/tests/Leaderboard.jsx:583` | Frontend UI | **SCHEDULED** | Wrap `${filename}` with `esc()` inside `printWin.document.write()`. |
| **T3.16** | `FINDING-CLIENT-07` | Unbounded File Uploads in Content Mgmt | `ContentManagement.jsx:108` | Admin UI | **SCHEDULED** | Add pre-flight file size checks (<= 50MB) before starting upload. |

---

## 6. Verification & Forensic Audit Sign-Off Rubric

Prior to certifying each milestone phase as complete, an independent Forensic Auditor must verify:

1. **Schema & Machine-Readable Findings Conformance**:
   - `node .agents/skills/security-audit/validate-findings.cjs security-findings.json` exits with `PASS: 31 findings valid`.
   - `security-findings.sarif` loads cleanly in SARIF viewers with 31 rules and 31 results.
2. **Database Integrity & RLS Verification**:
   - `node scripts/run-database-audit.js` runs with zero connection errors and reports:
     - 0 RLS policies with `IS NULL` bypass clauses.
     - `phone_enc` population rate > 0% (100% of encrypted rows populated).
     - Core tables reflect `FORCE ROW LEVEL SECURITY`.
3. **Application Build & Test Suites**:
   - `pnpm --filter @trstprep/backend test` passes with zero regressions.
   - `pnpm --filter @trstprep/admin-panel build` and `pnpm --filter @trstprep/frontend build` pass without syntax or ESLint errors.
4. **Supply Chain Hygiene**:
   - `pnpm audit --audit-level=high` reports zero high or critical advisories.
