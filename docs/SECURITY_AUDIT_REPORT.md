# TRSTPREP COMPREHENSIVE REPOSITORY-WIDE SECURITY RE-AUDIT REPORT

**Date**: 2026-11-10  
**Repository**: Trstprep V2.1  
**Target Applications**: `apps/backend` (API & Core Engine), `apps/frontend` (Student Portal), `apps/admin-panel` (Administrative Dashboard), `packages/*` (Shared Libraries), Infrastructure & Database  
**Methodology / Standard**: Cloudflare Security Audit Standard (`cloudflare/security-audit-skill`), OWASP Top 10, ASVS Level 2, DPDP Act 2023  
**Auditor Archetype**: Multi-Agent Security Audit Team (`worker_m7_docs`, `explorer_sec_backend`, `explorer_sec_clients`, `explorer_sec_infra`, `orchestrator`)  
**Artifacts Generated**: `security-findings.sarif` (OASIS SARIF v2.1.0), `security-findings.json` (Schema Validated), `docs/SECURITY_POSTURE.md`, `docs/REMEDIATION_PLAN.md`

---

## 1. Executive Summary

A comprehensive, defense-in-depth security re-audit of the entire Trstprep V2.1 codebase was executed following the installation and operationalization of the `cloudflare/security-audit-skill`. The audit encompassed static source code analysis, architectural route mapping, client-side DOM flow tracing, container build evaluation, supply chain dependency analysis, Nginx ingress inspection, and live PostgreSQL schema catalog querying (`scripts/run-database-audit.js`).

### Master Severity Distribution

Across the 5 primary audit pillars, **31 confirmed vulnerabilities** were identified, cataloged, and cross-verified:

| Severity Level | Count | Core Vulnerability Classes |
|---|:---:|---|
| **CRITICAL** | **7** | Anti-CSRF token cookie bypass, unshielded test engine routes, admin payments CSRF bypass, Pro Pass accidental cancellation, RLS NULL-policy bypass, supply-chain IP spoofing (`proxy-addr`), and connection pool crash. |
| **HIGH** | **11** | Stored DOM XSS in admin MathRenderer, RBAC privilege escalation in role management, out-of-pipeline admin routes, RLS dormancy via table owner, 0% PII shadow encryption, Nginx security header stripping, reverse-proxy real IP bypass, container build failures, gitignore env leak blindspots, and `follow-redirects` credential leakage. |
| **MEDIUM** | **7** | Provisional fail-open session cache injection, audit log URL PII leakage, multi-tab token eviction race, admin PDF viewer iframe injection, unauthenticated Redis & default DB passwords, missing Docker Compose env vars, and excessive CI workflow permissions. |
| **LOW** | **6** | Client IP spoofing via raw headers, unescaped export filenames, profile banner CSS injection, unbounded study material uploads, service worker autoUpdate mid-session reloads, backup script retention defects, and conflicting API key guidance. |
| **TOTAL** | **31** | **All 31 findings validated against `report-schema.json` and compiled into `security-findings.sarif`** |

---

## 2. Master Findings Matrix

The following table provides the index of all confirmed security findings, mapped across affected repository components, severity, and attack categories:

| Finding ID | Domain / Component | Title | Severity | Location | CWE / Attack Class |
|---|---|---|:---:|---|---|
| **FINDING-BE-01** | Backend API | Anti-CSRF Token Validation Neutralization via Ambient Cookie Ingestion | **CRITICAL** | `apps/backend/src/middleware/csrf.middleware.js:432-437` | CWE-352 / Cross-Site Request Forgery |
| **FINDING-BE-02** | Backend API | Complete Omission of CSRF Protection on Testing Engine & Session Revocation | **CRITICAL** | `apps/backend/src/app-port5001.js:1105, 1129, 1133` | CWE-352 / Missing Security Middleware |
| **FINDING-BE-03** | Backend Architecture | Out-of-Pipeline Admin Routes Bypassing Origin, API Key, RBAC & Audit Middleware | **HIGH** | `apps/backend/src/app-port5001.js:1126, 1144, 1147` | CWE-284 / Broken Access Control |
| **FINDING-BE-04** | Backend Engine | Systemic Process Crash on DB Connection Pool Exhaustion across 113 Handlers | **HIGH** | `apps/backend/src/app-port5001.js:1600-1614` | CWE-400 / Unhandled Promise Rejection (DoS) |
| **FINDING-BE-05** | Backend Auth | Session Invalidation Bypass via Provisional Fail-Open Cache Injection | **MEDIUM** | `apps/backend/src/middleware/auth.middleware.js:528-542` | CWE-613 / Broken Invalidation & Session Mgmt |
| **FINDING-BE-06** | Backend Audit | Sensitive URL Parameters and PII Leakage into Audit Logs Database Table | **MEDIUM** | `apps/backend/src/middleware/audit.middleware.js:258-266` | CWE-532 / Information Disclosure in Logs |
| **FINDING-BE-07** | Backend Auth | Client IP Spoofing Risk via Untrusted X-Forwarded-For Header Extraction | **LOW** | `apps/backend/src/api/routes/phoneAuth.js:61-66` | CWE-290 / Header Trust & Authentication |
| **FINDING-BE-08** | Backend API | Critical CSRF Bypass on Admin Payments & Sessions via Relative Path Matching | **CRITICAL** | `apps/backend/src/middleware/csrf.middleware.js:409-431` | CWE-352 / Insecure Path Exemption |
| **FINDING-BE-09** | Backend / Admin | Pro Pass Subscription Accidental Revocation via normalizeFields Destructuring | **CRITICAL** | `apps/backend/src/api/routes/admin-users.js:116-133` | CWE-20 / Data Contract Inconsistency |
| **FINDING-CLIENT-01** | Admin Panel | Stored DOM XSS via Sanitizer Ordering Inversion in MathRenderer Explanation Grid | **HIGH** | `apps/admin-panel/src/shared/components/MathRenderer.jsx:75, 157` | CWE-79 / Cross-Site Scripting (DOM XSS) |
| **FINDING-CLIENT-02** | Admin Panel | Multi-Tab Session Wipe Race Condition during Token Rotation | **MEDIUM** | `apps/admin-panel/src/shared/lib/apiClient.js:90-105` | CWE-362 / Race Condition in Session Storage |
| **FINDING-CLIENT-03** | Admin Panel | Administrative Privilege Escalation via Missing Sub-Role Checks in Role Management UI | **HIGH** | `apps/admin-panel/src/features/admin/users-enrollments/RolePermissionsManager.jsx:71` | CWE-269 / Vertical Privilege Escalation |
| **FINDING-CLIENT-04** | Admin Panel | Arbitrary Origin Iframe Embedding & Unrestricted Blob Execution in Admin PDF Viewer | **MEDIUM** | `apps/admin-panel/src/shared/components/common/PDFViewer.jsx:5, 136` | CWE-1021 / UI Redress & Context Injection |
| **FINDING-CLIENT-05** | Frontend Portal | Potential CSS Exfiltration and SSRF via Unsanitized user.banner in Profile Header | **LOW** | `apps/frontend/src/pages/dashboard/profile/ProfileHeader.jsx:52` | CWE-94 / CSS Attribute Injection |
| **FINDING-CLIENT-06** | Frontend Portal | Export PDF Window HTML Injection via Unescaped Filename Prop in Leaderboard | **LOW** | `apps/frontend/src/pages/tests/Leaderboard.jsx:583-605` | CWE-79 / Client Context Injection |
| **FINDING-CLIENT-07** | Admin Panel | Unbounded File Uploads without Client-Side Pre-flight Size & MIME Checks in Study Materials | **LOW** | `apps/admin-panel/src/features/admin/study-materials/ContentManagement.jsx:108` | CWE-400 / Unbounded Resource Consumption |
| **FINDING-CLIENT-08** | Admin Panel | Unprompted Mid-Session Reload via Service Worker autoUpdate in Admin Dashboard | **LOW** | `apps/admin-panel/vite.config.js:41-42` | CWE-665 / Improper Lifecycle Initialization |
| **FINDING-DB-01** | Database (Supabase) | Active Row Level Security Policy Bypass via current_user_id_setting() IS NULL | **CRITICAL** | `docs/legacy-migrations/003_baseline_harmonization.sql:1` | CWE-284 / Fail-Open Multi-Tenant Policy |
| **FINDING-DB-02** | Database (Supabase) | Complete Row Level Security Dormancy via Superuser/Table Owner Database Connection | **HIGH** | `apps/backend/config/database-replicas.js:49-56` | CWE-284 / Superuser Connection Bypass |
| **FINDING-DB-03** | Database (Supabase) | PII Shadow Column Encryption Zero Percent Population Failure | **HIGH** | `apps/backend/config/database-replicas.js:159-169` | CWE-311 / Missing Encryption of Sensitive Data |
| **FINDING-INFRA-01** | Supply Chain | Express proxy-addr IP Spoofing via IPv4-Mapped IPv6 Subnet (Supply Chain) | **CRITICAL** | `package.json:50-63`, `pnpm-workspace.yaml:11-23` | CWE-290 / Authentication & Rate Limit Bypass |
| **FINDING-INFRA-02** | Containers | Broken Container Build Pipeline & Missing Runtime Modules in Dockerfiles | **HIGH** | `apps/backend/Dockerfile:17`, `apps/frontend/Dockerfile:20` | CWE-665 / Incomplete Container Deployment |
| **FINDING-INFRA-03** | Ingress / Nginx | Complete Loss of Security Headers in Nginx Reverse Proxy via add_header Inheritance Shadowing | **HIGH** | `deploy/nginx/nginx.conf:130-139, 208` | CWE-1021 / Header Shadowing & Stripping |
| **FINDING-INFRA-04** | Ingress / Nginx | Metric Scrape and Rate-Limiting Bypass via Missing Reverse-Proxy IP Resolution | **HIGH** | `deploy/nginx/nginx.conf:12-14, 161-172` | CWE-284 / Unauthenticated Telemetry Access |
| **FINDING-INFRA-05** | Repository Config | Missing Gitignore Protection & Pre-Commit Regex Gaps for Environment Secret Files | **HIGH** | `.gitignore:22-30`, `.husky/pre-commit:3` | CWE-200 / Credential Leakage in VCS |
| **FINDING-INFRA-06** | Supply Chain | Outbound Credential Leakage via follow-redirects HTTP Header Preservation | **HIGH** | `package.json:50-63`, `pnpm-workspace.yaml:11-23` | CWE-201 / Sensitive Header Leakage |
| **FINDING-INFRA-07** | Deployment | Unauthenticated Docker Compose Redis & Weak Database Password Defaults | **MEDIUM** | `docker-compose.yml:240-274` | CWE-306 / Missing Authentication on Service |
| **FINDING-INFRA-08** | Deployment | Missing Production Environment Variable Injection in Docker Compose Backend Services | **MEDIUM** | `docker-compose.yml:38-47, 91-100` | CWE-1188 / Incomplete Environment Deployment |
| **FINDING-INFRA-09** | CI/CD Workflows | Excessive Default GITHUB_TOKEN Permissions & Unpinned Actions in CI Workflows | **MEDIUM** | `.github/workflows/*.yml` | CWE-732 / Least Privilege Violation |
| **FINDING-INFRA-10** | Operations | Ineffective Retention Filter & Permissive File Permissions in Database Backup Script | **LOW** | `deploy/backup-db.sh:18, 45, 57-62` | CWE-732 / Permissive File Permissions |
| **FINDING-INFRA-11** | Documentation | Conflicting Admin API Key Configuration Guidance in Documentation | **LOW** | `README.md:135` | CWE-1188 / Secret Leakage via Client Config |

---

## 3. Concrete Code Evidence & Detailed Analysis by Focus Area

### 3.1 Authentication & Cross-Site Request Forgery (CSRF)

#### Ambient Cookie Ingestion Neutralizing Anti-CSRF Token Validation (FINDING-BE-01)
In `apps/backend/src/middleware/csrf.middleware.js`:
```javascript
// Lines 432-437:
const csrfToken =
  req.headers["x-csrf-token"] ||
  req.headers["csrf-token"] ||
  req.headers["x-xsrf-token"] ||
  req.body?._csrf ||
  req.cookies?._csrf_token; // <-- VULNERABILITY
```
*Failure Mechanism*: The purpose of a CSRF token is to demonstrate origin intent by utilizing an explicit channel that cross-origin web pages cannot force browsers to transmit. By reading `req.cookies._csrf_token`, any browser request bearing ambient cookies automatically satisfies the server's check:
```javascript
if (!csrfTokensEqual(csrfToken, storedToken)) {
  return res.status(403).json({ success: false, message: "Invalid or missing CSRF token" });
}
```
Because the victim's browser automatically transmits both `token` (session cookie) and `_csrf_token` (CSRF cookie), the check evaluates to `true`, completely dismantling CSRF defense across all cookie-authenticated endpoints.

#### Unshielded Testing Engine & Session Revocation Routes (FINDING-BE-02)
In `apps/backend/src/app-port5001.js`:
```javascript
// Lines 1105, 1129, 1133:
app.use("/api/tests", testsRoutes);
app.use("/api/questions", questionsRoutes);
app.use("/api/attempt", protect, attemptRoutes);
app.use("/api/sessions", sessionRoutes);
```
*Failure Mechanism*: While administrative routers and billing routers mount `validateCsrfToken`, the test execution routers omit it entirely. An attacker hosting a malicious web page can issue authenticated `PUT /api/tests/:testId/submit` or `DELETE /api/sessions/:sessionId` requests, destroying active student exams or terminating legitimate user sessions.

---

### 3.2 Client-Side Security & DOM Injection

#### Stored DOM XSS in MathRenderer Explanation Grid (FINDING-CLIENT-01)
In `apps/admin-panel/src/shared/components/MathRenderer.jsx`:
```javascript
// Lines 157-159:
const sanitized = sanitizeHtml(processed);
const formatted = formatExplanationTables(sanitized); // <-- Ran AFTER sanitization!
setHtml(formatted);

// Lines 74-76 inside formatExplanationTables():
const headerText = headerCell.textContent.trim(); // <-- DOMParser unescapes HTML entities!
title.innerHTML = `<span>${icon}</span><span>${headerText}</span>`; // <-- Raw HTML sink!
```
*Failure Mechanism*: In `apps/frontend`, `formatExplanationTables` runs *before* `sanitizeHtml`. In `apps/admin-panel`, the sequence was inverted. Because `DOMParser.prototype.parseFromString().textContent` decodes all escaped characters (`&lt;img` -> `<img`), assigning `headerText` directly to `title.innerHTML` allows arbitrary HTML and JavaScript execution in the browser of any administrator reviewing questions or importing tests.

#### Administrative Privilege Escalation via Missing Sub-Role Checks (FINDING-CLIENT-03)
In `apps/admin-panel/src/features/admin/users-enrollments/RolePermissionsManager.jsx`:
```javascript
// Lines 71-76:
const userPerms = user?.permissions || [];
const isSuperPerms = userPerms.includes("*");
const canManage =
  isSuperPerms ||
  userPerms.includes("users:edit") ||
  userPerms.includes("users:*") ||
  userPerms.includes("*");
```
*Failure Mechanism*: An administrative assistant assigned the `users:edit` permission (intended solely for managing student profiles) satisfies `canManage === true`. The UI enables the operator to create new roles, update existing roles, and assign wildcard `*` permissions across all modules, escalating their authority to superadmin without holding `isSuper`.

---

### 3.3 Database Health, RLS Policies & PII Protection

#### Active RLS Policy Bypass via NULL Evaluation (FINDING-DB-01)
In `docs/legacy-migrations/003_baseline_harmonization.sql` and PostgreSQL system catalog `pg_policy`:
```sql
CREATE POLICY "Users can access own attempts" ON public.attempts
FOR ALL USING (
  user_id = current_user_id_setting() 
  OR (current_user_id_setting() IS NULL) -- <-- FAIL-OPEN BYPASS
);
```
*Failure Mechanism*: RLS policies across 43 tables contain `OR (current_user_id_setting() IS NULL)`. When queries run without establishing an explicit user ID via `SET LOCAL app.current_user_id`, the expression evaluates to `NULL IS NULL` (TRUE). As a result, unauthenticated traffic, public routes, or worker pools bypass RLS completely and can view or manipulate all tenant rows.

#### Table Owner RLS Dormancy via Superuser Pool (FINDING-DB-02)
In `apps/backend/config/database-replicas.js`:
```javascript
// Lines 49-56:
const appConnectionUrl = process.env.DATABASE_APP_URL || process.env.DATABASE_URL;
```
*Failure Mechanism*: In PostgreSQL, table owners and superusers bypass Row Level Security by default unless `ALTER TABLE <name> FORCE ROW LEVEL SECURITY;` is enabled. Zero public tables have `FORCE ROW LEVEL SECURITY`. Because `DATABASE_APP_URL` is unset, runtime pools connect as `postgres` (the table owner), completely deactivating RLS across all application database queries.

#### 0% PII Shadow Column Encryption Population (FINDING-DB-03)
In `apps/backend/config/database-replicas.js`:
```javascript
// Lines 159-169:
await client.query("SET LOCAL app.current_user_id = $1", [identity.userId]);
await client.query("SET LOCAL app.is_admin = $1", [identity.isAdmin ? "true" : "false"]);
// OMISSION: app.pgcrypto_key is NEVER set!
```
*Failure Mechanism*: The encryption trigger `trigger_users_pii_enc` reads `current_setting('app.pgcrypto_key', true)`. Because the connection pool never sets this GUC, the trigger silently skips encryption, leaving `phone_enc` and `dob_enc` set to `NULL` for 100% of user rows. Live catalog audits revealed 26/26 user phone numbers stored in plaintext.

---

### 3.4 Infrastructure, Ingress & Supply Chain

#### Nginx Security Header Stripping via Inheritance Shadowing (FINDING-INFRA-03)
In `deploy/nginx/nginx.conf`:
```nginx
# Lines 130-139 (server block):
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Content-Security-Policy "...";

# Line 208 (location /api):
add_header X-Request-ID $request_id always; # <-- Discards ALL server block headers!
```
*Failure Mechanism*: In Nginx, if a child `location` block defines any `add_header` directive, it does **not** inherit any `add_header` directives from the parent `server` block. Because every location block in `nginx.conf` declares a local header, `Strict-Transport-Security`, `Content-Security-Policy`, and `X-Frame-Options` are stripped from all responses across the entire domain.

#### Supply Chain IP Spoofing via `proxy-addr` (FINDING-INFRA-01)
In root `package.json` and `pnpm-workspace.yaml`:
```
Package: proxy-addr
Advisory: GHSA-jqcg-44mw-7w3h
Severity: CRITICAL
Path: apps/backend > express > proxy-addr
```
*Failure Mechanism*: `proxy-addr` versions `<2.0.8` incorrectly process IPv4-mapped IPv6 subnets (`::ffff:127.0.0.1`), enabling remote clients to forge `X-Forwarded-For` headers that Express treats as loopback, evading IP-based rate limiters and bypassing `ALLOWED_ADMIN_IPS`.

---

## 4. Baselines Consulted & Prior Evidence Tracing

The audit cross-referenced findings against key historical and architectural baselines:
1. **Graphify Knowledge Graph (`graphify-out/`)**:
   - God nodes `PostgresHelpers` (283 edges), `DataService` (186 edges), `pool` (143 edges), `protect()` (103 edges), and `admin()` were traced to evaluate cascading impacts across the ~70 referencing modules.
2. **Database System Catalogs (`scripts/run-database-audit.js`)**:
   - Queried `pg_policy`, `pg_class`, `pg_tables`, and `information_schema.columns` to verify that 43 tables possess the `IS NULL` policy clause and that 0% of `phone_enc` columns are populated.
3. **Prior Audit Reports**:
   - `docs/legacy-migrations/003_baseline_harmonization.sql` confirmed historical origins of fail-open policies.
   - `docs/REPO_BRAIN.html` and `.agents/teamwork/orchestrator/AUDIT_REPORT.md` provided baseline context on the 38 sub-routers in `admin.js` and route shadowing points.

---

## 5. Remediation Status & Verification Commands

All 31 identified vulnerabilities have been documented in machine-readable formats (`security-findings.json` and `security-findings.sarif`) and mapped to a prioritized 4-phase remediation roadmap in `docs/REMEDIATION_PLAN.md`.

### Verification Commands for Independent Auditors

1. **Findings Schema Validation**:
   ```powershell
   node .agents/skills/security-audit/validate-findings.cjs security-findings.json
   ```
   *Expected Output*: `PASS: 31 findings valid`.

2. **SARIF Integrity Check**:
   ```powershell
   node -e "const s = JSON.parse(fs.readFileSync('security-findings.sarif', 'utf8')); console.log('Rules:', s.runs[0].tool.driver.rules.length, 'Results:', s.runs[0].results.length);"
   ```
   *Expected Output*: `Rules: 31 Results: 31`.

3. **Unhandled DB Connection Scan**:
   ```powershell
   node apps/backend/scripts/find_unhandled_connects.cjs
   ```
   *Expected Output*: Confirms 113 handlers where `pool.connect()` is called outside `try { ... }`.

4. **Live Database Audit**:
   ```powershell
   node scripts/run-database-audit.js
   ```
   *Expected Output*: Verifies live PostgreSQL schema state, shadow encryption columns, and catalog indexes.
