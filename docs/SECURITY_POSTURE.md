# TRSTPREP SECURITY POSTURE & THREAT MODEL

**Document Version**: 2.1.0  
**Effective Date**: 2026-11-10  
**Target Repository**: Trstprep V2.1  
**Classification**: Internal Technical Security Documentation  
**Compliance Standards**: OWASP ASVS Level 2, DPDP Act 2023 (India), ISO/IEC 27001 Annex A

---

## 1. Executive Summary & Security Philosophy

Trstprep is an enterprise-grade test preparation and ed-tech platform featuring interactive test engines, adaptive question banks, live proctoring, AI-assisted learning (Node Engine), student community discussion forums, and comprehensive administrative back-office capabilities.

The platform employs a **defense-in-depth architecture** built around five core security tenets:

1. **Source-First Verification**: Every security boundary must be enforced at the nearest trusted decision point in code, never deferred to ambient infrastructure or external proxies.
2. **Deny-by-Default (Fail-Closed)**: Authentication, authorization, RLS policies, and cache validations must reject requests unless explicit positive permission is demonstrated.
3. **Multi-Tenant Cryptographic Isolation**: Student personal information, test attempts, transactions, and private notes must be partitioned via Row Level Security (RLS) and database-level field encryption.
4. **Separation of Operational & User Roles**: Administrative systems require strict IP/origin restrictions, mandatory API keys, fine-grained RBAC, and tamper-proof audit trails distinct from student APIs.
5. **Regulatory Compliance & Transparency**: Adherence to the **Digital Personal Data Protection (DPDP) Act 2023** concerning user consent, data minimization, breach notification, and right to erasure.

---

## 2. System Architecture & Trust Boundaries

```
[ Public Internet / Untrusted Clients ]
              │
              ▼
   ┌───────────────────────┐
   │  Cloudflare / ALB     │ (SSL Termination, DDoS mitigation)
   └──────────┬────────────┘
              │
              ▼ [Boundary 1: Ingress & Inverted Headers]
   ┌───────────────────────┐
   │   Nginx Reverse Proxy │ (deploy/nginx/nginx.conf)
   │   - Rate Limiting     │
   │   - Security Headers  │ (HSTS, CSP, X-Frame-Options)
   │   - Real IP Mapping   │
   └──────────┬────────────┘
              │
              ▼ [Boundary 2: Application Perimeter]
   ┌─────────────────────────────────────────────────────────┐
   │                  Express 4 Backend                      │
   │  ┌───────────────────────────────────────────────────┐  │
   │  │ Public & Student Pipeline                         │  │
   │  │ - CSRF Validation (validateCsrfToken)             │  │
   │  │ - Session Auth (protect, httpOnly cookies)        │  │
   │  │ - HTML Sanitizer (DOMPurify/sanitizeHtml)         │  │
   │  └───────────────────────────────────────────────────┘  │
   │  ┌───────────────────────────────────────────────────┐  │
   │  │ Canonical Admin Pipeline (admin.js)               │  │
   │  │ - restrictAdminOrigin                             │  │
   │  │ - validateAdminApiKey                             │  │
   │  │ - protect -> admin -> adminLimiter                │  │
   │  │ - requireAdminPermission                          │  │
   │  │ - auditMiddleware (public.audit_logs)             │  │
   │  └───────────────────────────────────────────────────┘  │
   └──────────┬───────────────────────────────┬──────────────┘
              │                               │
              ▼ [Boundary 3: Async Queue]     ▼ [Boundary 4: Persistence]
   ┌───────────────────────┐       ┌───────────────────────────────┐
   │ Redis (BullMQ / PubSub│       │ PostgreSQL (Supabase)         │
   │ - Session Store       │       │ - Connection Pools (AsyncLS)  │
   │ - L2 Response Cache   │       │ - RLS (trstprep_app)          │
   │ - Socket.IO Adapter   │       │ - Shadow Encryption (pgcrypto)│
   └───────────────────────┘       └───────────────────────────────┘
```

### Trust Boundary Definitions

#### Trust Boundary 1: External Client to Nginx Ingress

- **Untrusted Actors**: Unauthenticated internet clients, automated scrapers, malicious actors attempting DDoS or injection.
- **Controls**: Nginx connection limits, request rate limiters (`api_limit: 30r/s`, `auth_limit: 5r/s`), reverse-proxy client IP attribution (`set_real_ip_from`), and unified security headers (`security-headers.conf`).

#### Trust Boundary 2: Public Traffic to Express Application

- **Actors**: Authenticated students, anonymous visitors, cross-origin web pages.
- **Controls**: Express CORS policies (`apps/backend/src/middleware/cors.middleware.js`), body parsers with bounded payloads, strict anti-CSRF token verification (`X-CSRF-Token` headers), JWT signature verification with cryptographic secrets, and HTML sanitization on student discussion inputs.

#### Trust Boundary 3: Student APIs to Administrative Subsystems

- **Actors**: Authenticated students attempting privilege escalation, low-privilege administrative staff attempting vertical escalation.
- **Controls**: Sub-router isolation (`apps/backend/src/api/routes/admin.js`), admin origin allowlisting (`restrictAdminOrigin`), private secret verification (`validateAdminApiKey`), fine-grained permission evaluation (`requireAdminPermission`), and mandatory audit logging (`auditMiddleware`).

#### Trust Boundary 4: Application Server to PostgreSQL Database

- **Actors**: Backend application services, background worker daemons.
- **Controls**: AsyncLocalStorage identity propagation (`app.current_user_id`, `app.is_admin`), Row Level Security (RLS) enforcement via non-owner role (`trstprep_app`), and pgcrypto symmetric encryption for student phone numbers and dates of birth.

---

## 3. Threat Model & Attack Surface Analysis

### 3.1 Cross-Site Request Forgery (CSRF) & Ambient Credential Risk

- **Threat**: Cross-origin websites induce an authenticated student's browser to execute state-changing actions (e.g. submitting active exam attempts, updating account profile, revoking sessions) by exploiting ambient browser cookie attachment.
- **Vulnerabilities Mitigated**:
  - `FINDING-BE-01`: Neutralization of CSRF validation by extracting candidate tokens from `req.cookies._csrf_token`.
  - `FINDING-BE-02`: Omission of `validateCsrfToken` across testing routers (`/api/tests`, `/api/attempt`, `/api/sessions`).
  - `FINDING-BE-08`: Path-prefix exemption in `csrf.middleware.js` matching relative paths and exempting admin payments and sessions.
- **Required Invariant**: Anti-CSRF tokens must strictly be extracted from non-ambient HTTP request headers (`X-CSRF-Token`) or explicit body parameters. Cookies must never serve as token verification candidates.

### 3.2 Client-Side Injection (DOM XSS & Redress)

- **Threat**: Stored or reflected injection of malicious scripts into the administrative interface, compromising administrator sessions, stealing API credentials, or injecting corrupted question data.
- **Vulnerabilities Mitigated**:
  - `FINDING-CLIENT-01`: Stored DOM XSS in `MathRenderer.jsx` due to sanitization ordering inversion and `DOMParser` entity decoding into `title.innerHTML`.
  - `FINDING-CLIENT-04`: Arbitrary origin iframe embedding and unsandboxed blob execution in `PDFViewer.jsx`.
  - `FINDING-CLIENT-06`: Unescaped filename injection into export print window.
- **Required Invariant**: DOMPurify (`sanitizeHtml`) must execute as the final operation prior to React DOM rendering. All untrusted iframes must enforce `sandbox="allow-scripts allow-same-origin allow-forms"`.

### 3.3 Administrative Privilege Escalation (RBAC)

- **Threat**: An operator possessing a low-level permission (such as `users:edit` for updating student profiles) accesses role configuration endpoints to assign wildcard `*` permissions to their own role.
- **Vulnerabilities Mitigated**:
  - `FINDING-CLIENT-03`: `RolePermissionsManager.jsx` gating role editing on `users:edit`.
  - `FINDING-BE-03`: Out-of-pipeline admin routes (`enrollments-admin.js`, `stages.js`, `fortspy.js`) bypassing `requireAdminPermission`.
- **Required Invariant**: Role and permission mutations require superadmin authority (`isSuper === true`). Callers cannot grant permissions exceeding their own assignment set.

### 3.4 Availability & Denial of Service (DoS)

- **Threat**: Unhandled promise rejections on database connection timeouts crashing the Node.js runtime, or unprompted client-side service worker reloads interrupting active exams.
- **Vulnerabilities Mitigated**:
  - `FINDING-BE-04`: 113 handlers acquiring `pool.connect()` outside `try/catch` triggering `fatalShutdown` in Express 4.
  - `FINDING-CLIENT-08`: Service worker `autoUpdate` triggering mid-session page reload in `apps/admin-panel`.
  - `FINDING-INFRA-04`: Single-bucket 30 req/s rate-limiting collapse due to missing `real_ip`.
- **Required Invariant**: All asynchronous route handlers must be wrapped in `asyncHandler` or manage database client lifecycle inside `try ... finally`.

---

## 4. Credential History & Git Repository Leaks Analysis

### 4.1 Historical Secrets in Repository Commits

An audit of git commit history identified three critical credential exposures in legacy revisions:

1. **Supabase Database Credentials & JWT Secrets**:
   - `apps/backend/.env` was committed in early revisions containing live Supabase `DATABASE_URL` (with superuser credentials), `JWT_SECRET`, `JWT_REFRESH_SECRET`, and Razorpay live merchant keys.
   - _Current Status_: The file is untracked in HEAD, but the sensitive strings persist in Git history object blobs (`.git/objects/`).
   - _Risk_: Anyone with repository clone access can recover database credentials and forge administrative JWT tokens.
2. **Third-Party AI Service Keys**:
   - A MiniMax API key was historically committed in `M3 Key.txt` (since deleted in HEAD).
3. **Legacy Database Seeds with Real PII**:
   - 528 rows of legacy `test_attempts` and 196 real Indian user profiles (names, mobile numbers, emails) were committed in early migration seed files.

### 4.2 Remediation & Scrub Protocol (Phase 0 Mandate)

- **Git History Scrub**: Execute `git filter-repo` or BFG Repo-Cleaner to permanently purge:
  ```bash
  git filter-repo --invert-paths --path apps/backend/.env --path "M3 Key.txt"
  ```
- **Cryptographic Credential Rotation Runbook**:
  1. Rotate Supabase PostgreSQL database passwords and update pool connection strings.
  2. Regenerate `JWT_SECRET` and `JWT_REFRESH_SECRET`, invalidating all legacy signed tokens.
  3. Rotate Razorpay Key Secret in the Razorpay Dashboard.
  4. Invalidate any committed AI provider keys (MiniMax, OpenRouter).
- **Active Guard Rails**:
  - `.gitignore`: Enforce `.env*` coverage excluding only `.env.example` templates.
  - `.husky/pre-commit`: Block any staged file matching `\.env` or high-entropy secret patterns.
  - CI `.github/workflows/data-guard.yml`: Automated CI step scanning every commit for credential patterns.

---

## 5. DPDP Act 2023 (India) Compliance & PII Notice Obligations

The **Digital Personal Data Protection (DPDP) Act 2023** imposes stringent statutory obligations on Data Fiduciaries operating in India regarding the collection, processing, and storage of digital personal data.

### 5.1 Historical Seed Data & Notice Obligations

- **Factual Context**: 196 real user identities (Indian citizen names, phone numbers, email addresses) were committed to historical git blobs in legacy test attempt fixtures.
- **Section 5 & 6 Obligation**: Under Section 5 of the DPDP Act, any Data Fiduciary processing personal data collected prior to or during system rollout must provide an explicit **Notice** to Data Principals detailing:
  1. The specific categories of personal data collected.
  2. The purpose for which the data is processed.
  3. The manner in which the Data Principal may exercise rights (access, correction, erasure).
  4. Contact details of the Data Protection Officer (DPO).
- **Corrective Action**:
  - Scrub all real user identities from git history.
  - Implement a formal DPDP Privacy Notice in `apps/frontend/src/pages/legal/PrivacyPolicy.jsx`.
  - Provide a self-service account deletion and data export endpoint (`DELETE /api/users/me/data`).

### 5.2 PII Shadow Column Encryption (`phone_enc`, `dob_enc`)

- Under the DPDP Act principle of data security safeguards, sensitive contact identifiers must not reside in plaintext in rest storage.
- **Current Defect (FINDING-DB-03)**: Triggers on `public.users` expect `app.pgcrypto_key` to encrypt `phone` and `dob` via AES-256 (`pgp_sym_encrypt`). Because connection pools omit setting this GUC, `phone_enc` is 0% populated across all 26 registered users.
- **Mandatory Control**:
  - Update `apps/backend/config/database-replicas.js` to set `app.pgcrypto_key` on all connection sessions when `DB_ENCRYPTION_KEY` is present.
  - Run database backfill migration encrypting all existing plaintext phone numbers and dates of birth.

---

## 6. Row Level Security (RLS) Posture & Staged Enforcement

### 6.1 Current RLS Limitations

PostgreSQL Row Level Security (RLS) policies exist across 84 public tables, but provide **zero active security protection** in the current production configuration due to two structural issues:

1. **Superuser / Table Owner Dormancy (FINDING-DB-02)**: The runtime pool connects as the `postgres` user. In PostgreSQL, table owners bypass RLS unless `FORCE ROW LEVEL SECURITY` is set.
2. **Fail-Open Policy Clauses (FINDING-DB-01)**: 43 table policies in `pg_policy` evaluate `OR (current_user_id_setting() IS NULL)`. Queries executed without setting `app.current_user_id` evaluate to `TRUE`, granting unrestricted access across all tenant records.

### 6.2 Staged RLS Enforcement Architecture (Migration 147 & Beyond)

To establish genuine multi-tenant isolation without breaking operational background workers, Trstprep implements a **staged 3-phase RLS enforcement architecture**:

```
Step 1: Migration 147 (Provisioning)
- Create low-privilege role: CREATE ROLE trstprep_app NOLOGIN;
- Grant DML privileges on public tables to trstprep_app.
- Staged, non-breaking rollout.

Step 2: Policy Hardening
- Alter all 43 policies: DROP clause 'OR (current_user_id_setting() IS NULL)'.
- Enable FORCE ROW LEVEL SECURITY on sensitive tenant tables:
  ALTER TABLE public.attempts FORCE ROW LEVEL SECURITY;
  ALTER TABLE public.two_factor_secrets FORCE ROW LEVEL SECURITY;
  ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;

Step 3: Operational Activation
- Set LOGIN and password on trstprep_app:
  ALTER ROLE trstprep_app WITH LOGIN PASSWORD 'strong_random_secret';
- Configure DATABASE_APP_URL=postgres://trstprep_app:...@.../postgres in backend environment.
- Backend connection pools prefer DATABASE_APP_URL over DATABASE_URL.
- Table owner privileges are completely revoked for application traffic.
```

---

## 7. HTTP Ingress & Browser Security Posture

### 7.1 Security Headers Architecture

Security headers mitigate entire classes of client-side browser attacks. In `deploy/nginx/nginx.conf`, header inheritance shadowing currently strips these protections (FINDING-INFRA-03). The hardened configuration standardizes header delivery via an included snippet across all locations:

```nginx
# /etc/nginx/security-headers.conf
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' wss: https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self';" always;
```

### 7.2 Reverse Proxy Real IP Resolution

When operating behind AWS Application Load Balancers, Cloudflare, or reverse proxies, Nginx must restore the true client IP to ensure accurate rate-limiting and access restriction:

```nginx
# deploy/nginx/nginx.conf
set_real_ip_from 10.0.0.0/8;
set_real_ip_from 172.16.0.0/12;
set_real_ip_from 192.168.0.0/16;
real_ip_header X-Forwarded-For;
real_ip_recursive on;
```

### 7.3 Cookie Configuration & Session Hygiene

- `token` (Authentication JWT): `HttpOnly; SameSite=Lax; Secure` in production.
- `refreshToken`: `HttpOnly; SameSite=Lax; Secure; Path=/api/auth/refresh`.
- `_csrf_token`: `SameSite=Lax; Secure; Path=/` (readable by JS to populate `X-CSRF-Token` headers; strictly rejected as an ambient candidate on the server).

---

## 8. Summary of Known Areas of Concern

| Area of Concern               | Threat / Risk                                   | Mitigating Control / Remediation                                         |
| ----------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| **Git History Secrets**       | Exposure of Supabase and Razorpay credentials   | `git filter-repo` scrub + credential rotation (REMEDIATION_PLAN Phase 0) |
| **Testing Route CSRF**        | Exam destruction & timer manipulation           | Mount `validateCsrfToken` on `/api/tests` and `/api/attempt` (Phase 0)   |
| **Admin DOM XSS**             | Admin session hijacking via MathRenderer        | Order fix (`format` -> `sanitize`) + text node assignment (Phase 1)      |
| **Unhandled DB Promises**     | 113 handlers crashing server process on DB blip | Wrap handlers in `try ... finally` or `asyncHandler` (Phase 1)           |
| **RLS NULL Bypass**           | Multi-tenant cross-tenant read/write            | Remove `OR current_user_id IS NULL` across 43 policies (Phase 2)         |
| **Supply Chain `proxy-addr`** | Rate limiter and IP allowlist spoofing          | Root `package.json` and `pnpm-workspace.yaml` override (Phase 1)         |
| **Nginx Header Shadowing**    | Clickjacking, MIME sniffing, HSTS drop          | Include `security-headers.conf` across all Nginx locations (Phase 3)     |
