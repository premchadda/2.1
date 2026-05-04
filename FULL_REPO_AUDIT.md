# 🔍 Trstprep V2.1 — Repository Audit — Remaining Items

**Date:** 2026-05-03  
**Status:** 17 of 21 issues fixed. **4 remaining items** require manual action or incremental refactoring.

---

## ⚠️ Requires Manual Action

### CRIT-01: Production Credentials — Rotate Secrets
**File:** [.env](file:///e:/Tech/Testprep/Trstprep%20V2.1/apps/backend/.env)  
**Severity:** 🔴 Critical

The `.env` contains live Supabase credentials and JWT secrets. Verify they were never committed to git history:

```bash
git log --all --full-history -- apps/backend/.env
```

If any results appear, **rotate immediately**:
1. Supabase Dashboard → Database → Reset password
2. Regenerate `JWT_SECRET` and `JWT_REFRESH_SECRET` using: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

---

## 🟠 Incremental Refactoring Needed

### HIGH-01: `admin.js` God File (294KB / 9,291 lines)
**File:** [admin.js](file:///e:/Tech/Testprep/Trstprep%20V2.1/apps/backend/src/api/routes/admin.js)

Too large to refactor in one pass. Extract one domain per session:
- `admin-categories.js` — test category CRUD + junction table logic
- `admin-users.js` — user management routes
- `admin-stages.js` — stage management

Several dedicated files already exist (`admin-tests.js`, `admin-questions.js`, `admin-sections.js`) — follow the same pattern.

---

### HIGH-03: `global.dbHelpers` Anti-Pattern (134+ locations)
**Files:** All modules under `src/modules/`

The app sets `global.dbHelpers = dbHelpers` in `app-port5001.js` and accesses it everywhere. New code should use ESM imports:

```javascript
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
```

Migrate files incrementally — many routes already use the import pattern correctly.

---

### HIGH-05: No Test Coverage (1 test file / 154 source files)
**File:** [__tests__/](file:///e:/Tech/Testprep/Trstprep%20V2.1/apps/backend/src/__tests__/)

Priority test targets:
1. **Auth flows** — login, register, token refresh, password reset
2. **CSRF lifecycle** — token generation, validation, rotation
3. **Payment webhooks** — Razorpay signature verification

## ✅ Resolved Issues (17/21)

| ID | Fix Summary |
|----|-------------|
| CRIT-02 | Audit logging re-enabled in `audit.middleware.js` |
| CRIT-03 | `JWT_REFRESH_SECRET` added to `.env` and `.env.example` |
| CRIT-04 | 12 SQL injection vectors parameterized across 3 files |
| HIGH-02 | `mongoose`, `lowdb`, `sqlite3` removed from `package.json` |
| HIGH-04 | Password hash logging redacted in `debug-user.js` |
| MED-01 | CSRF race condition fixed with 30s grace period |
| MED-02 | In-memory metrics caveat documented in `monitoring.js` |
| MED-03 | `<Toaster>` rendered in frontend `App.jsx` |
| MED-04 | Docker Compose `version` field removed |
| MED-05 | `apps/admin-panel/.env` added to `.gitignore` |
| MED-06 | Node 20 LTS upgrade across Dockerfile, `.nvmrc`, `package.json` |
| LOW-01 | `emailVerified` / `isEmailVerified` field mismatch fixed |
| LOW-02 | CSRF cleanup interval exported + `.unref()`'d |
| LOW-04 | Lockout audit standardized via `logAuditEvent()` |
| LOW-05 | Admin panel 404 shows error page instead of silent redirect |
| LOW-03 | Search performance improved by using SQL ILIKE with LIMIT/OFFSET |
| LOW-06 | Unused duplicate healthCheckHandler removed from monitoring.js |
