# Trstprep V2.1 — Security Posture

**Last updated:** 2026-08-23 · **Control tables FROZEN 2026-09-06** (normative; do not churn — re-verify against cited files, update dates only)
**Status:** Hardened (post-audit remediation) — verified against `apps/backend/src/app-port5001.js:1`, `middleware/auth.middleware.js`, `csrf.middleware.js`, `admin-routes-index.js`
**Previous audit:** `docs/UNIFIED_TRSTPREP_AUDIT.md` (Audit Date 2026-08-23) + `backend-audit-final-report.md` (3 CRITICAL, 5 HIGH fixed)

---

## Summary

This document records the security controls implemented after the unified audit (UNIFIED_TRSTPREP_AUDIT.md). All fixes follow **fail-closed** posture: on error, access is denied, not permitted.

> **Refresh Aug 23, 2026:** Verified 85 route files, 112 migrations, 60 admin components. Defense-in-depth chain intact. **Re-verified 2026-09-06:** full admin chain is `normalizeFields → restrictAdminOrigin → validateAdminApiKey → protect → admin → validateCsrfToken → loadAdminPermissions → requireAdminPermission → auditMiddleware` (`api/routes/admin.js:65-80`; CSRF + permission stages included — do not quote the shortened chain). Rate limiters reconciled to live config (see Rate Limiting section) and `responseCache` bypass for per-user routes confirmed.

---

## Authentication & Authorization

| Control                                    | Location               | Status |
| ------------------------------------------ | ---------------------- | ------ |
| Fail-closed registration feature check     | `auth.routes.js`       | ✅     |
| Fail-closed 2FA feature check              | `auth.controller.js`   | ✅     |
| Fail-closed optionalAuth (no await → deny) | `auth.middleware.js`   | ✅     |
| Timing-safe TOTP comparison                | `twoFactor.service.js` | ✅     |
| Rejection-sampled backup codes             | `twoFactor.service.js` | ✅     |
| Rate limiting on verify-email              | `auth.routes.js`       | ✅     |
| Rate limiting on register                  | `auth.routes.js`       | ✅     |
| Rate limiting on forgot-password           | `auth.routes.js`       | ✅     |
| Rate limiting on login (100/15min)         | `auth.routes.js`       | ✅     |
| Separate JWT_SECRET + JWT_REFRESH_SECRET   | `shared/config.js`     | ✅     |
| Immediate config validation (module load)  | `shared/config.js`     | ✅     |

## CSRF Protection

| Control                                                         | Location              | Status |
| --------------------------------------------------------------- | --------------------- | ------ |
| HttpOnly + SameSite=Lax cookies                                 | `auth.service.js`     | ✅     |
| DB-backed CSRF tokens (double-submit)                           | `csrf.middleware.js`  | ✅     |
| Only stateless routes exempt (login, register, forgot-password) | `csrf.middleware.js`  | ✅     |
| /auth/refresh + /auth/logout NOT exempt                         | `csrf.middleware.js`  | ✅     |
| Token cleanup every 5 minutes                                   | `csrf-token-store.js` | ✅     |
| logout + change-password require CSRF                           | `csrf.middleware.js`  | ✅     |

## Input Validation & SQL Injection

| Control                           | Location             | Status |
| --------------------------------- | -------------------- | ------ |
| Table name allowlist (80+ tables) | `base.repository.js` | ✅     |
| parseInt radix parameter          | `queryBuilder.js`    | ✅     |
| Whitelisted fields on POST/PUT    | All admin routes     | ✅     |
| Array size limits (200 items)     | `admin-bulk-ops.js`  | ✅     |

## Path Traversal & File Upload

| Control                                              | Location             | Status |
| ---------------------------------------------------- | -------------------- | ------ |
| sanitizePathPart strips `..`, dots, slashes          | `storageProvider.js` | ✅     |
| deleteLocal resolves path + validates within uploads | `storageProvider.js` | ✅     |
| createUploadMiddleware MIME type fix                 | `upload.js`          | ✅     |
| PDF MIME type properly resolved                      | `upload.js`          | ✅     |

## Rate Limiting

> Reconciled 2026-09-06 to live limiter config. Three sources, one effective policy —
> all env-overridable for ops tuning; all skip **verified** admins only (`isUserAdminRequest`
> inspects `req.user` set by `protect()` — origin/`jwt.decode` bypasses removed):
>
> | Limiter                                           | Live config (prod defaults)                                                                                                  | Scope / mount                                                                          |
> | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
> | `generalLimiter` (`app-port5001.js:402-416`)      | 1000 / 15min (`RATE_LIMIT_WINDOW_MS`, `GENERAL_RATE_LIMIT_MAX`)                                                              | All `/api`; skips `/health`, verified admins, non-prod `x-load-test`                   |
> | `authLimiter` (`app-port5001.js:436-449`)         | 20 / 15min (`AUTH_RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX`; non-prod 10000)                                              | `/api/auth` + `/api/auth/phone`; skips verified admins, `/health`, `GET /me` + `/csrf` |
> | `adminLimiter` (`app-port5001.js:451-463`)        | 500 / 15min (`ADMIN_RATE_LIMIT_*`; ×100 in dev)                                                                              | `/api/admin`, `/api/leaderboards/admin`, `/api/import`; skips verified admins (or dev) |
> | `uploadLimiter` (`app-port5001.js:656-666`)       | env-driven (`UPLOAD_RATE_LIMIT_*`)                                                                                           | `/api/admin/assets/upload` only                                                        |
> | `aiRateLimiter` (`middleware/aiRateLimiter.js`)   | Redis sliding-window: free 50/h, pro 500/h (`AI_FREE_HOURLY_LIMIT`, `AI_PRO_HOURLY_LIMIT`); fail-open without Redis (logged) | Per-user AI routes                                                                     |
> | Tier factory (`middleware/rateLimiterFactory.js`) | strict 5/min, moderate 30/min, relaxed 60/min, generous 1000/15min (×10 in dev)                                              | Opt-in per-route via `createRateLimiter(tier)`                                         |
>
> Note: `middleware/auth.middleware.js:406-416` defines an equivalent `authRateLimiter`
> (20/15min prod) — same prod values as `authLimiter`; consolidate to a single source on
> next middleware pass. The per-endpoint table from Aug 23 (login 100/15min etc.) is
> SUPERSEDED by the table above — do not cite it.

## Data Protection

| Control                            | Location                 | Status |
| ---------------------------------- | ------------------------ | ------ |
| Internal error messages not leaked | `sanitizeError.js`       | ✅     |
| createSafeError separates .message | `sanitizeError.js`       | ✅     |
| N+1 batch queries (notifications)  | `notificationService.js` | ✅     |
| N+1 question map caching           | `learningService.js`     | ✅     |
| Monitoring map memory cap (500)    | `monitoring.js`          | ✅     |

## Admin Security

| Control                                     | Location                | Status |
| ------------------------------------------- | ----------------------- | ------ |
| restrictAdminOrigin middleware              | `admin-routes-index.js` | ✅     |
| validateAdminApiKey middleware              | `admin-routes-index.js` | ✅     |
| superAdmin required for user status changes | `admin-users.js`        | ✅     |
| Cannot demote super_admin                   | `admin-users.js`        | ✅     |
| Mass assignment whitelists                  | All admin POST/PUT      | ✅     |
| Defense-in-depth middleware chain           | `admin-routes-index.js` | ✅     |

## WebSocket Security

| Control                          | Location       | Status |
| -------------------------------- | -------------- | ------ |
| Guest socket rejection           | `websocket.js` | ✅     |
| JWT auth on connect              | `websocket.js` | ✅     |
| Hardcoded localhost removed      | `websocket.js` | ✅     |
| Options variable shadowing fixed | `websocket.js` | ✅     |

## Known Limitations (Acceptable)

1. **Git history scrub** — User-handled via `git filter-repo` or BFG
2. **Shared TypeScript types** — Architecture change for future cycle
3. **PII data in git history** — User-handled per remediation runbook

---

## Verification Commands

```bash
# Lint all apps
cd apps/frontend && npm run lint
cd apps/admin-panel && npm run lint
cd apps/backend && npm run lint

# Build all apps
cd apps/frontend && npm run build
cd apps/admin-panel && npm run build

# Run backend tests
cd apps/backend && npm test
```

All apps must pass with 0 errors before deployment.

---

## Appendix — pre-remediation audit reports (moved 2026-09-06)

> The Aug-23 verbatim audit reports (auth pages, dashboard, exams, study, public, PYP,
> error pages, fix logs) moved to `docs/audit/archive/pre-remediation-frontend-audits.md`
> (frozen snapshot; index at `docs/audit/archive/README.md`). They are pre-remediation
> evidence, not live findings — do not cite severities from them against current code.
> Current truth: `docs/audit/D1_WORKFLOW_VERIFICATION.md`, `D2_HARDCODED_FAKE_DATA.md`,
> `D3_DEAD_DISCONNECTED.md` (re-verified 2026-09-06).
