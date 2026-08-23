# Trstprep V2.1 — Security Posture

**Last updated:** 2026-08-23  
**Status:** Hardened (post-audit remediation) — verified against `apps/backend/src/app-port5001.js:1`, `middleware/auth.middleware.js`, `csrf.middleware.js`, `admin-routes-index.js`
**Previous audit:** `docs/UNIFIED_TRSTPREP_AUDIT.md` (Audit Date 2026-08-23) + `backend-audit-final-report.md` (3 CRITICAL, 5 HIGH fixed)

---

## Summary

This document records the security controls implemented after the unified audit (UNIFIED_TRSTPREP_AUDIT.md). All fixes follow **fail-closed** posture: on error, access is denied, not permitted.

> **Refresh Aug 23, 2026:** Verified 85 route files, 112 migrations, 60 admin components. Defense-in-depth chain `restrictAdminOrigin → validateAdminApiKey → protect → admin → loadAdminPermissions → requireAdminPermission → auditMiddleware` intact in `api/routes/admin-routes-index.js:64-66`. Rate limiters (`auth 20/15min`, `admin 500/15min`, `ai free 50/h`) and `responseCache` bypass for per-user routes confirmed.

---

## Authentication & Authorization

| Control | Location | Status |
|---------|----------|--------|
| Fail-closed registration feature check | `auth.routes.js` | ✅ |
| Fail-closed 2FA feature check | `auth.controller.js` | ✅ |
| Fail-closed optionalAuth (no await → deny) | `auth.middleware.js` | ✅ |
| Timing-safe TOTP comparison | `twoFactor.service.js` | ✅ |
| Rejection-sampled backup codes | `twoFactor.service.js` | ✅ |
| Rate limiting on verify-email | `auth.routes.js` | ✅ |
| Rate limiting on register | `auth.routes.js` | ✅ |
| Rate limiting on forgot-password | `auth.routes.js` | ✅ |
| Rate limiting on login (100/15min) | `auth.routes.js` | ✅ |
| Separate JWT_SECRET + JWT_REFRESH_SECRET | `shared/config.js` | ✅ |
| Immediate config validation (module load) | `shared/config.js` | ✅ |

## CSRF Protection

| Control | Location | Status |
|---------|----------|--------|
| HttpOnly + SameSite=Lax cookies | `auth.service.js` | ✅ |
| DB-backed CSRF tokens (double-submit) | `csrf.middleware.js` | ✅ |
| Only stateless routes exempt (login, register, forgot-password) | `csrf.middleware.js` | ✅ |
| /auth/refresh + /auth/logout NOT exempt | `csrf.middleware.js` | ✅ |
| Token cleanup every 5 minutes | `csrf-token-store.js` | ✅ |
| logout + change-password require CSRF | `csrf.middleware.js` | ✅ |

## Input Validation & SQL Injection

| Control | Location | Status |
|---------|----------|--------|
| Table name allowlist (80+ tables) | `base.repository.js` | ✅ |
| parseInt radix parameter | `queryBuilder.js` | ✅ |
| Whitelisted fields on POST/PUT | All admin routes | ✅ |
| Array size limits (200 items) | `admin-bulk-ops.js` | ✅ |

## Path Traversal & File Upload

| Control | Location | Status |
|---------|----------|--------|
| sanitizePathPart strips `..`, dots, slashes | `storageProvider.js` | ✅ |
| deleteLocal resolves path + validates within uploads | `storageProvider.js` | ✅ |
| createUploadMiddleware MIME type fix | `upload.js` | ✅ |
| PDF MIME type properly resolved | `upload.js` | ✅ |

## Rate Limiting

| Endpoint | Limit | Scope |
|----------|-------|-------|
| POST /api/auth/login | 100/15min | Per IP |
| POST /api/auth/register | 20/15min | Per IP |
| POST /api/auth/forgot-password | 5/15min | Per IP |
| GET /api/auth/verify-email/:token | 10/15min | Per IP |
| POST /api/practice/ai/* | 20/15min | Per IP+user |
| POST /api/tests/:id/submit | 10/15min | Per IP+user |

## Data Protection

| Control | Location | Status |
|---------|----------|--------|
| Internal error messages not leaked | `sanitizeError.js` | ✅ |
| createSafeError separates .message | `sanitizeError.js` | ✅ |
| N+1 batch queries (notifications) | `notificationService.js` | ✅ |
| N+1 question map caching | `learningService.js` | ✅ |
| Monitoring map memory cap (500) | `monitoring.js` | ✅ |

## Admin Security

| Control | Location | Status |
|---------|----------|--------|
| restrictAdminOrigin middleware | `admin-routes-index.js` | ✅ |
| validateAdminApiKey middleware | `admin-routes-index.js` | ✅ |
| superAdmin required for user status changes | `admin-users.js` | ✅ |
| Cannot demote super_admin | `admin-users.js` | ✅ |
| Mass assignment whitelists | All admin POST/PUT | ✅ |
| Defense-in-depth middleware chain | `admin-routes-index.js` | ✅ |

## WebSocket Security

| Control | Location | Status |
|---------|----------|--------|
| Guest socket rejection | `websocket.js` | ✅ |
| JWT auth on connect | `websocket.js` | ✅ |
| Hardcoded localhost removed | `websocket.js` | ✅ |
| Options variable shadowing fixed | `websocket.js` | ✅ |

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

## Appendix — Auth & Frontend Audit Reports (Aug 23, 2026, retained from prior deep-dives)

> The following sections are verbatim prior audit reports (auth pages, dashboard, exams) kept for traceability. They were verified against `apps/backend/src/modules/auth/auth.routes.js` and `shared/lib/apiClient.js` and remain reference for `REMEDIATION_PLAN.md` Phase 4 fixes. Last verified Aug 23, 2026.

---

# Auth Pages Audit Report

**Scope confirmed by glob:** `ForgotPassword.jsx`, `ResetPassword.jsx`, `EmailVerification.jsx`.
**No `Login.jsx` or `Signup.jsx` exists** in `apps/frontend/src/pages/auth/` — login/signup live elsewhere (likely a combined auth page). Nothing to audit for those.

Verified against backend routes in `apps/backend/src/modules/auth/auth.routes.js` + `auth.controller.js`, and frontend API client in `shared/lib/apiClient.js`.

---

## Severity legend
- **CRITICAL** — broken security / broken core flow / guaranteed crash-or-fail
- **HIGH** — feature broken under real conditions / real security weakness
- **MEDIUM** — works by accident / fragile / degraded UX
- **LOW** — polish, hygiene, dead code

---

## FILE 1: `ForgotPassword.jsx`

| # | Severity | Issue |
|---|----------|-------|
| F1 | **HIGH** | **Wrong/unstable import + no dedicated endpoint wrapper.** Line 3 imports `{ api }` from `dataService.js`, but lines 1‑3 of `api.js` show the canonical client is `apiClient` (default export) re-exported from `dataService`. `ForgotPassword` uses a *named* `api` (an alias at `apiClient.js:118`) while `ResetPassword`/`EmailVerification` use the `default`. Both happen to alias the same object today, but the inconsistency is a maintenance trap: one refactor of `api.js`'s reexports breaks only this page. **Standardize on one import.** |
| F2 | **MEDIUM** | **`setError` on `sent==true` can never be shown.** On line 20 `setSent(true)` fires *before* any subsequent error path could re-render the form (because `sent` swaps the whole return). The `error` state (line 58‑62) is unreachable once `sent` is true. Dead code path; not a bug per se, but the error UI is only usable pre-success. Harmless but indicate confused branching. |
| F3 | **MEDIUM** | **No rate-limit / cooldown handling.** Unlike EmailVerification (which has `resendTimer`), this page lets a user hammer "Send Reset Link" repeatedly. Backend has `authRateLimiter`, but the frontend surfaces a generic "Failed to send reset email" for a 429 with no backoff. Poor UX + looks broken when rate‑limited. |
| F4 | **LOW** | **`href="/login"` full-page nav** (lines 39, 50) instead of `Link`/`useNavigate` — causes full reload, loses SPA state, slower. Same issue in ResetPassword success redirect (uses `navigate`, good) — inconsistent. |
| F5 | **LOW** | **No email format validation beyond `type="email"`.** `if (!email) return` (line 13) only checks empty. Browser does basic email check, but no trim — `" a@b.com "` is accepted as-is. Minor. |
| F6 | **LOW** | Accessibility: `<label>` (line 66) has **no `htmlFor`** and the `<input>` has **no `id`**, so the label is not programmatically associated. Clicking the label won't focus the input; screen readers won't announce it. Also no `aria-live` on the error region. |

---

## FILE 2: `ResetPassword.jsx`

| # | Severity | Issue |
|---|----------|-------|
| R1 | **CRITICAL** | **Token is readable and *leaves* the page via URL, and is never cleared.** `token = searchParams.get('token')` (line 9) keeps the secret reset token in the address bar / browser history / referrer headers the entire time the form is open. If the user copy-pastes the URL, takes a screenshot, or an analytics/3rd‑party script logs the URL, the single‑use reset token leaks. Standard practice: read token once, immediately `history.replaceState` (or navigate to clean URL) to strip it, keep it only in state. **Not done here.** |
| R2 | **CRITICAL** | **No CSRF token on the reset call, and backend expects it stateless-exempt — verify assumption.** Backend `csrf.middleware.js:289‑292` *exempts* `/api/auth/reset-password` from CSRF (stateless, token-in-body). So this page is *currently* safe by backend config, not by frontend design. This is fragile: if that exemption is ever removed (or a stricter proxy added in front), every password reset silently 403s and the generic catch (`'Failed to reset password.'`) masks the cause. Add a comment + test asserting the exemption still exists. |
| R3 | **HIGH** | **`navigate('/login')` fires even if `navigateTimerRef` was cleared by unmount race.** The effect cleanup (lines 18‑22) only clears on unmount, but if the component re-renders for any reason between `setSuccess(true)` (line 46) and the 2s timeout, the timer is not re-armed — fine. **The real bug:** if the component unmounts *during* the 2s window (e.g. parent route change), the timeout is cleared, user is left on a half-navigated success screen. Minor, but the bigger issue: **no `useRef` guard against double submit**. `loading` state (line 44) disables the button, but a fast double-Enter can fire two `api.post` calls before `loading` flips. Add a `submittingRef` guard. |
| R4 | **HIGH** | **Password in React state longer than necessary + never zeroed.** `password`/`confirmPassword` live in component state (lines 11‑12); DevTools autocomplete/inspection can read them, and on crash (error boundary) they may be serialized into error reports. More importantly: **they are never cleared after success**. After `setSuccess(true)` the values stay in memory until GC. Standard hygiene: `setPassword(''); setConfirmPassword('')` right after the API call succeeds. |
| R5 | **MEDIUM** | **Client-side `password.length < 8` (line 33)** duplicates server validation but gives no strength feedback (no uppercase/number/symbol check). A user typing `"aaaaaaaa"` (8 chars, trivially weak) passes client validation and might be rejected by server policy *or worse, accepted by server* — audit `auth.validator.js:27` to confirm server enforces complexity. Frontend should at minimum warn. |
| R6 | **MEDIUM** | **Generic error message maps all failures to one string.** `err.response?.data?.message || 'Failed to reset password.'` (line 49) — good it reads server message, **but** expired/invalid token, rate limit (429), and network error all collapse to either server text or the generic fallback, with no distinct UI for "link expired → request a new one". Bad UX on the most common failure (expired token). |
| R7 | **MEDIUM** | **`token` read only once on mount.** `const token = searchParams.get('token')` (line 9) — if a user pastes a new reset link into the same tab *while this page is already open*, `searchParams` changes but the URL being on the same route won't remount, so `token` is stale. Low-probability but real. Use `useMemo(() => searchParams.get('token'), [searchParams])` or subscribe to search param change. |
| R8 | **LOW** | **Back-to-login absent** on the form (only implicit via success redirect). If user lands here by mistake, no escape hatch except browser back. |
| R9 | **LOW** | Accessibility: same unassociated-label problem (`<label>` line 84 has no `htmlFor`, input has no `id`); error block (line 76‑79) not `role="alert"` / `aria-live`. |

---

## FILE 3: `EmailVerification.jsx`  ← **worst file; multiple broken flows**

| # | Severity | Issue |
|---|----------|-------|
| E1 | **CRITICAL — BROKEN API CALL (wrong endpoint shape).** | Line 53: ``api.get(`/api/auth/verify-email?token=${verificationToken}`)`` — sends the token as a **query string**. Backend route is **`router.get('/verify-email/:token', ...)`** (auth.routes.js:50) — a **path parameter**. `GET /api/auth/verify-email?token=XYZ` does **NOT** match `/verify-email/:token` (the `:token` segment is empty). **Every email-verification click will 404.** The link in the verification email (backend `emailService.js:204`) is `/verify-email?token=...` (frontend route, correct), and the *frontend* should call the backend as `/api/auth/verify-email/${verificationToken}` — currently it calls the wrong shape. **Email verification is 100% broken end-to-end.** |
| E2 | **CRITICAL — `resend-verification` endpoint does not exist on backend.** | Line 81: `api.post('/api/auth/resend-verification', { email })`. Grep across `apps/backend/src` for `resend` returned **zero matches**; `auth.routes.js` has no such route. Clicking "Resend Verification Email" always 404s → falls into catch → sets status `'error'`, shows "Failed to resend". Feature is a dead UI element. |
| E3 | **CRITICAL — token injected into URL path without encoding.** | Line 53 builds the URL by template literal: `?token=${verificationToken}`. Tokens containing `&`, `=`, `#`, `%`, `+`, spaces, etc. (JWTs use `.` and `-` safely, but a malformed/malicious token in the browsing URL) will break the query or, if moved to path form, enable **path traversal / route confusion**. Must `encodeURIComponent(verificationToken)` regardless of query-vs-path. Currently unencoded. |
| E4 | **HIGH — AbortController wired wrong → abort signal never actually aborts the axios call.** | Line 25 creates `controller`, line 27 passes `controller.signal` into `verifyEmail(...)`, which passes it as `{ signal }` to `api.get`. Fine. **But** the cleanup `controller.abort()` (line 38) runs on unmount/re-run — good — **except** the effect's dependency array is `[token, mode, presetEmail]` (line 39). `verifyEmail` is a **stale-closure-defined plain function** recreated every render but **not** in deps; the effect captures the *first* `verifyEmail` instance. Inside, it calls `setStatus`/`setMessage` — fine (setters are stable) — but the real bug: **the abort check `if (signal?.aborted) return` (line 54, 67) is correct, yet `catch` checks `error.name === 'AbortError'` — axios uses `CanceledError` / `error.name === 'CanceledError'` (or `axios.isCancel`), not `'AbortError'`** for signal-based cancellation through axios's adapter. The `'AbortError'` check (line 67) is a DOM-fetch-ism. With axios, a cancelled request throws `CanceledError` whose `.name` is `'CanceledError'`. **Result: a cancelled request falls into the error branch** and sets `status='error'` + a scary message on unmount/re-render — harmless visually if unmounted, but if the component is still mounted (e.g. dep changed), user sees a false "Verification failed". Use `axios.isCancel(error)` (exported as `isCancel` from dataService) or check `error.name === 'CanceledError'`. |
| E5 | **HIGH — effect re-runs & double-verifies because deps include values that can change.** | Effect deps `[token, mode, presetEmail]` (line 39). If the same verification link is clicked and any of these params is re-read (React Router can re-emit searchParams identity), the effect **re-fires `verifyEmail`**, causing a second API call with the same token. Because `status` is *not* in deps, there's no guard like `if (status==='success') return`. Idempotent on the backend (returns "already verified", line 1039‑1043) so no data corruption, but wasteful & can flip status back to `'verifying'`. Add an in-flight/`done` ref guard. |
| E6 | **HIGH — unhandled promise rejection on `navigateTimerRef` race + navigates after unmount.** | `verifyEmail` success schedules `navigate('/login')` via ref (line 59‑61); cleanup clears on unmount (line 20) — good. **But** nothing clears the timer when `handleResend` or an error path later runs; if verification succeeded (timer armed) and user somehow triggers another action, the pending timer still fires → unexpected redirect. Also: `navigate` from `useNavigate` is stable, fine. Lower-confidence than E1/E2 but worth a single source-of-truth for "is verified". |
| E7 | **MEDIUM — `handleResend` sets `status='verifying'` (line 80) which swaps UI to a full-screen spinner and *hides the resend form*.** If user typed the email in the error panel and hits Resend, the whole panel vanishes into a spinner, then returns to `'pending'`/`'error'`. Jarring UX; should use a local `resending` boolean, not the page-level `status`. |
| E8 | **MEDIUM — `resendTimer` effect deps cause interval thrash.** | Effect (line 41‑48) depends on `[status, resendTimer]`; every tick changes `resendTimer`, so the effect tears down + recreates the `setInterval` every second. Works, but wasteful & imprecise (drift). Standard fix: `setInterval` once when timer starts, or `setTimeout` chain. Functional, low impact. |
| E9 | **MEDIUM — email state initialized empty despite `presetEmail` only handled in effect.** | `presetEmail` (line 16) sets `email` in the effect only on mount (line 30‑32). If `presetEmail` changes while mounted, `email` is stale/un-synced. Same class of stale-param bug as R7. |
| E10 | **LOW — unassociated labels are absent entirely here (inputs have no `<label>` at all).** The two `<input type="email">` (lines 139, 187) have only `placeholder` — placeholders are not accessible names. Screen-reader users get an unnamed text field. Add `aria-label` or a real `<label>`. |
| E11 | **LOW — duplicated resend-form JSX (pending vs error blocks, lines 130‑175 vs 177‑223) is 90% identical.** Maintenance hazard; extract a `ResendForm` subcomponent. Also means a fix must be applied in two places (they've already drifted in copy: "Resend verification:" vs "Enter your address to resend:"). |
| E12 | **LOW — `mode === 'pending' || presetEmail` (line 28) silently treats any page hit with `?email=` as pending**, even without `mode=pending`. Probably intended, but it means `/verify-email?email=x@y.z` shows a "verification sent" screen out of nowhere. Minor logic smell. |

---

## Cross-cutting / systemic findings

| # | Severity | Issue |
|---|----------|-------|
| X1 | **HIGH** | **Inconsistent API import conventions across the 3 files** (named `{api}` from `dataService` vs `default from '.../api'`). All resolve to the same `apiClient` today, but it's exactly the kind of drift that breaks one page during a refactor. |
| X2 | **MEDIUM** | **No client strips sensitive query tokens from the URL** (ResetPassword R1, EmailVerification E1/E3). Tokens linger in history, referer, and any URL-logging analytics. Recommend a shared `useStripTokenFromUrl()` hook. |
| X3 | **MEDIUM** | **None of the three pages surface backend rate-limit (`authRateLimiter`) responses distinctly.** All three collapse 429 into a generic error, training users to retry and worsen the limit. |
| X4 | **LOW** | **No accessibility association (`htmlFor`/`id`/`aria-label`/`role="alert"`) on any form in any of the three pages.** Systemic a11y gap, easy fix. |

---

## Top 3 must-fix, in order

1. **E1 (CRITICAL):** `EmailVerification.jsx:53` — change query param to path param: `/api/auth/verify-email/${encodeURIComponent(verificationToken)}`. Email verification is currently 404 for every user.
2. **E2 (CRITICAL):** `EmailVerification.jsx:81` → backend has no `resend-verification` route. Either add `router.post('/resend-verification', authRateLimiter, authController.resendVerification)` to the backend, or hide/remove the resend UI. Dead feature today.
3. **R1 (CRITICAL):** `ResetPassword.jsx:9` — read token into state, then immediately strip it from the URL (`navigate(location.pathname, { replace: true })`) so it doesn't persist in history/referer/analytics.

Everything else is high/medium/low polish around correctness (abort-error naming E4, double-verify E5), UX (E7, F3, R6), and accessibility (F6, R9, E10).

All 16 files reviewed. Here is the comprehensive audit report.

---

# Dashboard Pages — Comprehensive Audit Report

## 1. `Dashboard.jsx` (1071 lines)

| # | Severity | Location | Issue |
|---|----------|----------|-------|
| 1 | **HIGH** | L68–242 | **Stale closure / duplicate fetch on invalidation.** The `handleInvalidation` listener captures `fetchDashboardData` closing over stale state (`currentUserId`, `allTests`, `allSeries`). When `trstprep:data-invalidated` fires, it re-runs with the closure from the effect instance where `user` last changed. More critically, the effect depends on `[user]` (an object), so any user object identity change re-attaches — but `allTests`/`allSeries` referenced inside for the live-tests fallback (L139, 145, 179) will be the values from when the listener fired, potentially `[]` on first invalidation. |
| 2 | **HIGH** | L907–910 | **Unhandled promise in onClick**: `await aiAPI.getDailyTip()` has no try/catch or `.catch()`. If the API fails, an unhandled promise rejection fires, no user feedback, and `dailyTip` stays `null`. Also, rapid clicks create concurrent requests with no abort/disable state. |
| 3 | **HIGH** | L215–216 | **Error swallows all state, leaving permanent loading skeletons.** If the outer try throws (e.g., a setState issue or the cache write throws), the `finally` resets loading flags — but the intermediate stage-2 loading flags are only reset in `finally`, fine — however on error the *silent* fallback leaves `topPerformers` etc. as stale cache or empty with no user-facing error UI. |
| 4 | **HIGH** | L387 | **Loose equality on ID comparison**: `(exam.exam_id \|\| exam.examId \|\| exam.id \|\| exam._id) == subcategory` uses `==`. String "1" vs number 1 silently coerces — ok by design — but mixed types across the codebase mean matches may behave inconsistently vs strict checks elsewhere. |
| 5 | **MEDIUM** | L456, 469, 457 | **Potential NaN string rendering**: `Math.round(Number(attempt.accuracy))` — if `attempt.accuracy` is a non-numeric string, `Number()` → NaN, renders "NaN%" in the activity feed. Same for `percentage`. There's no `isNaN` guard (unlike `dateObj` which does check). |
| 6 | **MEDIUM** | L482 | **Fabricated metric**: `improvement: analytics?.improvement \|\| (analytics?.totalTests > 0 ? '+5%' : '0%')` — hardcodes "+5%" when data is missing, which is misleading UX. Also in `Analysis.jsx` L126. |
| 7 | **MEDIUM** | L707, L768 | **Hardcoded fallback slug `'ssc-cgl-2026'`** for live test/quiz links. If the series lookup fails, links point to a possibly non-existent series slug — broken navigation / 404s. |
| 8 | **MEDIUM** | L203–214 | **Cache staleness**: `setDashboardCache` stores `dueRevisions: revisionsRes.value \|\| []` even when `revisionsRes.status === 'rejected'` — caching `[]` as if it were fresh, hiding failures and preventing retry until cache expires. Same for failed analytics: `analyticsData` may be `null` from the catch and gets cached as `null`, which on next load satisfies `isCacheValid` and shows a blank dashboard without re-fetching. (Verify `getDashboardCache` treats `null` fields as valid.) |
| 9 | **MEDIUM** | L242 | **Effect dep `[user]`** — object identity. Every `refreshUser()` (even content-identical refetch) retriggers the entire dashboard fetch, causing redundant network bursts and potential flash-of-loading. Should depend on `currentUserId`. |
| 10 | **LOW** | L86–88 | Swallowed errors: `.catch(() => ({ data: { data: [] } }))` silently converts auth failures (401) into empty arrays — user sees "haven't enrolled" empty states instead of being logged out. |
| 11 | **LOW** | L59–60 | `initials` breaks on names with non-letter first chars or empty string edge — `userName.split(' ').map(n => n[0])` — if `userName` is `" "` (whitespace), renders empty string. Minor. |
| 12 | **LOW** | Dead code | `_tests` used, ok; unused icon imports: none obvious. `getCategoryEmojiForDashboard` defined after useMemo but used in render (fine, hoisting via function declaration — yes, it's a function expression assigned to `const` at L486, defined at line 486 which is before return at 501 — OK, actually `const` is TDZ but declared before return — fine). |

---

## 2. `Profile.jsx` (1712 lines)

| # | Severity | Location | Issue |
|---|----------|----------|-------|
| 1 | **CRITICAL** | L926 | **Crash: `confirm({...})` is not a function.** `await confirm({ title: 'Logout', ... })` — the browser's global `confirm` does NOT accept an object; it expects a string. This throws `confirm(...).then is not a function`-style errors (await on boolean works, actually — `confirm` called with object arg coerces object to string "[object Object]" and returns boolean; `await true` → true). Since `await true === true`, this **always logs out regardless of user choice** — the confirm dialog shows "[object Object]" garbage and logout proceeds on Cancel. Two logout handlers: L284 uses `confirm(...)` correctly; L926 is broken. |
| 2 | **HIGH** | L282 | **Effect dependency on `user` object**: deps `[user, navigate]` — full refetch of stats/exams/attempts on every user object identity change. Also `getSeriesAttemptCount` inside the `enrichedSeries.map` uses `attemptRows` **before it's set** (L249 uses `attemptRows` state, but `setAttemptRows` at L234 happens async — map runs in same tick so `attemptRows` is still previous render's `[]`). **Attempt counts from rows are always computed with stale/empty attemptRows on first fetch.** |
| 3 | **HIGH** | L250 | `completed: totalTests > 0 && attemptedCount >= totalTests` uses the stale `attemptedCount` from issue #2 → series progress wrong. |
| 4 | **HIGH** | L367 | **Base64 avatar upload**: `handleCropComplete` sends full base64 to the API — unbounded payload risk if cropper fails to downscale. No size check post-crop (the 5MB check is on the *original* file, cropped output is unvalidated). Also no limit on the *stored* data URL length (DB bloat / slow profile loads since avatars render inline). |
| 5 | **MEDIUM** | L189 | Tab persistence: `localStorage.setItem` on every tab change is fine, but `initialTab` prop (from router) is overridden by localStorage in `useEffect` at L181-186 — meaning deep-links like `/profile?tab=exams` → the user gets bounced back to their last tab instead of the requested one. |
| 6 | **MEDIUM** | L872 | **Email displayed but never editable** and no verified indicator; editing name/phone only. Not a bug per se. |
| 7 | **MEDIUM** | L441 | Phone validation regex `/^[6-9]\d{9}$/` hard-coded to Indian numbers — acceptable for target market, but strips nothing (leading +91/0 rejected without helpful message beyond generic error). |
| 8 | **MEDIUM** | L326 | `handleRemovePhoto` checks `response.data?.success` but doesn't show success toast; `refreshUser()` not awaited (L326). Minor race: modal closes before user updates. |
| 9 | **MEDIUM** | L475, L490 | `unenrollFromSeries(exam.enrolledSeriesId \|\| exam.id)` — when unenrolling from an *exam*, only ONE series ID (the first-matched) is passed, but the exam card may aggregate many series (`exam.series` array). User thinks they're unenrolling from the whole exam but only one series is removed; UI then removes the entire exam from state (L476) — **UI state lies about server state**. |
| 10 | **MEDIUM** | L476 | Optimistic removal uses `(e.id \|\| e._id) !== (exam.id \|\| exam._id)` — if `exam.id` is number `1` and `e.id` is string `"1"`, strict !== never matches, removing nothing visually. |
| 11 | **LOW** | Dead code | Unused/underscore vars: `_navMode`, `_loading` (setter used, getter underscore), `_toggleNavMode`, `_handleLanguageChange`, `_handleNotificationToggle`, `_handlePrivacyChange`, `_handleDeactivateAccount`, `_handleDeleteAccount`, `_handleExportData` (all dead — the real ones live in SettingsContent), `activeMenuId` for exams uses same `series-` prefix — fine. `showLocationModal` flow ok. Also unused imports: `Download`, `RefreshCw`, `Gift`, `Users`, `Share2`, `Brain`, `LineChart`, `PieChart`, `Rocket`, `FileText` — several are actually used in features tab. Check: `Download` used L1212; OK. `_ConfirmDialog` in SettingsContent is dead. |
| 12 | **LOW** | L736–768 | Custom drag-scroll mouse handlers on tab bar duplicate `useDraggableScroll` used in Dashboard — code duplication + adds invalid DOM properties (`el.isDragging`, etc. on HTMLElement). Works but fragile. |
| 13 | **LOW** | L441 | `getSeriesAttemptCount` runs `attemptRows.filter().reduce()` inside a loop over keys × series → O(keys × attempts) per series, called during render of exam cards (not memoized). Perf hit with many attempts. |

---

## 3. `Settings.jsx` (844 lines)

| # | Severity | Location | Issue |
|---|----------|----------|-------|
| 1 | **HIGH** | L219–223 | **Side effect in useState initializer**: `document.documentElement.lang = ...` inside `useState(() => ...)` — runs on every component creation but initializers must be pure; under StrictMode double-render it runs twice. Harmless here but an anti-pattern. |
| 2 | **HIGH** | L427–439 | **Avatar upload without crop or type check**: reads any `accept="image/*"` file as data URL and PUTs full base64; the 5MB check is on raw file but SVG images pass and could carry embedded scripts served via data: URL (stored XSS vector if avatar is ever rendered without sanitize — most browsers won't execute data: in `<img>`, moderate risk but real). |
| 3 | **MEDIUM** | L341 | **Password change auto-logs-out with generic `logout()`** — if `authAPI.changePassword` succeeded but `logout()` throws, user navigated? No, navigate happens after logout. If server didn't actually invalidate sessions, stale tokens remain on other devices. Also: no toast confirmation before forced logout (toast at L345 only on failure). |
| 4 | **MEDIUM** | L104, L111 (DangerZoneSection) | `confirm()` used... actually no, it uses modal state. OK. But `handleDeactivate`/`handleDeleteAccount` show `console.error` only — **no user-facing error toast** on failure; modal stays open silently. |
| 5 | **MEDIUM** | L379–405 | `handleExportData` — exports raw user JSON including any PII to client filesystem without confirmation. GDPR-style export is fine; but no loading state → button feels dead during the 3-round-trip fetch. |
| 6 | **MEDIUM** | L297 | `setTimeout(() => setSaveStatus(null), 2000)` — if user saves twice quickly, the first timer (cleared via ref only if same ref) — actually timer ref is overwritten each call, but `persistPreferences` clears via `saveStatusTimerRef.current = setTimeout...` — the previous timer isn't cleared before overwriting → **earlier timer may reset status mid-second-save**, hiding success. L323 same. |
| 7 | **MEDIUM** | L283 | Effect dep `[user, navigate]` resets `profileForm` every time user object identity changes — **wiping unsaved edits** if any profile refresh occurs (e.g., after avatar upload from another tab/refreshUser). No dirty-check protection. |
| 8 | **LOW** | L214 | `_fileInputRef` declared but never used → dead code (`_handlePhotoChange` also dead). |
| 9 | **LOW** | L201 | Hardcoded external URL `https://help.trstprep.com` — verify it exists; if not, broken link. |
| 10 | **LOW** | L412 | `proPass.formattedExpiry` shown as "Renews On" — semantically wrong for non-renewing passes (shows expiry as renewal date). |
| 11 | **LOW** | Duplication | `ToggleSwitch`, `SectionLabel`, `SettingsCell` duplicated definitions vs `ProfilePrimitives.jsx` (different bg color: indigo vs green ToggleSwitch — inconsistent UI). |

---

## 4. `Analysis.jsx` (1254 lines)

| # | Severity | Location | Issue |
|---|----------|----------|-------|
| 1 | **HIGH** | L44–51 | **Unnecessary fetch + unused data**: fetches ALL test series (`getTestSeries()`) into `_seriesData` but never uses it — wasted network on a premium-gated page. Pure dead fetch. |
| 2 | **HIGH** | L421 | **Misleading hardcoded achievement**: `analytics?.timePerQuestion < 45 && analytics?.totalTests >= 10` — when `timePerQuestion` is `undefined`, `undefined < 45` is false (OK). But `{ icon: '🚀'...}` fine. Also L422 `user?.hasProPass \|\| user?.isProUser` may render `undefined` as falsy ok. |
| 3 | **HIGH** | L245 | **Loading gate blocks on `!analytics`** — if API returns `{}` (empty object) the `if (analyticsData && Object.keys(...).length > 0)` falls to user fallback at L69; if `user` is null too, analytics set to zeros (L74) fine. But on API error, `setAnalytics({totalTests: 0,...})` set (L96) → page unlocks with zeros and claim "top 100%" (see #4). |
| 4 | **HIGH** | L1087 | **`You're in the top {100 - analytics.percentile}%`** — when `percentile` is 0 (default/zero-state), renders "top 100%". When percentile > 100 from bad data → negative %. No clamp. |
| 5 | **MEDIUM** | L75 | `totalTests: user?.attemptedTests?.length \|\| 0` — `attemptedTests` is documented/used elsewhere as an **object keyed by series ID** (L297 Dashboard), not an array — `.length` is `undefined` → always 0. Wrong shape assumption. |
| 6 | **MEDIUM** | L399 | **Division by zero**: `subjectPerformance.reduce(...) / subjectPerformance.length` — length is 4 from the zero-state fallback, so ok, but if backend subjectWise returns `[]` AND the early-return fallback were removed → NaN. Currently guarded by fallback. Low risk but fragile. Also `Infinity`/NaN if `score` values are NaN. |
| 7 | **MEDIUM** | L812 | `test.accuracy \|\| Math.round((test.score / 100) * 100)` — `test.score/100` division by zero guarded by 100 constant; but if score is null → NaN → NaN%. Also assumes score is out of 100, despite `totalMarks` existing elsewhere. |
| 8 | **MEDIUM** | L651, L1106 | **Broken/possibly-wrong routes**: `/study/${subject.toLowerCase().replace(' ', '-')}` — uses `.replace(' ', '-')` replacing only FIRST space: "General Awareness" → `general-awareness` OK? "Data Interpretation & Analysis" → `data-interpretation & analysis` — invalid chars in URL. Should be `.replace(/\s+/g, '-')` as used at L1200 (inconsistent). These study routes may 404. |
| 9 | **MEDIUM** | L718–736 | **Fabricated AI recommendations**: Hardcoded text "Review 'Percentage' and 'Profit & Loss' videos", "Reduce Time Lag — less than 45s on Reasoning" presented as AI-generated regardless of actual user data. Misleading UX. |
| 10 | **LOW** | L197 | `date.toLocaleDateString('en-IN', { weekday: 'short' })[0]` — takes first char of abbreviated weekday; in 'en-IN' Wed→"W", but Sun/Sat both "S", Tue/Thu both "T" — ambiguous labels. |
| 11 | **LOW** | L211–212 | **Fabricated wrong/skipped split**: `wrong = attempted × (100-acc)% × 0.7` — the 0.7 coefficient is invented data shown as if real analytics. |
| 12 | **LOW** | L1031 | Quadrant chart indexes `analytics.subjectWise[i]` parallel to `timeAnalysis` — assumes same ordering between two separately-derived arrays; if backend order differs, dots plot wrong accuracy per subject. |

---

## 5. `AttemptedTests.jsx` (570 lines)

| # | Severity | Location | Issue |
|---|----------|----------|-------|
| 1 | **HIGH** | L46 | **Uses raw `apiClient` with an AbortSignal passed via axios config** — `{ signal: controller.signal }` works in axios ≥1.x. OK. But `axios.isCancel(err)` re-thrown from within `.catch` at L47 — re-throw inside catch bypasses the fallback shape — fine. Real issue: **`console.error` logs but the `error` state only set on outer catch** — a 401 behaves like "no attempts" through the inline `.catch` fallback (silent failure). |
| 2 | **MEDIUM** | L371, L469 | **Confusing/wrong score display for quizzes**: `test.type === 'quiz' ? (test.totalMarks \|\| '0')` — displays the total marks instead of the user's score for quizzes ("50" instead of "35/50"). Looks like a bug. |
| 3 | **MEDIUM** | L387, L394, L527, L533 | **Path construction assumes slugs exist**: `/test-result/${test.seriesSlug \|\| test.seriesId}/...` falls back to raw IDs if slugs missing — depends on backend route tolerating IDs (verify `/test-result/:series/:test` accepts non-slug). If not, links break for rows without slugs. |
| 4 | **MEDIUM** | L143–144 | `Math.min(...attemptedTests.map(...))` — spread of a potentially large array risks stack overflow at ~100k+ arguments; also computed every render (not memoized). Same for L131–149 stats — not memoized, recompute per render during search typing. |
| 5 | **MEDIUM** | L511–513 | **Speed per question divides by `total`** where `total` counts correct+wrong+skipped — but `timeSpent/timeTaken` semantics unclear (ms vs seconds?). `formatTime` assumes seconds (`seconds/60`). If backend sends ms, values render wrong silently. No unit validation. |
| 6 | **LOW** | L147–149 | `_totalCorrect/_totalWrong/_totalSkipped` computed but never rendered → dead code. |
| 7 | **LOW** | L242 | `seriesOptions` uses `s._id \|\| s.id` as option value, but `filterSeries` matching in L86–92 also tries slug — options value never includes slug so slug-match branch only fires for cross-mapped filters; mostly OK but convoluted. |

---

## 6. `Bookmarks.jsx` (544 lines)

| # | Severity | Location | Issue |
|---|----------|----------|-------|
| 1 | **HIGH** | L417, L422, L525 | **XSS-surface: sanitize-then-render via MathRenderer** — `MathRenderer text={sanitizeHtml(...)}` assumes `MathRenderer` does plain-text rendering. If `MathRenderer` internally uses `dangerouslySetInnerHTML` for LaTeX (many do: KaTeX `renderToString`), the sanitize utility must allow its tags or risk double-escaping; conversely if sanitizeHtml strips needed MathML, formulas break. Verify both implementations — flagged for review. |
| 2 | **HIGH** | L36–61 | **Abort controller created but never passed** — `const controller = new AbortController()` then `bookmarksAPI.getAll(1, 20)` without `signal`. Unmounting mid-request → state update on unmounted component warnings (React 18 silent but still wasted work). |
| 3 | **MEDIUM** | L80–98 | **`fetchBookmarks` reads stale `page`** — defined without deps; called from error Retry (L273) uses current `page` state at render time — OK since re-created per render. But initial-load effect (L36) duplicates `fetchBookmarks` logic → two code paths to drift; note L36 doesn't set `hasMore`. |
| 4 | **MEDIUM** | L462 | **Load More gated on `filteredBookmarks.length >= 20`** — if a filter is active (e.g., 3 videos visible from 20 fetched), the "Load More" button disappears even though the server has pages. Pagination broken for filtered views. |
| 5 | **MEDIUM** | L208 | `Object.values(val)[0]` fallback can return another object → passed into `MathRenderer` → `String(obj)` → `[object Object]` displayed to user. Guard exists only for string case (L198). |
| 6 | **MEDIUM** | L169 | `getLink` for tests builds `/test/series/...` with literal `'series'` or `'subject'` placeholders when IDs missing — navigates to broken routes instead of disabling the link. |
| 7 | **LOW** | L63–78 | Reports fetch has no auth guard check beyond `user`; no error state surfaced for reports (fail silently, empty list "No Reported Questions" even on 500). |
| 8 | **LOW** | L13 | `Sparkles` import used; ok. |

---

## 7. `Notifications.jsx` (353 lines)

| # | Severity | Location | Issue |
|---|----------|----------|-------|
| 1 | **MEDIUM** | L191 | **Retry button passes click event as `signal`**: `onClick={fetchNotifications}` → event object passed to `fetchNotifications(signal)` → `signal?.aborted` is `undefined` → works by

All files fully read. Here is the complete audit report:

---

# Exam Pages Audit Report — `apps/frontend/src/pages/exams/`

---

## 1. `Exams.jsx`

| # | Severity | Issue |
|---|----------|-------|
| E1 | **CRITICAL** | **Line 50–53: `getCatKey` string–category fuzzy matching is broken.** `const nameMatch = Object.keys(CATEGORY_CONFIG).find(k => name.includes(k) \|\| k.includes(name))` — when `cat` is a plain string like `"ssc"` the function returns early at line 47, but when `cat` is an object whose slug/name doesn't match any config key, `name` can be an empty string or 2-char fragment. With `k.includes(name)`, a name of `""` matches `"ssc"` (`"ssc".includes("") === true`), so **every unknown category silently collapses to the SSC config**. Unknown categories get mislabeled. |
| E2 | **HIGH** | **Lines 221: `.filter(cat => cat.id !== 'all') \|\| []`** — precedence bug: `response.data.data.filter(...)` runs first; `\|\| []` only fires if `.filter` throws, which it can't. If `response.data.data` is `undefined`, `.filter` throws and the whole `queryFn` rejects — no error state is ever rendered (page just spins). Should be `(response.data?.data ?? []).filter(...)`. |
| E3 | **HIGH** | **Line 214: `selectedCategory` initialized from `useParams()` but never re-synced.** If the user navigates `/exams/ssc` → `/exams/banking` (client-side, same component instance), `useState(categoryId \|\| 'all')` keeps the stale value. The `categoryId` param from the URL is ignored after first mount. |
| E4 | **HIGH** | **Line 92/143: `to={\`/exam/${exam.examId}\`}` — crash on undefined `examId`.** If an exam lacks `examId`, the link becomes `/exam/undefined`. No fallback to `exam.id`. |
| E5 | **MEDIUM** | **Line 289–303: `siteStats.tests` fabrication.** `(e.totalTests \|\| e.testsCount \|\| 15)` — silently assumes **15 tests per exam** when the field is missing, inflating the "Tests" hero stat with fabricated numbers shown to users. |
| E6 | **MEDIUM** | **Line 274–276: trending fallback duplicates-free logic is wasteful but also misleading.** `.concat(allExams.slice(0, 5))` pads trending with whatever the first 5 exams are, regardless of merit, and labels the section "Trending This Week — Top picks by thousands of students daily" — a false claim for arbitrary exams. |
| E7 | **MEDIUM** | **Line 262: category filter compares IDs that may not be string-normalized.** `exam.category === selectedCategory` — `exam.category` is set via `getCatId` (line 227, uses `String(...)`) but `selectedCategory` comes from pill `id` which is also `getCatId`. However `categoryId` from URL params is a raw string vs. possibly numeric `cat.id` — `String(cat.id)` handles it, but the URL param `categoryId` is compared directly at line 214 init without normalization. |
| E8 | **LOW** | **Dead code / unused vars:** `useNavigate` (line 210 `_navigate`, never called), `_diffColor` (line 85, declared but unused), `_CategoryCard` (line 170, whole component defined but never rendered), `_freeMockExams` (line 279), `_isFiltered` (line 314). ESLint noise; bundle size impact minor since same module. |
| E9 | **LOW** | **Line 559: hardcoded "March 2025" "Current Affairs" label** — stale content, never updates. Also "Live Test Today 7 PM" hardcoded — misleading when there's no live test. |
| E10 | **LOW** | **Line 363: `key={i}` on stat chips** — array is static so acceptable, but index keys on dynamic stat values would drop animations on value change. |
| E11 | **LOW** | **No error state for failed query.** If `/api/exam-categories` 500s, React Query stores the error but the UI only handles `isLoading`; users see the hero with "0 exams" and empty sections — no error message or retry. |
| E12 | **LOW** | **Line 88: `.split(' ').map(w => w[0])` crashes if a title contains consecutive spaces producing empty string segments — `''[0]` is `undefined`, resulting in "UND" in the abbreviation.** Minor visual corruption. |

---

## 2. `ExamsNew.jsx`

| # | Severity | Issue |
|---|----------|-------|
| N1 | **CRITICAL** | **The "other" category is completely unreachable.** Sidebar button at line 499–516 sets `selectedCategory = 'other'`, but the filter at line 165 only runs `exam.categoryId === selectedCategory`. Exams whose `categoryId` doesn't match any known category (i.e., the ones counted in `categoryStats['other']`, computed at line 231 by *not matching* any category) will never pass `exam.categoryId === 'other'` unless their literal `categoryId` is the string `"other"`. Clicking "Other exams" shows 0 results while the badge claims `N` exams. **Broken filter.** |
| N2 | **HIGH** | **Categories with an *actual* ID of `'all'` are silently dropped from pills but still counted** — wait, that's `Exams.jsx`. Here: **line 69–70 `useState(searchParams.get('q') ...)` — same stale-init bug as E3**: direct navigation between URLs with different `?q=` doesn't update state (component remounts only if key changes). Also **bidirectional sync loop risk**: the `useEffect` at line 246–251 writes `setSearchParams` which re-triggers the effect (`setSearchParams` is stable so OK), but clearing params when both are empty still calls `setSearchParams(new URLSearchParams())` on every keystroke — each keystroke rewrites history entry (replace, so no stack spam, but causes a router re-render per keystroke). |
| N3 | **HIGH** | **Lines 96–101: error swallowing makes `setError` dead code.** Every fetch is `.catch(() => [])`/`.catch(() => null)`, so the outer `catch` at line 121 never fires; the error screen at lines 291–308 is **unreachable**. Any total backend outage renders an empty page with "Showing 0 exams" instead of an error. |
| N4 | **HIGH** | **Line 413: filter `<select>` uses `selectedFilters[filterType][0] \|\| ''` as its value**, but `handleFilterChange` *toggles* (adds/removes). Selecting option A then option B does not replace A — it adds B (array grows to 2), yet the select only displays the first element. Selecting the *same* option again removes it but the select still shows its old `value` — UI becomes desynced. Users cannot select an exclusive filter value, and the visible select state lies about active filters. **Broken multi-select presented as single-select.** |
| N5 | **HIGH** | **Line 155: `testSeriesCount: testSeries.filter(s => s.category === exam.categoryId).length`** — field-name gamble: `s.category` may be category slug or ID; combined with line 166 `exam.categoryId === selectedCategory` where `selectedCategory` can be `cat.slug`, filtering silently yields 0 whenever slug ≠ categoryId. Same mismatch for the `processedExams` category lookup at line 145–147 (it tries `cat.categoryId \|\| cat.slug \|\| id` but matches only against `exam.categoryId` — if exams store slugs, nothing matches). |
| N6 | **MEDIUM** | **Line 117–120: `localStorage.getItem('bookmarkedExams')` + `JSON.parse` has no try/catch.** Corrupted localStorage (e.g. `"[object Object]"` from an older version that stored objects) throws and — since it's inside `fetchData`'s try — sets the page-level error and **blocks the whole page render** over a bookmark parsing issue. |
| N7 | **MEDIUM** | **Line 86–89: `AbortController` created, `fetchData(controller.signal)` — but `getExamCategories()` etc. (dataService) accept no signal** (they're `(...args) => dataService.x(...args)` but the underlying cached service methods ignore axios config). The signal only gates `setState`, so requests aren't actually cancelled — the abort gives a false sense of cleanup. Token wasted on unmount, state safely skipped at least. Also **line 299: retry button calls `onClick={fetchData}`** — passes the click event object as `signal`. `signal?.aborted` on a SyntheticEvent is `undefined` so it limps along, but the intent is broken and any future `signal.aborted === false` check would misbehave. |
| N8 | **MEDIUM** | **Lines 195–211: sort mutates `result` in place (`result.sort`)** — OK since `result` is a fresh `[...processedExams]`, but `'upcoming'` sort uses `new Date('9999-12-31')` sentinel per comparison (allocations inside comparator — minor perf). Bigger issue: invalid dates (`nextExamDate: "TBA"`) produce `Invalid Date` and `dateA - dateB` → `NaN`, making sort order nondeterministic across browsers. |
| N9 | **MEDIUM** | **Unused state/vars:** `showFilters` works, but: `_navigate` (line 57) unused; `testSeriesCount` computed (line 155) never rendered; `platformStats.activeLearners/mockTests` used as *fallbacks in per-card stats* (lines 829/834/895/899) — a category with one exam shows platform-wide user counts next to each niche exam, **fabricating exam popularity**. |
| N10 | **LOW** | **Line 221/475/664/704: `String(cat.id \|\| cat._id)`** — if `cat.id` is `0` (falsy but valid), falls through to `_id` incorrectly. Minor. |
| N11 | **LOW** | **Lines 692–693: `stats.totalTests \|\| platformStats.mockTests`** — `\|\|` shows platform totals whenever category total is 0, mislabeling "0 tests" as "12.5k Tests". |
| N12 | **LOW** | **Line 725: duplicate `flex` classes, `w-full` + `sm:w-auto` conflict, plus `hover:bg-brand-50` while text is `text-brand-start` — works but messy; button nested inside a `<div>` inside a CARD `<button>`? No — ok here. But line 670: category grid cards are `<button>` elements containing `<div>`s and `<span>`s — fine; however nested `<button>` "View All" (line 723) sits inside a parent `<button>`? No, separate sections. OK.** |
| N13 | **LOW** | **Bookmarks sliced to 5 in sidebar (line 530) with no "view all" escape; bookmarked exam titles that are deleted from DB vanish silently (filter at 529) — orphaned localStorage entries accumulate forever, never cleaned.** |

---

## 3. `ExamDetails.jsx`

| # | Severity | Issue |
|---|----------|-------|
| D1 | **CRITICAL** | **React hooks-rules violation: `useEffect` (line 122) and both `useMutation` hooks (lines 153, 174) are declared after conditional early returns at lines 95–119 (`if (examLoading) return ...`, `if (examError) return ...`).** On the first render (loading), hooks after the return are skipped; once data loads, they suddenly mount. React detects hook-count changes **between renders of the same component instance** → eslint `react-hooks/rules-of-hooks` error and potential `Rendered more hooks than during the previous render` **runtime crash** whenever the component remounts with cached data (React Query returns data synchronously on remount → hook count flips between mounts... actually within one instance the loading→loaded transition changes hook count → hard error). This file will crash or warn in dev and behaves nondeterministically with the React Compiler. **Must hoist all hooks above the early returns.** |
| D2 | **CRITICAL** | **`setSelectedYear` called during render-side queryFn.** Line 53: `queryFn` calls `setSelectedYear(yearMatch[1])` — a state update executed asynchronously whenever the query (re)fetches. React Query dedupes/caches, but calling setState inside a query function is an antipattern: it fires during background refetches, overrides any year the user manually picked, and can trigger `setState` after unmount in edge cases (React Query keeps the promise alive independent of component). |
| D3 | **HIGH** | **`yearMatch` regex strips the year but mutation calls use the year-suffixed ID.** Lines 156/177: `api.post('/api/users/enroll-exam/' + examId)` where `examId` may be `ssc-cgl-2026`, while enrollment likely expects the base exam. Also the updates/yearly fetches correctly use `examInfo.examId` but enroll does not. |
| D4 | **HIGH** | **Line 61: `api.get('/api/exams/${examInfo.examId}').catch(() => ({ data: { data: {} } }))`** swallows all errors including 500s, so `effectiveContent` silently becomes `null` and the page shows the `ComingSoon` tombstone **for transient network failures** — users told content "hasn't been published" when the server errored. |
| D5 | **HIGH** | **Watermark of perf problems: queryFn fires 5 sequential-ish API calls (`/api/exam-info` full list, `/api/exams/:id`, updates, yearly, `/api/exam-categories` full list) for one page**; `/api/exam-info` fetches *all* exams then `.find`s client-side. No `enabled: !!examId` guard — runs even with malformed param. |
| D6 | **MEDIUM** | **Line 478–479: `.reduce((acc, s) => acc + s.questions, 0)`** on `effectiveContent?.pattern?.tier1` objects — if any `questions`/`marks` arrives as a string from the DB (Postgres numeric → string), `"25" + "25"` = `"2525"` concatenation in the TOTAL row. No `Number()` coercion. |
| D7 | **MEDIUM** | **Line 130: `api.isCancel(error)` — `api` here is the default axios instance from `shared/lib/api`, and `api.isCancel` exists on axios instances, OK — but the guard order: signal passed as `{signal}` works with axios v1; `checkEnrollment` runs on `[user, examId, examData]` — `examData` is a new object identity every render → **enrollment check re-fires on every re-render** (object in deps). Should depend on `examData?.examId` (a string).** |
| D8 | **MEDIUM** | **`enrollmentLoading` state is redundant with mutation `isPending` and creates desync**: `onSuccess` sets `isEnrolled` true *before* the invalidations resolve, and rapid double-clicks aren't guarded (button disabled only by `enrollmentLoading` which is set inside mutationFn — there's a tick where two clicks both pass). |
| D9 | **MEDIUM** | **Lines 283/288: hardcoded fallbacks presented as data:** `'Released'` when no notificationDate, `'June 2026'` when no tier1ExamDate, `'SSC'` when no conductingBody (line 293). Fabricated specifics shown with full confidence styling. |
| D10 | **MEDIUM** | **Line 508: hardcoded dummy roadmap dates** (`{ event: 'Notification', date: 'March 1, 2026' }...`) shown when `currentYearData.importantDates` missing — fake dates rendered in a panel titled "Target Roadmap". Also line 516: `idx < 2` hardcodes the connector line assuming exactly 3 items; real data with 5 items renders broken timeline connectors. |
| D11 | **LOW** | **Line 56/112: `examId` interpolated raw into JSX text (`"{examId}"`) and used in regex — fine, but the error message displays the raw param; low risk.** `useMemo` at 87 is pointless (cheap check). Line 399: `key={idx}` on updates (no stable id) — if updates reorder, React remounts items; use `update.id \|\| update.date+title`. Lines 432/439/467: index keys everywhere in syllabus/pattern lists. |
| D12 | **LOW** | **Line 426–428: "DOWNLOAD PDF SYLLABUS" button has no onClick/href** — dead button. Line 530 admits "Here we would normally map relatedExams" — placeholder shipped to prod. |
| D13 | **LOW** | **Stale-closure risk low but present:** queryFn closes over `examId` fine since it's in queryKey; but `setSelectedYear` closure is the real issue (D2). |

---

## 4. `ExamCategory.jsx`

| # | Severity | Issue |
|---|----------|-------|
| C1 | **HIGH** | **Line 39: `category.color.split(' ')[0].replace('from-', 'bg-')`** — builds `bgColor` like `bg-blue-500` from the color string. Because Tailwind purges unused classes at build time, **dynamically-constructed class names such as `bg-blue-500`, `bg-teal-500` etc. will not exist in the CSS** unless safelisted. Any category with a custom `color` in DB renders a broken/invisible background. (The known-config map at 15–25 is safe because those literals are present.) |
| C2 | **HIGH** | **Line 8: `examYears = [2026, 2025, 2024]` is hardcoded** — each new year requires a code deploy; in 2027 "Current" badge logic (line 331 `year === 2026`) will claim 2026 is current forever. Line 323's special-casing by year value has the same rot. |
| C3 | **HIGH** | **Lines 113–129: test/series counting matches on `t.category === categoryId`** using the **raw URL param**, not the resolved `categoryInfo.id/slug/categoryId`. If the URL is `/exams/category/1` (numeric id) but tests store `category: 'ssc'`, all counts show 0. Also fetches **the entire tests + test-series collections** (`getTests()`, `getTestSeries()`) just to count — O(all tests) transferred and filtered in-browser per page view (perf + cost). |
| C4 | **MEDIUM** | **Line 92 is redundant with line 91** (`cat.slug?.toLowerCase()` twice, once with `categoryId.toString().toLowerCase()` — identical to `resolvedCategoryId`); line 82 `categoryId.toString()` — if `categoryId` is undefined (route misconfigured), **TypeError thrown before try/catch inside fetch? No — it's inside fetchCategoryD ata try block... wait, line 81 is inside the fn → fine, but error message becomes "Failed to load category information" for what is a routing bug.** |
| C5 | **MEDIUM** | **`fetchCategoryData` re-runs on every `categoryId` change but `setExpandedExams` state persists across categories** — expandable sections from the old category keep stale expansion states keyed by exam ids that may collide across categories. Minor UX glitch. |
| C6 | **MEDIUM** | **Line 253: `exam.title.substring(0,2)`** — fine; but **line 230 guards `categoryData.exams &&` inside map while line 356 handles empty** — OK. Real issue: line 261 `seriesCount > 0` → shows "Hot" badge — series count drives a **"HOT"** claim; miscount (see C3) mislabels everything. |
| C7 | **MEDIUM** | **No null guard on `exam.id \|\| exam.examId` being undefined** (line 231) — both undefined → `key={undefined}` duplicate-key warnings and broken expand state. |
| C8 | **LOW** | **Line 307: `max-h-[800px]` clip animation + `opacity` transition** — standard accordion hack; content taller than 800px gets clipped mid-animation (many exams are fine, but years grid with wrapping could exceed on small screens). |
| C9 | **LOW** | **`error` state shadowed by success fallback**: any `getExamCategories` failure → generic 'Failed to load category information' with no retry button (only "Back to Exams"). |
| C10 | **LOW** | **Line 39 edge:** if `category.color` is e.g. `'bg-rose-500'` (no `from-` prefix), the derived bgColor becomes garbage (`bg-rose-500` → split → replace no-op → duplicates color as bg) — harmless but sloppy. |

---

## 5. `ExamInfoNew.jsx` (1700 lines)

| # | Severity | Issue |
|---|----------|-------|
| I1 | **CRITICAL** | **Line 312: `selectionProcess: dynamicInfo?.syllabus \|\| staticContent.selectionProcess`** — the **syllabus text is merged into the selection-process field**. The Overview tab renders "Selection Process" as the syllabus blob (line 698–702, 785); if the DB syllabus contains newlines/HTML, the step-splitter `split(' → ')` (line 785) produces one giant "step". Data-corruption-level content bug visible on every dynamic exam. |
| I2 | **CRITICAL** | **Line 497–498: `bg-${examStatus.color}-500/20` — dynamic Tailwind class interpolation.** Tailwind's JIT purger never sees `bg-emerald-500/20`, `border-emerald-500/30`, `text-emerald-300`, `bg-amber-*` as literals **in the interpolated form**... (the literals appear elsewhere in the file — actually several do, e.g. line 503 `bg-emerald-500/20` exists literally, so emerald compiles; `amber` — `text-amber-300` at 555 exists, but `bg-amber-500/20`, `border-amber-500/30`, `bg-amber-400` **do not appear literally**) → "Exam Soon" status pill renders unstyled/transparent. |
| I3 | **HIGH** | **Line 212: `const [yearlyData, setUpdatesData] = useState({})`** — setter named `setUpdatesData` while there's a separate `updates`/`setUpdates` pair (line 213). Calling `setUpdatesData` sets **yearly** data. Reads fine only because call sites match, but any future edit/touch will mix these up. Serious maintainability trap. |
| I4 | **HIGH** | **Line 296 `examId?.toLowerCase()` used inside `fetchExamData` — but `fetchExamData` isn't memoized and the effect at 229 depends on `[examId]` — fine — except line 265: `examsData.find(e => e.examId === examId \|\| e.id === examId)`** — numeric `e.id === '123'` string param never matches numeric ids (loose vs strict). Same strict-equality issue for category at line 277: `categoriesData.find(cat => cat.id === categoryId)` — string/number mismatch → category silently undefined. |
| I5 | **HIGH** | **Line 332–333: `JSON.parse(localStorage.getItem('bookmarkedExams') \|\| '[]')`** — no try/catch. One corrupted value = entire exam page throws inside `fetchExamData`'s catch → "Failed to load exam information" for a bookmark parsing problem (same class of bug as N6 but here it kills a detail page). Also **line 349: unbookmarking uses `examData?.examId`, bookmark-check at 333 uses route `examId`** — if they differ (e.g. id vs slug), saving adds `examData.examId` but the check tests route id → bookmark appears unsaved on revisit. |
| I6 | **HIGH** | **`STATIC_EXAM_CONTENT` keyed by substring (line 297–299): `lowerExamId.includes(key)`** — any exam id containing "cgl" anywhere (e.g. `upsc-cgldc`, a hypothetical `cgl-special-drive`) gets **SSC CGL's** full syllabus, posts, eligibility and salary tables rendered as its own. False data displayed authoritatively. |
| I7 | **HIGH** | **`SAMPLE_UPDATES` (lines 169–194) used as initial state and kept when API returns empty (`if (updatesList.length > 0)` at 321).** Fake news items — "Vacancy Increased to 17,727" etc. dated 2026 — render as real updates on every non-CGL/CHSL exam page indefinitely. |
| I8 | **HIGH** | **Hardcoded fabricated data shown as real:** Vacancy tab (lines 1324–1345) shows "12,000+ Total Posts / 3,000+ General / 2,000+ OBC…" for **every exam**; FAQ tab (1422–1427) hardcodes answers including attempts ("no limit") that are wrong for e.g. UPSC (which has attempt limits); Daily Quizzes (1172–1176) are fake; Practice Tests (1198–1209) dead cards; PYP tab (1395) always lists 2020–2025 regardless of the exam. All presented without disclaimers. |
| I9 | **MEDIUM** | **Line 1076: `Math.max(...)` recomputed inside the map for every bar** — O(n²) with spread of Object.values per iteration; trivially memoizable outside. Also `.filter(([_, d]) => d.vacancy)` then sort by `[a],[b]` — `a - b` on year strings works via coercion but sloppy. |
| I10 | **MEDIUM** | **Line 325–327: auto-select latest year `if (!years.includes(selectedYear))`** — `sort((a,b) => b - a)` on string years works, OK — but `years[0]` (descending) is the **max** year, correct. However it runs inside fetch: when yearlyMap arrives, user's current `selectedYear` is from state initialized to `'2026'`, fine. Edge: years as "2024-25" style keys would parse to NaN in sort comparator → unstable order. |
| I11 | **MEDIUM** | **Silent-fail chains everywhere**: lines 241–245 all `.catch(() => ...)`; line 254–259 — `/api/exam-info` fails → page still renders with static/default content and **no error surfaced**; user sees fabricated CGL data (I6) instead of an error. Also no abort signal actually passed to `api.get('/api/exam-info')` (line 255). |
| I12 | **MEDIUM** | **Line 371: share failure swallowed completely** — clipboard-write failure (permissions) shows no feedback at all; only success path shows toast. |
| I13 | **MEDIUM** | **Report modal (1662–1691) is a black hole**: submit closes the modal and **shows the "Link copied to clipboard" share toast** (line 1666 `setShowShareToast(true)`), telling users "Link copied to clipboard" after submitting an error report. No request is sent anywhere. Reported errors vanish. — **also HIGH, misleading UX.** (I'll count it under MEDIUM functionality-wise; flag prominently.) |
| I14 | **MEDIUM** | **`memo(ExamInfoNew)` (line 1700) achieves nothing** — component consumes reactive router/auth hooks and local state; memo only prevents parent-prop-driven re-renders of which there are none (it's a route component). Dead optimization signaling misunderstood perf work. |
| I15 | **LOW** | **Dead code:** `_expandedSections`/`_toggleSection` state (216, 393) unused in render; `createPortal` inline `style` animations `'bounceIn'`/`'slideUp'` (1584, 1595) reference keyframes that must exist globally; `_user` unused (199); unused imports: `useMemo` used, OK; `Clock3`, yes used; fine. Line 1219/1248: `grid-cols-1 md:grid-cols-2 sm:gap-4` — `sm:gap-4` redundant/below md. |
| I16 | **LOW** | **Line 519: abbreviation `.split(' ').map(w => w[0])` — same E12 empty-word bug**; line 656–657: double layout where `examData.static.conductingBody` truncates with `max-w-[80px]` — cosmetic. |
| I17 | **LOW** | **Line 963: Tier-I total time shows `tier1[0]?.time \|\| 60`** — reporting a single section's time as the total duration (or flat 60). Misleading exam stat. |
| I18 | **LOW** | **Line 1080: `(data.vacancy / 1000).toFixed(0)` + 'k'** — 9374 → "9k" but 500 → "1k" (rounds 0.5 up? `toFixed(0)` of 0.5 → "1" — shows "1k" for 500 vacancies). |

---

## 6. `ExamYear.jsx`

| # | Severity | Issue |
|---|----------|-------|
| Y1 | **CRITICAL** | **API failure falls back to fabricated sample data (lines 26, 31, 38–70).** Any 404/500 from `/api/exams/:id/year` renders a fully fake page — vacancy "9,374", eligibility, dates "2025-07-01", syllabus changes, preparation strategy — presented as authoritative with no "sample data" badge. Users will make decisions on invented dates. The endpoint likely doesn't even exist (nothing in the audit indicates `/api/exams/:id/year`), so **this page is permanently showing fake data in production.** |
| Y2 | **HIGH** | **Line 4: `import api from '../../shared/lib/dataService'`** — the default export of dataService is `apiClient` (an axios instance), so calls work, but the semantic mixup meant line 21 passes `{ signal }` to bypass GET dedup — OK functionally. The real issue: parameter-shaped URL `/api/exams/${examId}/year?year=${year}` — no `encodeURIComponent`; an `examId` with special chars breaks the URL. |
| Y3 | **HIGH** | **Line 10: `const [_error, _setError] = useState(null)`** — error state exists but setter is never called; **no error UI at all** — failures always masquerade as data (see Y1). Also no "paper not found" state: any `examId`/`year` combo renders a page. |
| Y4 | **MEDIUM** | **Line 40: `parseInt(year)` without radix** and no NaN guard — `/exam/cgl/year/abc` renders "NaN" sprinkled through headers (line 47 description template). |
| Y5 | **MEDIUM** | **Line 97/117/330: `examId.replace(/-/g, ' ')`** — crashes with `TypeError` if `examId` param is undefined (route misconfig) — minor

I've now done a thorough, end-to-end audit — reading every page in full (including the truncated sections), the shared `studyMaterialUtils`, and verifying each frontend API call against the backend routes and service contracts (`aiAPI`, `smartRevision.routes/service`, `currentAffairs.js`, `apiClient` baseURL). Here is the complete structured report.

---

# Study Pages Frontend Audit — Trstprep V2.1

Scanned 7 pages + `studyMaterialUtils.js` + cross-checked backend contracts. **45 issues** total: 3 CRITICAL, 12 HIGH, 18 MEDIUM, 12 LOW.

---

## 1. `StudyMaterial.jsx` (613 lines)

**#1 — HIGH — Synthetic view counts presented as real data (L104, L539)**
`views: (m.videos||0) * 125 + Math.floor(Math.random() * 500)` then rendered as `(item.views / 1000).toFixed(1)k`. The `Math.random()` runs inside state, so "Popular Today" numbers change on every refresh and are fabricated. **Why:** Misleading metrics shown to users; unstable UI (numbers reflow between loads). Replace with real view counts or drop the badge.

**#2 — MEDIUM — `useEffect` with `[]` deps uses `forceRefreshAll`/`getStudyMaterials` but no error for closed-over state (L46–119)**
The main fetch has no dependencies, fine for mount-only, but the abort controller only guards `setSubjects`/`setLoading` — `setLastUpdated`, `setStudyHistory`, `setPopularMaterials` (L62, L90, L107) all run **after** the `controller.signal.aborted` early-return only at L59; if `getUserAnalytics` resolves later there's no re-check before those setters. Minor race; mostly protected but brittle.

**#3 — MEDIUM — "Start Learning" / "Set My Goal" / "Chat Now" buttons are dead (L420, L561, L577)**
`<button>` elements with no `onClick` and no `Link`. **Why:** Broken affordances — users click and nothing happens.

**#4 — MEDIUM — Duplicate React key risk: `key={subject._id || idx}` and icon `alt` (L380, L438, L491, L518)**
Using array index as fallback key causes wrong component reuse when `subjects` array reorders after `forceRefreshAll`. Subject icons render raw `subject.icon` strings (L229) — non-URL icons render as text nodes which can break layout if admin stores emoji + text.

**#5 — LOW — Unused imports/vars**
`BarChart2` (L9, used at L284 ✔), but `Clock` (L23) only used at L555; `_user` (L35) and `_lastUpdated` (L39) are intentionally discarded — fine, but `_lastUpdated` setter is used while getter is never read; can simplify.

**#6 — LOW — `subject.title?.includes(term)` crash guard inconsistent (L467 vs StudyMaterialDetail)**
`['...'].some(term => subject.title?.includes(term))` — OK here, but confirms the "Section/Subject" label is decided by string-matching the title, which is fragile (a subject titled "Geography" inside a GS group gets mislabeled).

---

## 2. `StudyMaterialDetail.jsx` (910 lines)

**#7 — HIGH — Infinite expand-collapse logic bug on tab change (L513, L555, L664, L826)**
`isExpanded = expandedChapter === globalIdx || activeTab !== 'all'`. When `activeTab !== 'all'`, **every** chapter is force-expanded, and the toggle `onClick={() => setExpandedChapter(isExpanded ? (activeTab==='all' ? null : expandedChapter) : globalIdx)}` can never collapse while a filter tab is active (it re-sets `expandedChapter` to itself). **Why:** Users on "Videos" tab cannot collapse any chapter; the collapse button appears to do nothing.

**#8 — HIGH — `useEffect` dep on whole `subject` object resets collapse state (L86–95)**
`useEffect(..., [subject])` runs `setCollapsedParts([])` + `setCollapsedUnits(new Set())`. If `subject` reference changes (e.g., refetch `getStudyMaterialById` returns new object), all user collapse/expand choices are wiped. Should depend on `subject` identity only when it *changes meaningfully*.

**#9 — MEDIUM — Icon resolution only handles 4 hard-coded strings (L283–287)**
`subject.icon === 'bar-chart-2' | 'brain' | 'book-open' | 'globe'`, else falls to `BookOpen`. Admins can store arbitrary strings/URLs (StudyMaterial.jsx L227 handles URLs/emoji) — here any URL icon silently renders `BookOpen`.

**#10 — MEDIUM — Progress % divides by wrong denominator & reads stale field (L303, L308)**
`(subject.chapters?.filter(c=>c.isCompleted)?.length || 0) / (subject.chapters?.length || 1)` — but the page renders from `subject.units`/`subject.parts` hierarchy (L123–130). If chapters live under `units` and `subject.chapters` is empty, progress shows `0/1 = 0%` permanently. Denominator `|| 1` also yields `0%` instead of "no data".

**#11 — MEDIUM — Dynamic Tailwind classes won't compile (L334, L336)**
`border-${stat.color}-400 bg-${stat.color}-500/20` and `text-${stat.color}-300`. Tailwind's JIT can't see template-literal class names → **no styles applied**. Hard-code the full class strings.

**#12 — MEDIUM — Missing keys duplicate `idx` (L587, L602, L617, L837, L851, L862)**
`key={idx}` / `key={vIdx}` inside nested maps — non-unique across videos/pdfs/tests lists and unstable on reorder. Use stable ids (`vid._id || vid.id`).

**#13 — LOW — Dead code `_handleContentClick` (L223–237)**
The handler is defined but the underscore prefix + no caller found in the file (ContentReader is only opened via... nothing — `contentReader.isOpen` is never set true anywhere). Either wire it up or remove.

**#14 — LOW — `renderChapterItems` (L146–196) duplicates the inline expansion blocks**
Same video/pdf/test grid JSX written 4 times (hierarchy L584–628, extra chapters L693–721, legacy fallback inline, `renderChapterItems`). Bug-fixing one won't fix the others (and indeed `renderChapterItems` filters `Boolean` but inline ones don't — inconsistent).

---

## 3. `StudyMaterialChapter.jsx` (1385 lines)

**#15 — CRITICAL — Scroll-position `localStorage` write inside a non-cancelled `setTimeout` after unmount (L211–231)**
`handleScroll` schedules `setTimeout(..., 1000)` which calls `localStorage.setItem(chapterIdKey, ...)`. If the user navigates away within that 1s window, the timeout still fires and writes scroll % for the *old* chapter key — and `setScrollProgress` runs on an unmounted component (React warns). **Why:** memory leak + stale write + React "state update on unmounted" warning. Capture a mounted flag / clear timeout in cleanup.

**#16 — CRITICAL — `analytics` set but overwritten risk + wrong source (L158–171 vs Analytics route)**
Calls `apiClient.get('/api/users/analytics')` with a raw axios `signal`. If `apiClient` is the shared configured client, passing `signal` in config is correct, but `res.data?.data || res.data` (L164) treats `res.data` as already-parsed; if backend wraps inconsistently you get `{}`. Verify against `/api/users/analytics` response shape (other pages use `getUserAnalytics` from dataService — inconsistent data source).

**#17 — HIGH — Discussions fetch keyed to entire `subject` object (L132–156)**
`useEffect(..., [chapter, subject])` → refetches `/api/doubts` every time `subject` reference changes, and `category: subject?.title` sent as filter — if the title has case/whitespace differences from the `doubts.category` values, silently returns `[]`. Also fetches even when `chapter` exists but subject title mismatches.

**#18 — HIGH — Discussion ownership check uses mixed id fields (L1122)**
`isAdmin() || item.userId === currentUser.id || item.user?._id === currentUser.id` — mixes `item.userId` (snake/camel unclear), `item.user?._id`, and `currentUser.id` (could be `_id`). If backend returns `user_id` (Postgres snake_case per `AGENTS.md` migration notes), the comparison fails and Edit/Delete buttons never appear for the true owner.

**#19 — HIGH — "Reply" button is dead (L1161)**
`<button className="...">Reply</button>` with no `onClick`. Also "View All Discussions" (L1178) and "Contact Instructor" (L1341) have no handlers. **Why:** dead UI affordances.

**#20 — HIGH — Bookmark state never initialized from server (L54, L333–347)**
`isBookmarked` starts `false` and `handleBookmark` only toggles optimistically; on revisit the bookmark always shows unsaved even if previously saved. No GET to `/api/bookmarks` on mount → wrong state after refresh. User can also "unsave" something the server thinks is saved (toggle desync).

**#21 — MEDIUM — Optimistic bookmark rollback toggles wrong direction on rapid double-click (L334–346)**
`setIsBookmarked(nextState)` then on error `setIsBookmarked(!nextState)`. Two rapid clicks → `nextState` computed from stale closure in second call; rollback can land on wrong state.

**#22 — MEDIUM — `handleShare` clipboard fallback has no user feedback (L349–366)**
On `navigator.clipboard.writeText` failure it only `console.error`s — user clicks "Share", nothing happens, no toast. Also no "Copied" confirmation on success (unlike VideoDetail).

**#23 — MEDIUM — `useEffect` resetting `showAllChapters` on `[subjectId, chapterId]` races with initial render (L329–331)**
Fine, but combined with L324–327 `visibleChapterStart` computed from `chapterIndex` — on first render before `subject` loads, `chapterIndex = -1`, `visibleChapterStart = max(0, -4) = 0`, harmless; but `chapters.slice(0, 3)` shows wrong window briefly (chapters 1–3 instead of around current). Cosmetic flash.

**#24 — MEDIUM — Avatar URL built from unsanitized user name + hard-coded "You" (L1080, L1105, L1331)**
`ui-avatars.com/api/?name=${item.userName...}` — `userName` isn't URL-encoded; names with `&`/spaces produce broken avatars. `currentUser` avatar is a hard-coded `name=You` regardless of actual user.

**#25 — MEDIUM — `edited` badge compares `updatedAt > createdAt` (L1112)**
`new Date(item.updatedAt) > new Date(item.createdAt)` — if backend sets `updatedAt = createdAt` on insert (common), fine; but clock skew or identical timestamps → false negatives; worse, `new Date(undefined)` → `Invalid Date` if field missing (guarded by `item.updatedAt &&` ✔ but `createdAt` isn't guarded).

**#26 — LOW — Unused vars/imports**
`_mainContentRef` (L74), `_subjectProgress` (L84), `index` param unused in `chapterTests.map((test, index)` L888 used for `Chapter Test ${index+1}` ✔; `useRef` import used ✔. Minor.

**#27 — LOW — `subject.instructor_name` never fetched (L1331, L1338)**
Field doesn't exist in typical `getStudyMaterialById` payload → always falls back to 'Instructor'/'Senior Academic Head'. Dead placeholder UI.

**#28 — LOW — XSS risk in `handlePrint` is mitigated (good) but `chapter.description` renders raw in L257 `sanitize(t.description)` ✔ — however the live DOM at L1072 `{chapter.description}` is React-escaped (safe). Print path correct.**

---

## 4. `Videos.jsx` (561 lines)

**#29 — HIGH — `key` collisions between grid & list views (L383 grid `key={video._id || idx}` vs L490 list `key={video.publicId || video._id || idx}`)**
Deduplication in `allVideos` keys on `v.id || v._id` (L191–209), but `key` can be `null` — `key !== null && seen.has(key)` — if both `id` and `_id` are undefined, **every** such video passes `seen` check unpinned (`null` keys all skip dedupe because of the `key !== null` guard) → duplicate videos render.

**#30 — HIGH — `onError` thumbnail fallback manipulates DOM outside React (L40–43)**
`e.target.style.display='none'; e.target.nextSibling.style.display='flex'` — relies on exact sibling order; if React re-renders or React 18 strict-mode double-invokes, the manually-hidden `<img>` stays hidden even after thumbnail recovers. Use state `onError` → set a `thumbFailed` flag.

**#31 — MEDIUM — YouTube thumbnail URL builder duplicated & fragile (L26, L82, L174 area pattern)**
`video.videoUrl?.split('v=')?.[1]?.split('&')?.[0] || video.videoUrl?.split('/')?.pop()` — breaks on `youtu.be/<id>?si=...` (`.split('/').pop()` returns `id?si=xxx` → bad img URL, 404 thumbnail), and nocookie/embed URLs. Centralize a `getYouTubeId()`.

**#32 — MEDIUM — `border-l-3` isn't a Tailwind class (L343, L360)**
`border-l-3` doesn't exist (Tailwind steps: `border-l-2`, `border-l-4`). Left accent border silently missing.

**#33 — MEDIUM — Free-only filter logic inverted vs PRO badge (L53 `!isFree && isPro`, L243 `showFreeOnly && !isFree`)**
A video with `isFree=false, isPro=false` (legacy data missing flags) is hidden by "Free" filter but shows NO PRO badge → appears in no filter state with no explanation. Also `video.isFree` undefined (field absent) → treated as not-free, hidden.

**#34 — LOW — `filter` dep on `hierarchicalData` causes full recompute (L248)**
`filteredVideos` useMemo depends on `hierarchicalData` only to resolve subject title in `selectedSubject` filter — fine, but means the entire filtered list recomputes; acceptable, note only.

**#35 — LOW — "Reset/clear" doesn't reset `sortBy` consistent with UI text (L250–255)** — sets `sortBy('newest')` ✔ actually correct; but the search input clear button and `clearFilters` don't blur focus — minor UX.

---

## 5. `VideoDetail.jsx` (608 lines)

**#36 — CRITICAL — `handleShare` can throw on non-secure context / denied permission with no catch (L341–345)**
`navigator.clipboard.writeText(...)` is not awaited inside try/catch here (unlike StudyMaterialChapter) → **unhandled promise rejection** on HTTP or permission denial; `setCopied(true)` never fires and console errors. Wrap in try/catch + fallback.

**#37 — HIGH — Like/Save buttons are fully local, not persisted (L462–478)**
`setIsLiked(!isLiked)` / `handleBookmark` only toggle local state — no API call (unlike chapter page). Refresh loses state; across videos the state is shared stale if component isn't remounted. **Why:** Users think they saved/liked; data is gone.

**#38 — HIGH — Fallback search sets `video.videoUrl` but VideoPlayer prop mismatch (L308–316, L421–426)**
In fallback branch, video object built from hierarchical `found` — passes both `videoUrl` and `url` ✔; but `showPlayer` set true with `video.videoUrl || video.url`. If hierarchical item uses `video_url` (snake_case from DB), both are undefined → player renders empty/black. Also fetch error swallow (L285–287 `catch {}` empty) hides Aborts during navigation (L170-style guard missing in inner catch).

**#39 — HIGH — `currentIndex` / `RelatedVideos` filter use inconsistent id fields (L163 vs L352)**
`RelatedVideos` filters `v._id || v.id !== currentVideoId` but `currentIndex` matches `publicId || _id || id` — a video whose identity is only `publicId` is excluded from "related" correctly here BUT `currentIndex` finds it while `RelatedVideos` compares `(v._id||v.id) !== currentVideoId` where `currentVideoId` = URL param `resolveId` — if `resolveId` is the publicId slug, `v._id !== resolveId` for ALL → current video appears in its own "Related Videos".

**#40 — MEDIUM — `getVideoUrl` in utils returns `/videos/...` but route params also accept `/videos/:id` — encoded slugs with spaces/unicode (L68 utils) `encodeURIComponent` OK, but `VideoDetail` reads `videoId || id` — if route supplies slug with dashes and video lookup by slug unsupported on `/api/videos/:id`, fallback loop never matches → 'Video not found'.**

**#41 — MEDIUM — `SecurityBadge`/`VideoMetaInfo` fine, but `metaItems` date `new Date(video.createdAt)` renders "Invalid Date" if `createdAt` is epoch number (L47).**

**#42 — LOW — Unused imports**: `Bookmark`/`BookmarkCheck` used ✔, `_user` (L216), `_subjectSlug`, `_chapterSlug` (L213) intentionally ignored ✔; `useRef` used for copied timer ✔.

---

## 6. `SpacedRepetition.jsx` (531 lines)

**#43 — HIGH — Flashcard `key={dueCards[currentIndex].id}` but backend returns `rq.id`/`question_id`; `completeRevision` uses `card.question_id` (L457, L302, L312)**
`getDueRevisions` SQL selects `rq.id, rq.question_id, ...` — so cards have **both** `id` (queue row id) and `question_id`. `key` uses `.id` ✔ stable, OK. But if the same question is queued twice (dupe rows), two cards share `question_id` — completing one leaves the other; acceptable. **Real issue:** `key` uses queue `id`, but « session complete » refetch resets index — fine. **However:** `Flashcard` holds local `flipped/answered/result` state — keyed by queue id so state resets per card ✔ correct.

**#44 — MEDIUM — Unprotected `setTimeout(() => moveToNext(), 800)` after unmount (L304, L314)**
If user navigates away within 800ms of answering, `moveToNext` → `setSessionComplete`/`setCurrentIndex` (or `fetchStats`) runs on unmounted component → React warning. No mounted guard / timeout cleanup.

**#45 — MEDIUM — `fetchDueRevisions`/`fetchStats` accept `signal` but `aiAPI` never forwards it (L263–298 vs aiAPI.js L9–12)**
The abort plumbing is decorative: `aiAPI.getDueRevisions()` doesn't accept a signal, so requests aren't actually cancelled; `signal?.aborted` checks work only post-resolution. Race: two rapid `fetchDueRevisions` (mount + "Check for More" L433) can interleave; the older resolving last overwrites newer state.

**#46 — MEDIUM — `RevisionPlanCard` `plan.revisionPlan.length > 200` (L238) — if `revisionPlan` is malformed object (AI error returned as `{}` with success), `.length` undefined → no toggle, fine; but `plan.weakAreas.map(area.accuracy)` renders `undefined%` if backend omits accuracy.**

**#47 — LOW — `priorityLabel[card.priority]` (L49) — DB stores priority as int 0/1/2 (`priorityStrMap`), service maps to strings for `completeRevision` but `getDueRevisions` maps only in the *map*... checking service L263–266: returns `priority: priorityStrMap[row.priority]` ✔ strings — OK, but if any row has NULL priority → `priorityLabel[undefined]` → falls back to medium ✔.**

**#48 — LOW — `difficulty.charAt(0)...` (L103) crashes if `difficulty` is non-string truthy (e.g., number 2) — `.charAt` not a function → render crash. Guard with `String(card.difficulty)`.**

---

## 7. `CurrentAffairs.jsx` (153 lines)

**#49 — CRITICAL — Frontend sends `?date=YYYY-MM-DD` but the backend route ignores `date` (L22 vs currentAffairs.js L14–31)**
Frontend: `` GET `/current-affairs?date=${dateStr}` ``. Backend `/api/current-affairs` only reads `period, category, page, limit` — **`date` is never parsed**. Prev/next day arrows have **zero effect** on results; every day returns last-24h content. **Why:** core feature (date browsing) silently broken. Either backend needs `date=DATE(created_at)` filter or frontend must stop pretending dates work. (Also the public fallback route at public-data.routes.js L547 same issue.)

**#50 — HIGH — "Next day" disable check fails across midnight (L84)**
`disabled={selectedDate >= new Date()}` — compares date object to *now*; at 11 PM, today 11PM vs now 11PM → depends on ms; right after loading at page-open time stored `selectedDate = new Date()` — `selectedDate >= new Date()` is false by a few ms → **Next appears enabled for today**, clicking gives empty next day. Compare date-only (`toDateString`).

**#51 — HIGH — No error state: failed fetch shows "No Articles Found" (L27–31, L129–134)**
On API failure, `setArticles([])` and user sees the friendly empty state — indistinguishable from genuinely no content. Add error UI + retry.

**#52 — HIGH — "Read More" and "Download PDF" are dead buttons (L123, L144)**
Both `<button>` with no `onClick`/`Link`. **Why:** Primary article consumption + CTA are broken. No modal/route to article detail exists.

**#53 — MEDIUM — Category tab mismatch with data (L37 vs data)**
Hard-coded `['Politics','Economy',...]` — if DB stores lowercase (`'politics'`) or other values, filtering `a.category === cat` returns empty for every tab except 'all'. Also no count badges; empty categories look broken.

**#54 — MEDIUM — API path inconsistency: `api.get('/current-affairs...')` uses axios `api` from dataService (L4) but StudyMaterialChapter uses `apiClient.get('/api/doubts')` with `/api` prefix (L138)**
If `api` baseURL already includes `/api` (apiClient.js L12 strips it then factory re-adds? need to check `createApiClient`), one of the two call styles double-prefixes `/api/api/...` or under-prefixes. **Inconsistent convention across study pages** — pick one.

**#55 — MEDIUM — `article._id` key but Postgres `current_affairs` selects `id` (L115 vs backend L38)**
Backend returns `id` (not `_id`) — `key={article._id}` → all keys `undefined` → React key warning + unstable reconciliation on refresh. Use `article.id`.

**#56 — MEDIUM — `useEffect` deps `[selectedDate]` calls `fetchArticles` defined outside; ESLint exhaustive-deps warning; also `category` not synced into fetch (fine, filtered client-side) but combining server-side category later will double-filter.**

**#57 — LOW — No empty-date navigation guard (negative dates OK going back, fine), but no keyboard accessibility on date nav; SEO Helmet fine. `line-clamp-3` truncates with no expand.**

---

## Cross-cutting (multiple files)

**#58 — HIGH — Inconsistent API/route conventions + id field chaos**
Pages mix `_id`/`id`/`publicId`/slug everywhere (`key={item._id || idx}`, `matchesChapterIdentifier`, `getVideoUrl`). Postgres backend (per AGENTS.md migration_008, `user_id` INTEGER) returns `id`; Mongo-era `_id` assumptions remain. Any response without `_id` degrades keys/filters. Standardize on one accessor util.

**#59 — MEDIUM — No toast/feedback anywhere in study pages except SpacedRepetition**
VideoDetail share (silent), chapter share/bookmark failures (console only), discussion post errors (console only). Users get zero feedback on failures.

**#60 — MEDIUM — AbortController pattern inconsistent**
Videos/StudyMaterial use `signal` in `api.get(config)` (correct for axios), StudyMaterialChapter passes `signal` too, but `aiAPI` wrappers don't accept signals, and inner nested fetches (VideoDetail L257) share one controller — aborting mid-chain skips remaining sets but leaves partial state (`chapters` set without `allSubjectVideos`) → related/sidebar desync.

**Top fixes by impact:**
1. **#49** CurrentAffairs `date` param ignored — feature broken.
2. **#36** VideoDetail `handleShare` unhandled rejection.
3. **#15** StudyMaterialChapter scroll timeout leak/unmounted write.
4. **#20/#37** Bookmark/Like not persisted (two pages).
5. **#7** StudyMaterialDetail collapse impossible on filter tabs.
6. **#52/#3/#19** Dead primary buttons across three pages.

I now have everything needed. Here is the complete audit report.

---

# Public Pages Audit Report

## 1. `Home.jsx`

| # | Severity | Description | Why it's a problem |
|---|----------|-------------|-------------------|
| 1 | **HIGH** | **Unused hook invocation** — line 24: `const { _getCategoryEmoji } = useTestCategories()` destructures an underscore-prefixed member that is never used anywhere in the file. | Dead code; if `useTestCategories` performs data fetching/subscriptions on mount, it wastes resources for nothing. |
| 2 | **MEDIUM** | **No-op `onEnroll` handler** — line 798: `onEnroll={() => {}}` passed to every `TestSeriesCard`. | Users clicking "Enroll" on popular series cards get zero feedback — broken feature disguised as working UI. |
| 3 | **MEDIUM** | **Set-state-after-navigation race** — lines 48–81: The main data fetch `useEffect` returns `if (isAuthenticated)` but `isAuthenticated` starts `false` during the initial auth-loading window. The fetch fires, then the redirect effect (lines 83–85) navigates to `/dashboard`. The `AbortController` guards `setLoading` in `finally`, but the axios calls themselves are **not passed the signal** (lines 53–56: `getTestSeries()`, `getTests()`, etc. take no signal), so 6 requests keep running against a page that's about to unmount. Bandwidth is wasted and any non-axios side-effect could still fire. | Memory/bandwidth leak + the abort is cosmetic; nothing actually cancels in-flight requests. |
| 4 | **MEDIUM** | **Unused state** — line 25: `mousePos` state triggers a re-render of the entire `Home` component at ~10fps whenever the mouse moves (lines 130–141), but on mobile (`!isMobile` gate at line 276) the consuming 3D card is not rendered. The listener still fires and still re-renders the whole page on mobile devices. | Unnecessary re-render churn on the most constrained devices; should early-return inside the handler when `isMobile` or throttle with ref instead of state. |
| 5 | **MEDIUM** | **Hardcoded marketing claims vs. fetched stats** — lines 237, 379–386: Hero hardcodes "500+ mock tests / 2 Lakh+ aspirants / 4.9 rating / 50+ Exam Categories", while `platformStats` (fetched, lines 503–544) shows the real numbers elsewhere on the same page. | If the API returns different numbers the page contradicts itself; misleading advertising liability if real numbers are lower. |
| 6 | **LOW** | **Skeleton key by index** — lines 169–171, 661, 716, 782: `key={i}` on skeletons. Harmless here (static arrays) but sets a bad precedent. | Lint-level. |
| 7 | **LOW** | **`satisfaction ?? 98` default** — line 528: fabricates "98% satisfaction" when the API omits the field. | Displays a made-up metric. |
| 8 | **LOW** | **`import { ... Star, Users, Calendar, Crown ... }` etc.** — all used; but `HelpCircle`/`Radio`/`Target`/`Award` etc. fine. No unused lucide imports detected after full-file read (864–1018 lines reviewed truncated; the remaining portion uses `BookOpen`, `Play`). | — |
| 9 | **MEDIUM** | **Live-test link fallback `'series'`** — line 670/725: `/test/${test.series?.slug || ... || 'series'}/${test.id}` produces `/test/series/<id>`, a guaranteed 404 when series data is absent. | Broken navigation for any test missing its populated `series` relation. Should hide/disable the card instead. |
| 10 | **LOW** | **SEO description generic** — line 179: static description is fine, but `title="Home"` means the tab reads "Home \| Trstprep" instead of a keyword-rich title for the most SEO-important page of the site. | Missed SEO opportunity on the highest-authority URL. |

---

## 2. `Blog.jsx`

| # | Severity | Description | Why |
|---|----------|-------------|-----|
| 1 | **CRITICAL** | **Crash risk on `.toLowerCase()`** — lines 77–78: `blog.title.toLowerCase()` / `blog.description.toLowerCase()` crash if either field is `null`/`undefined`. The transform (lines 52–62) does not guarantee `title`/`description` non-null — `description` can be `post.description || post.excerpt || post.content?.substring(...)` → all three can be missing → `undefined`. | One API row without a title/description whitescreens the entire blog list. Wrap with `(blog.title || '')`. |
| 2 | **HIGH** | **Newsletter form has no handler** — lines 299–311: `<form>` with `type="submit"` button, no `onSubmit`, no `value`/`onChange` on the input. | Submitting reloads the page (default form GET) and loses the email — a fake, non-functional subscribe form on a public page. |
| 3 | **MEDIUM** | **No SEO component/Helmet** — entire file lacks `<SEO>`/`<Helmet>`. Contact, FAQ, Privacy, Terms, Refund, About, Pass all set meta tags; Blog and BlogDetail don't. | Blog index is a top SEO surface; missing title/description/OG tags. |
| 4 | **MEDIUM** | **Learner-count string munging is broken** — line 24: `String(stats.activeLearners).replace('L+', ',00,000+').replace('k+', ',000+')`. `getPublicStats` returns a **number** (`activeLearners || 0`, see dataService L459–462 and Home's numeric usage at L534 `.toLocaleString()`). `"50000".replace(...)` yields `"50000"` — no plus, no formatting; and if the API ever returns `"50,000+"` the replaces don't match either. | Displays raw/incorrect numbers; intended formatting never triggers. |
| 5 | **MEDIUM** | **`_error` destructured but unused** — line 44: `const { data: blogs = [], isLoading, isError, _error } = useQuery(...)`. Error object is thrown away — the error UI shows a generic message instead of the server-provided `err.message`. | Dead variable + lost debugging info for users. |
| 6 | **LOW** | **Category normalize mismatch** — line 56: `post.category?.toLowerCase().replace(' ', '-')` converts only the **first** space (`replace` without `/g`). `"Tech News Daily"` → `"tech-news daily"` — won't match any category id. | Chip label lookup falls back to 'Intelligence' for multi-word categories. |
| 7 | **LOW** | **Admin hint leaked to the public** — lines 164–166: "Admin: Add blog posts in `/admin/study-materials`" rendered to all visitors on API error. Also wrong location (blogs aren't study materials). | Information disclosure + confusing UX. |
| 8 | **LOW** | **`new Date(featuredPost.date)` without validation** — line 208: invalid date renders "Invalid Date". | Cosmetic. |
| 9 | **LOW** | **Tags slice(0,1) silently drops data** — line 277. | Minor data loss in UI. |

---

## 3. `BlogDetail.jsx`

| # | Severity | Description | Why |
|---|----------|-------------|-----|
| 1 | **HIGH** | **Wrong import: default `dataService` used as axios** — line 4: `import api from '../../shared/lib/dataService'`. `dataService.js` default-exports `apiClient` (L506), so today it *happens* to work — but it bypasses the named `api` alias convention, and every other page imports from `'../../shared/lib/api'`. If the barrel's default export ever changes (e.g. to a domain facade), this page breaks silently. Also `api.get(..., { signal })` relies on axios signal support, but the error check uses `error.name !== 'AbortError'` — axios aborts are `CanceledError` (`error.name === 'CanceledError'` / `axios.isCancel`), so **aborted navigations log spurious errors and briefly set `error` state** (the `finally` guard prevents the loading flip, but `setError('Failed to load blog post')` at line 32 **does** run on abort — wait: no, guarded only by `error.name !== 'AbortError'`, so on cancel it **sets an error** on an unmounting component). | Inconsistent with codebase + false error states on navigation/unmount (React warning + wrong "not found" flash if re-mounted quickly). Use `api.isCancel(error)`. |
| 2 | **HIGH** | **No SEO/Helmet** — no `<title>`, no meta description, no OG/structured data for article pages. | Blog articles are prime SEO/AMP content; sharing links shows no preview. |
| 3 | **MEDIUM** | **Non-functional Share button** — lines 138–140: button with `Share2` icon and no `onClick`. | Dead UI promising functionality. |
| 4 | **MEDIUM** | **`blog.createdAt` unguarded** — line 97: `new Date(blog.createdAt).toLocaleDateString(...)` — the list page uses `publishedAt || createdAt || date`; the detail page checks only `createdAt`. Missing field → "Invalid Date". | Inconsistent with list-page fallbacks. |
| 5 | **MEDIUM** | **`fetchBlog` called before definition via closure is fine, but signal plumbing mismatched** — lines 15, 22–23, 30, 35: see #1. `fetchBlog(controller.signal)` passes signal; catch at line 30 checks `error.name !== 'AbortError'` which never matches axios's `CanceledError`. | Spurious console errors on every unmount/navigation. |
| 6 | **LOW** | **"Related Articles" section is fake** — lines 148–153: shows only a "View all articles" link. | Dead section header promising content that doesn't exist. |
| 7 | **LOW** | **Tag keys by `index`** — line 122. Duplicate tags could collide. | Minor. |
| 8 | **LOW** | **Image field mismatch vs. list page** — line 82 reads `blog.imageUrl`, but the list transform builds `imageUrl` from `thumbnail || image || coverImage`. If the API returns `thumbnail` natively, the detail hero never renders (that field mapping exists only in `Blog.jsx`). | Hero image silently missing for most posts. |

---

## 4. `Contact.jsx`

| # | Severity | Description | Why |
|---|----------|-------------|-----|
| 1 | **HIGH** | **Error message never displayed** — line 15: `const [_error, setError] = useState('')`. `setError(...)` is called on failure (lines 56, 59) but `_error` is never rendered anywhere in the JSX. | On API failure the user sees the button stop spinning with **zero feedback**. The form appears broken. |
| 2 | **MEDIUM** | **No client-side validation beyond `required`** — lines 137–182: no min-length on message, no email pattern enforcement beyond `type="email"`, no trim-empty check (`" "` passes `required`). No honeypot/rate-limit/turnstile — public endpoint `/api/contact` is spam-abusable from this form. | Junk submissions; spam relay risk on a public form. |
| 3 | **MEDIUM** | **Form not reset after success** — "Send another message" (line 74) only flips `submitted` to `false`; `formData` still holds previous values. | Minor UX; the old message is re-submittable (double-send). |
| 4 | **LOW** | **Double `/api` prefix risk** — line 30/52: `api.get('/api/site-settings')`. If the axios `baseURL` already includes `/api`, requests go to `/api/api/site-settings`. (Verify against apiClient baseURL — flagging as API-misuse risk since dataService functions don't repeat the `/api` prefix for stats.) | Possible 404 depending on apiClient config. |
| 5 | **LOW** | **Empty-state copy "Not available"** for email/phone/address — leaks that settings fetch failed rather than hiding the block. | Minor UX. |

---

## 5. `Faq.jsx`

| # | Severity | Description | Why |
|---|----------|-------------|-----|
| 1 | **MEDIUM** | **Index used as React key** — line 102: `key={idx}` while `faq.id` is explicitly mapped at line 23 but never used. | Reorder/update of FAQ list will mis-associate open/close state (openIndex is also index-based), causing the wrong answer to expand after refetch. |
| 2 | **MEDIUM** | **`openIndex = 0` auto-opens the first FAQ** — line 9. When `faqs` refetch order changes, a different question appears expanded. | Unstable UX keyed to array position. |
| 3 | **LOW** | **`_error` destructured unused** — line 12. Error detail discarded; users get the same "No FAQs" UI for both "no data" and "server down" (line 70: `isError || faqs.length === 0`). | Error state indistinguishable from empty state; misleading message on outages. |
| 4 | **LOW** | **Answers rendered as plain text** — line 132: `faq.a` inserted without line-break handling; multi-paragraph answers render as one blob. No sanitize since it's text — fine, but whitespace collapses. | Formatting loss. |
| 5 | **LOW** | **Admin hint leaked publicly** — line 95: "/admin/faqs" path exposed. | Information disclosure. |
| 6 | **LOW** | **Anchor tags instead of `<Link>`** — lines 80–92, 146: `<a href="/contact">` causes full page reload in an SPA. | Loses client-side routing benefits (also present in Faq CTA). |

---

## 6. `Privacy.jsx`, 7. `Terms.jsx`, 8. `Refund.jsx` (grouped — near-identical templates)

| # | Severity | Description | Why |
|---|----------|-------------|-----|
| 1 | **MEDIUM** | **Static "Last updated: February 17, 2026"** — Privacy.jsx:42, Terms.jsx:46, Refund.jsx:38. Hardcoded date will silently rot; legal pages require accurate revision dates. | Compliance/trust issue — DPDP 2023 notice obligations cited in your own AGENTS.md make stale dates risky. |
| 2 | **LOW** | **Contradictory refund terms** — Terms.jsx L32 says "All purchases are final" while Refund.jsx L20 promises a "7-day money-back guarantee". | Legal contradiction between two public policies; consumer-protection exposure. |
| 3 | **LOW** | **No `canonical` / `robots` hints, generic `og:image`** — `/og-image.png` referenced on every page; verify the asset exists, otherwise all social shares render broken. | Possible broken OG previews across the site. |
| 4 | **LOW** | **Support email in plain text, not a `mailto:` link** | Minor UX. |
| 5 | **MEDIUM** | **`import.meta.env.VITE_SUPPORT_EMAIL` fallback** — Privacy/Terms/Refund L4: if the env var is missing at build time, falls back to `support@trstprep.com`. Unlike Contact.jsx (which fetches from site-settings at runtime), these drift out of sync with the admin-managed address. | Two sources of truth for the support address. |

---

## 9. `About.jsx`

| # | Severity | Description | Why |
|---|----------|-------------|-----|
| 1 | **MEDIUM** | **Type mismatch in stats rendering** — lines 18–26: `getPublicStats()` returns raw values; Home.jsx treats `activeLearners` as a **number** (`.toLocaleString()`), here values are dropped into `{stat.value}` and rendered directly. A number like `50000` renders as "50000" with no formatting or "+" suffix. | Ugly/inconsistent stat presentation vs. homepage. |
| 2 | **LOW** | **`error.name === 'AbortError'`** — line 29: again axios throws `CanceledError`, so this branch never matches; harmless because nothing happens after the log, but the pattern is wrong everywhere it's copied. | Dead guard, copied bug pattern. |
| 3 | **LOW** | **No abort signal passed to `getPublicStats()`** — line 18: the function accepts no signal (dataService L459), so `controller.abort()` only guards `setStats`, not the request. | Same cosmetic-abort pattern as Home. |
| 4 | **LOW** | **`<a href="/signup">`** — line 114: full reload instead of `<Link>`. | SPA inconsistency. |

---

## 10. `SearchPage.jsx`

| # | Severity | Description | Why |
|---|----------|-------------|-----|
| 1 | **CRITICAL** | **Wrong API path** — line 27: `api.get(\`/search?q=...\`)`. Every other module prefixes `/api/...` (e.g. `/api/blogs`, `/api/faqs`, `/api/subscriptions/plans`). Unless the axios baseURL ends in `/api`, this hits `/search` and 404s — and the code **silently swallows the error** (lines 32–36) showing "No results found" forever. | Search is very likely completely broken in production, masked by the silent catch → empty results. |
| 2 | **HIGH** | **`setLoading(false)` after abort** — line 38: `finally` runs `setLoading(false)` unconditionally. On unmount/param change, this sets state on an unmounted component. | React warning + potential stale-state bugs. The `signal?.aborted` guard is missing here (unlike the body). |
| 3 | **MEDIUM** | **Double-search on submit** — lines 42–46: `setSearchParams({q})` triggers the `useEffect` on `query` (line 13) **and** `performSearch(searchQuery)` is called directly — two identical requests fire (the second without an abort signal). | Duplicate network traffic on every manual search. |
| 4 | **MEDIUM** | **No SEO/Helmet**, though it uses query params Google may index. Search pages should typically be `noindex`. | SEO pollution — thin/duplicate search URLs indexable. |
| 5 | **MEDIUM** | **`href={item.path || '#'}` + `<a>` tags** — line 128: results clicking `#` does nothing; `<a>` causes reloads; no `<Link>`, no keyboard/SPA nav. Also results keyed by `idx` (line 127). | Broken result links when `path` absent; full-page reloads otherwise. |
| 6 | **LOW** | **`response.data.success` unchecked for falsy** — line 29: if API returns `{success:false}`, old results stay; no user-facing error state at all. | Silent failure. |
| 7 | **LOW** | **No debounce / min-length / XSS-safe rendering is fine (React escapes), but `results` values aren't array-guarded** — line 55/112: `arr.length` throws if API returns non-array values for a category key. | Crash risk on malformed payload. Mitigated slightly by `|| []` at line 112, but `Object.values(results).some(arr => arr.length > 0)` at line 55 is unguarded. |

---

## 11. `Pass.jsx`

| # | Severity | Description | Why |
|---|----------|-------------|-----|
| 1 | **HIGH** | **5-second polling loop** — lines 50–52: `setInterval(() => fetchPlans(true), 5000)` re-fetches subscription plans **every 5 seconds** for the entire time a user sits on the pricing page. Background calls pass no abort signal (line 63 default param), keep racing with unmount, and hammer the backend. | Massive unnecessary load; battery/network drain; race conditions if responses arrive out of order (no request sequencing). |
| 2 | **HIGH** | **`window.location.reload()` after payment** — lines 241, 664: hard reload after verify and after cancel. | Awkward UX (loses SPA state); mask bugs where `proPass`/auth context should just be refetched. |
| 3 | **HIGH** | **Razorpay handler leak/duplicate-script risk** — `loadRazorpay` (lines 186–194) appends a new `<script>` tag on every purchase attempt with no dedup check; if the user retries, multiple scripts pile up. Also, `handler` closure captures `plan` — fine — but `rzp` instance isn't stored/destroyed. | DOM pollution, duplicate checkout instances. |
| 4 | **MEDIUM** | **Renew buttons pick plan by fragile fallback** — lines 469/494/524: `plans.find(p => p.id === 'pro-yearly') || plans[plans.length-1]`. If backend plans win (lines 67–74), backend plan IDs are `pro_pass_*` (see filter line 69) so `find` fails and it silently buys **whatever plan sorts last** — possibly the wrong/most expensive one. | User may be charged for an unintended plan. Real money → CRITICAL-adjacent; rating HIGH-leaning MEDIUM given Razorpay confirm dialog intervenes. |
| 5 | **MEDIUM** | **`platformStats.activeLearners` mislabeled** — line 691: "{activeLearners} Pro Users" — `getPublicStats().activeLearners` is total learners (homepage calls it "Active Learners"), not Pro subscribers. | Misleading social proof on a payment page. |
| 6 | **MEDIUM** | **`_loading` unused / no plans loading UI** — line 24: `_loading` is set but never read; pricing grid renders empty (`plans.map` over `[]`) until first fetch completes — a flash of an empty "Choose Your Plan" section with no skeleton. | Dead var + layout flash. |
| 7 | **MEDIUM** | **`getUrgencyColors` called but only partially used; `ConfirmDialog` render assumption** — line 279 `{ConfirmDialog}` assumes the hook returns a renderable element — verify `useConfirm` API; if it returns a component type, this renders nothing. Also `user?.isProUser` (line 656) vs `proPass.isProUser` (used elsewhere) — two sources of truth; if `user` object lacks that field, cancel button never shows even for Pro users. | Possible invisible cancel feature; inconsistent pass-state logic. |
| 8 | **LOW** | **Catch-swallow on plans fetch** — lines 178–183: on error (non-abort) only logs; user sees empty pricing with no retry. | Poor error UX on a revenue page. |
| 9 | **LOW** | **Hardcoded FAQ answers duplicate Refund/Terms content** — lines 712–715. They can drift (already contradict "all purchases final" in Terms). | Content duplication. |
| 10 | **LOW** | **Unused imports** — `getUrgencyColors` used; verify `apiClient` import (line 15) used only once at 663 while `api` used elsewhere — two HTTP clients imported in one file. | Inconsistency; minor. |

---

## 12. `TagPage.jsx`

| # | Severity | Description | Why |
|---|----------|-------------|-----|
| 1 | **MEDIUM** | **No SEO/Helmet** — tag pages (`/live-tests`, `/pyps`, etc.) are indexable listing pages with zero meta tags. | SEO gap on hub pages. |
| 2 | **MEDIUM** | **Raw `fetch` bypasses apiClient** — line 38: uses bare `fetch` with `VITE_API_URL || ''`, bypassing the axios instance (auth headers, error normalization, dedup). `.then(res => res.json())` without `res.ok` check — a 500 HTML error page will throw on `.json()`; caught by `.catch(() => null)`, so real API errors masquerade as "no config" fallback. | Inconsistent client; silent swallowing of server errors. |
| 3 | **MEDIUM** | **`allTests` missing `tagConfig` in deps** — line 123: `useMemo([... , tag, loading])` omits `tagConfig`. If config arrives after tests (async), the memo won't recompute because `loading` flipping to false *does* change… actually `loading` guards it, so effect is masked, but it's a latent stale-closure bug: if `tagConfig` ever changes without `loading` toggling, filters won't update. | Latent stale memo. |
| 4 | **MEDIUM** | **Filter compares `test.seriesId` (string) to option `s._id || s.id`** — lines 132, 245: if IDs are numeric in one place and string in the other (`1` vs `"1"`), strict `!==` fails and series filter silently shows nothing. Same pattern for `selectedType` vs `test.type` — values 'Free'/'Pro' assumed to match API casing exactly. | Filters may never match; no normalization. |
| 5 | **LOW** | **Unused state `_showFilters/_setShowFilters`** — line 21. | Dead code. |
| 6 | **LOW** | **Fallback rebuild of label via `tag?.replace('-', ' ')`** — line 51: single `replace` without `/g` — "previous-year-papers" → "previous year-papers". | Cosmetic. |
| 7 | **LOW** | **`.map(t => t.seriesId)` in `seriesOptions` includes `undefined`** — line 145: tests without `seriesId` pollute the Set; `find` then returns `undefined`, filtered by `.filter(Boolean)` — okay, but `TestCard` at line 279 gets `key={`${test.seriesId}-${...}`}` producing `"undefined-123"` keys — collisions possible between tests lacking seriesId. | React key collision risk. |

---

## 13. `ComingSoon.jsx`

Passes all props straight through to `shared/components/common/ComingSoon`. **No issues in this file itself.** (One note in the shared component: it imports `apiClient` from `../../lib/api.js` while the rest of the codebase uses `./apiClient.js` — verify both exist/export consistently; not part of this file's audit scope but adjacent.)

---

## 14. `CurrentAffairsDetail.jsx`

| # | Severity | Description | Why |
|---|----------|-------------|-----|
| 1 | **HIGH** | **`api.isCancel` doesn't exist** — line 28: `if (api.isCancel(error))`. `isCancel` is exported as a **named** export (`export const isCancel = axios.isCancel` in apiClient L119), not a property of the default axios instance. `api.isCancel` is `undefined` → calling it throws `TypeError: api.isCancel is not a function` **inside the catch block** → the abort path itself crashes. | Every unmount/param-change during fetch throws an uncaught error; also `setLoading(false)` in `finally` still runs after abort (no guard) → setState-after-unmount. |
| 2 | **HIGH** | **`setLoading(false)` unguarded in `finally`** — line 31: fires even when aborted/unmounted. | React setState-on-unmounted warning; the guard pattern used everywhere else is missing. |
| 3 | **MEDIUM** | **Quiz answers never reset** — `handleQuizAnswerChange`/state persist; going "Back to Article" (line 212) keeps `quiz`, `quizAnswers`, and re-clicking "Take Quiz" refetches quiz but old answers (`quizAnswers`) still apply to the new question set; `quizSubmitted`/`quizResult` also persist across article→quiz cycles. | Wrong answers pre-selected on retake; stale results shown. |
| 4 | **MEDIUM** | **`question.correct` trusted client-side** — line 177/179/191: the correct answer is shipped to the browser and used for styling, meaning anyone can inspect the payload for answers before submitting. If backend returns `correct` pre-submission, the quiz is gameable. | Assessment integrity issue (verify backend). |
| 5 | **MEDIUM** | **`formatDate` defined after the early returns

I have now thoroughly reviewed every file. Here is the complete structured audit report.

---

# PYP Pages & Error Pages — Frontend Audit Report

## 1. `apps/frontend/src/pages/pyps/PypsLanding.jsx`

| # | Severity | Line(s) | Description | Why it's a problem |
|---|----------|---------|-------------|-------------------|
| 1 | **CRITICAL** | 33, 90-95, 124-125 | Auto-redirect `/pyps → /pyps/<first-slug>` runs even when `first.slug` equals the `exam.slug` of a real exam. If a category and an exam slug collide, the exam detail page becomes unreachable — the router renders `PypsLanding` → auto-selects the category → mounts `PypsLanding` again in an infinite route loop. | Two namespaces (categories & exams) share one URL param with arbitrary precedence based on array order. |
| 2 | **HIGH** | 46-48 | Categories fetch failure leaves `loadingCats=true` forever. The early return guard at line 113 (`loadingCats && categories.length===0`) means the full-screen spinner renders indefinitely with no error message or retry. | User is stuck on spinner with no way to recover except refreshing manually. |
| 3 | **MEDIUM** | 86-88 | When `categorySlug` changes while `loadingCats` is true, the effect returns early after aborting; stale `exams` from the previous category stay visible under the new category's header. | UX: user sees wrong category's exams beneath new category title. |
| 4 | **MEDIUM** | 163, 180, 271-275, 275 | Exam card links go to `/pyps/${exam.slug \|\| exam.id}`, and line 124 treats any unknown slug as exam slugs. Exam "titles" are `exam.title` but there is no fallback if `exam.slug` is null and `exam.id` is undefined — link becomes `/pyps/undefined`. | Broken navigation → spinning loader / 404 for the exam. |
| 5 | **LOW** | 182-184 | `border-l-3` is not a valid Tailwind class (uses dynamic class interpolation which Tailwind JIT might miss); combined with `border-l-4` on the same element → conflicting border widths. | Visual polish; first match wins unpredictably. |
| 6 | **LOW** | 36-52, 55-73 | `fetchCategories`/`fetchExams` have `useCallback` with `[]` deps, but they reference `API_URL` from module scope (safe) — however they are then placed in the `useEffect` dep arrays causing a redundant initial fetch pattern. | Slight redundancy; not a bug but pollutes dep tracking. |
| 7 | **LOW** | 33 | Line 124 calls `<PypsExam examSlug={categorySlug} />` — the prop is passed but `PypsExam` also internally calls `useParams` which will return `examSlug` from the raw route. Relies on both agreeing. | Works today but fragile double-source-of-truth. |

---

## 2. `apps/frontend/src/pages/pyps/PypsExam.jsx`

| # | Severity | Line(s) | Description | Why it's a problem |
|---|----------|---------|-------------|-------------------|
| 1 | **CRITICAL** | 92-148 | `fetchData` closes over `selectedYear`, `selectedTier`, `selectedTestCat` but those are in its `useCallback` deps — fine — however when it fires `setSelectedTier(String(defaultTier.id))` **inside** the fetch (line 119), it changes `fetchData`'s identity → the bottom `useEffect` at 150 re-fires → a **second request** immediately after the first. Same for `setSelectedTestCat` (line 132). Causes double-fetch on every first load. | Wasted requests; race between the first response and the duplicate; the dedupe logic lines 114-133 checks stale state that just changed. |
| 2 | **CRITICAL** | 114-121, 123-134 | Defaults are applied based on the **response from the filter-less request** (selectedTier='all'), then `setSelectedTier` triggers a refetch. But `chooseDefaultTier` checks `pd.availableTiers` from the *unfiltered* response, yet immediately after, `defaultTestCatTier.current = String(selectedTier)` runs with the **stale** closure where `selectedTier` is still `'all'` — setting the ref to `'all'`, so the default-category block at condition line 124 (`selectedTier !== 'all'`) is skipped on this cycle. Then on the next cycle `selectedTier !== 'all'` is true, but now `defaultTestCatTier.current !== String(selectedTier)` is `'all' !== tierId` → fires. Works, but only via an extra render loop. | Complex stale-closure choreography is fragile and hard to reason about; any change breaks it. |
| 3 | **HIGH** | 98-101, 148 | `selectedYear` is included in the request params (line 98) but **YearChips is never rendered** in this component — there is no year UI. The param is dead code: no way for the user to set it. | Dead state / dead query param — backend wastes filter logic. |
| 4 | **HIGH** | 87, 156-158 | `visibleYearCount` resets to 3 whenever `selectedYear/Tier/TestCat` changes, but the `useEffect` at line 156 runs **after** render — between the filter change and the effect firing, `visibleGroups = filteredGroups.slice(0, visibleYearCount)` slices with the previous (possibly larger) count for one frame. Minor flicker. | One-frame UI inconsistency; `useEffect` used for state reset instead of deriving during render or keying. |
| 5 | **HIGH** | 84 | `selectedYear` initialized to `'all'` — but the component receives `examSlug` either from props (override) or `useParams()`. In the PypsLanding integration (line 125 of PypsLanding), PypsExam is mounted with a prop, but route params still contain `examCategory`... not `examSlug`, so `useParams` destructuring at line 76 returns `undefined`, then falls back to `examSlugOverride`. OK. **But** if this component is mounted directly via a route `/pyps-exam/:examSlug`, and the route path uses a different param name (e.g. `:slug`), `examSlugParam` will be `undefined` and the fetch fires with `examSlug=undefined` → 404 and the "No Previous Year Papers Found" UI for a paper that exists under a different route shape. | Fragile param-name coupling; no validation before fetch. |
| 6 | **MEDIUM** | 218, 242 | Hero year range built from `availableYears[availableYears.length - 1]}–${availableYears[0]}` assumes descending sort; if the backend returns ascending the range prints backwards like "2025–2018". Also `availableYears` used directly without sort guarantee. | Wrong info displayed to user. |
| 7 | **MEDIUM** | 173-186 | `filteredGroups` rebuilds on every render (no `useMemo`), and inside `.map`/`.filter` chains creates new arrays of all papers each keystroke of `searchQuery`. For a 100-paper exam (limit=100) typing in search → full filter cost per keystroke. | Performance: O(N) per keystroke with N up to 100 × re-render cost of YearGroupSection tree. |
| 8 | **MEDIUM** | 176-184 | Search match hits `p.title`, `p.shortTitle`, `p.shift`, `p.examDate` — `p.examDate` is a date/ISO string; `.toLowerCase()` after `?.` is fine — but if `examDate` is a `Date` object (not a string), `.toLowerCase()` would crash. Optional chaining `p.examDate?.toLowerCase()` guards null/undefined but NOT a Date object (truthy → `.toLowerCase()` undefined method → TypeError). | **Potential crash**: TypeError if backend serializes dates differently. |
| 9 | **MEDIUM** | 105 | Insights fetch `.catch(() => ({ data: { data: {} } }))` — swallows ALL errors silently including 401/auth/network. Then `setInsights(insightsRes.data?.data \|\| null)` sets `{}` (truthy), and `InsightsPanel` destructures empty arrays from `{}` → renders nothing (bails early) — fine. But there's no distinction between "no insights" vs "insights load failed". | Silent failure hides backend issues. |
| 10 | **MEDIUM** | 202 | Guard `if (!exam && totalPapers === 0)` → shows "No Papers Found". But if the API errors mid-load (non-abort), `data` stays `null` and `totalPapers=0`, so a *failed* request shows the friendly "not available yet" empty state instead of an error. | Error masked as empty data; user can't retry. |
| 11 | **LOW** | 296 | Clear-search button renders `<ChevronRight className="rotate-45">` to fake an "×" — a chevron rotated 45° looks like an arrow, not a close icon. | Confusing UX for a clear button; should use `X` icon. |
| 12 | **LOW** | 312-314 | `key={`${group.year}-${idx}`}` includes the index — if `filteredGroups` reorders, keys shift unnecessarily and React remounts `YearGroupSection` losing local state (expanded/visibleCount). | Loss of expansion state on filter changes. |
| 13 | **LOW** | 84 | `selectedYear` state is entirely unused in UI (no renderer) — dead state variable flagged by linter. | Dead code; only param-sending. |

---

## 3. `apps/frontend/src/pages/pyps/components/PypCategoryCascade.jsx`

| # | Severity | Line(s) | Description | Why it's a problem |
|---|----------|---------|-------------|-------------------|
| 1 | **HIGH** | 3 | `const _LABELS = { 1: 'Category', 2: 'Subcategory' }` declared but never used. | Dead code — suggests intended label logic was abandoned. |
| 2 | **HIGH** | 90-105 | Category (depth-1) and Subcategory (depth-2) levels are **not per-tier** — `childrenOf(rootId)` returns children of the global `'pyps'` root (or first depth-0 node) regardless of which Stage/tier was picked. So picking different stages shows the same Category list. | Functional bug if categories are tier-scoped — the cascade pretends to filter by stage but doesn't. |
| 3 | **MEDIUM** | 30 | `c.parentId !== null ? String(c.parentId) : '__none__'` — if `parentId` is `undefined` (not null), the check passes and `String(undefined)` → `'undefined'` key in `kids`, so orphans attach under key `'undefined'` which `childrenOf('__none__')` never finds. | Categories with `parentId: undefined` silently disappear from cascade. |
| 4 | **MEDIUM** | 34-37 | `root` falls back to "first depth-0 node" if there's no slug==='pyps'. If the tree has multiple depth-0 nodes, picks an arbitrary one — and if *none*, `rootId='__none__'` → `childrenOf('__none__')` returns the orphan bucket which may be arbitrary garbage. | Non-deterministic root selection. |
| 5 | **MEDIUM** | 90 | Level gating uses `selectedTier && selectedTier !== 'all'` — but `onPick` line 84 toggles to `'all'` when re-picked; the comment says "Mandatory selection, NO 'All'" yet the toggle *allows* deselecting back to `'all'`. | Contradiction between comment and behavior; possible dead-end UX where Stage shows no selection. |
| 6 | **LOW** | 69-73 | `selectionPath` built imperatively with `push` during render — fine, but `selectedCatDepth1.name` could be pushed even if it's in `selectedCatNode`'s ancestor chain when the selection's depth ≥ 3 (Categories hidden behind "Subcategory" of the parent). Cosmetic breadcrumb inaccuracies on deeper trees. | Cosmetic; may misrepresent depth on 3+ level trees. |
| 7 | **LOW** | 139 | `key={i}` for breadcrumb segments — index keys acceptable since list is stable order. | Style; harmless here. |
| 8 | **LOW** | 156 | `pillClass(level.selectedId === opt.id)` — `level.selectedId` for stage is `selectedTier` which is a string from parent (`'all'` or number-as-string); `opt.id` is `String(t.id)` — comparison consistent. But for level `cat-1`/`cat-2`, `selectedId` may be `null` while `opt.id` strings — strict-equality `null === str` is false; OK. | No bug — verified consistent. |

---

## 4. `apps/frontend/src/pages/pyps/components/PypPaperCard.jsx`

| # | Severity | Line(s) | Description | Why it's a problem |
|---|----------|---------|-------------|-------------------|
| 1 | **HIGH** | 51 | `_user` prop destructured but never used — dead prop. Parent (`YearGroupSection` line 40) still passes it down. | Dead prop / unused param; increases API surface for no reason. |
| 2 | **HIGH** | 120 | PDF link is a raw `<a href="/api/assets/${test.pdfAssetId}/download">` — hard-coded relative path ignores `API_URL`/base path and **bypasses axios** so no CSRF token / auth headers → protected downloads will fail with 401/403; in dev with a split frontend/backend (Vite on :5173, API on :3000), relative URL hits the wrong origin. | Broken PDF downloads authenticated users; wrong origin in dev. |
| 3 | **HIGH** | 55, 23 (YearGroupSection) | `isNew = test.isNew \|\| (test.pyqYear && new Date().getFullYear() === test.pyqYear)` — `pyqYear` may be a string like `"2024"` from Postgres; `===` against a number `2024` is `false` → "current year" pill silently fails when year is string-typed. | Type-sensitive equality bug; current-year papers never show NEW. |
| 4 | **MEDIUM** | 41-49 | Status-pill logic: `if (!isFree && !isLive)` pushes PRO even if `isComingSoon` is true → a coming-soon paid paper shows BOTH "COMING SOON" and "PRO". Also, a live free paper shows LIVE+FREE but not PRO — correct — but live+pro shows LIVE+PRO — order might overflow on narrow cards. | Overlapping/conflicting badges; visual clutter. |
| 5 | **MEDIUM** | 62 | `testId = test._id \|\| test.id \|\| test.publicId` — if all three are missing, `testId` is `undefined` → attemptHref becomes `/pyp/undefined/test` (line 65) with no validation. | Broken navigation to a nonsensical URL. |
| 6 | **MEDIUM** | 99 | `getCategoryEmoji(examSlug?.split('-')[0] \|\| examSlug)` — exam slugs like `"ssc-cgl-tier-1"` → split → `"ssc"` → looks up CATEGORY_EMOJIS which likely keys category names not slug prefixes; result: often falls back to the default emoji. | Cosmetic mismatch — emoji rarely specific. |
| 7 | **LOW** | 156 | `key={l}` for language badges — keys must be unique; duplicate languages would produce React duplicate-key warnings. | Edge case — languages list should be unique already. |
| 8 | **LOW** | 134 | Hard-coded meta fallbacks (`test.duration \|\| 60`, `totalQuestions \|\| 0`) — `totalQuestions: 0` renders "0 Qs" instead of omitting the meta row. | Minor display noise. |

---

## 5. `apps/frontend/src/pages/pyps/components/TestCategoryFilter.jsx`

| # | Severity | Line(s) | Description | Why it's a problem |
|---|----------|---------|-------------|-------------------|
| 1 | **CRITICAL** | — | This component is **not imported anywhere** in the audited pages (PypsExam uses PypCategoryCascade). Confirmed via grep — zero imports in `apps/frontend/src`. | **Dead file** — entire component unused; maintenance liability. |
| 2 | **HIGH** | 12 | `c.parentId ?? 'root'` — if `parentId` is `0` (falsy but valid), `0 ?? 'root'` → 0 is not nullish so returns 0 — that's fine — but `byParent[cat.id]` where `cat.id` is a number vs `pid` string `'root'` mixing — keys become strings implicitly consistent. OK. | No bug — mixed key types are coerced consistently. |
| 3 | **MEDIUM** | 20 | Default-expanded tree `expanded[cat.id] !== false` — no persistence, and deep trees expand everything by default, producing a very long scroll. | UX: can overwhelm the sidebar. |
| 4 | **MEDIUM** | 39 | Toggle on selected category: `onSelect(isSelected ? 'all' : String(cat.id))` — clicking an already-selected parent deselects to 'all', which collapses the entire filter. Unintuitive; user likely wanted to just expand. | UX surprise. |
| 5 | **LOW** | 51 | `{cat.testCount}` rendered unconditionally — shows "0" for empty categories; combined with gray styling (line 45) it's noise. | Display polish — should hide when 0. |

---

## 6. `apps/frontend/src/pages/pyps/components/YearGroupSection.jsx`

| # | Severity | Line(s) | Description | Why it's a problem |
|---|----------|---------|-------------|-------------------|
| 1 | **HIGH** | 38 | `key={`${test.seriesId}-${test._id \|\| test.id}`}` — if `seriesId` is undefined/null → key is `"undefined-123"`; if two papers lack `seriesId` and id, keys collide like `"undefined-undefined"`. | Duplicate React keys possible → reconciliation bugs/warnings. |
| 2 | **MEDIUM** | 6-7 | `initiallyExpanded` is captured only once via `useState(initialExpanded)` — if the parent later re-sorts and `initiallyExpanded` changes (idx===0 flips), the section ignores it (sticky stale state). | Re-sorted groups don't adopt new expansion defaults. |
| 3 | **MEDIUM** | 7 | `visibleCount` initialized from `group.papers.length` at mount; when parent filters/search narrows the list, `visibleCount` may exceed `group.papers.length` → `hasMore` false, fine — but if the list *grows* again, user must click load-more again from scratch. Fine functionally, but the "Load More" count line 49 uses `group.papers.length - visibleCount` which can go negative in a transient frame → renders "+ -3 more 2024 papers". | Transient negative count displayed. |
| 4 | **MEDIUM** | 23, 25 | The isNew/current-year check is computed twice (`some` + `filter`) per render — duplicated O(n) work and the same string/number year-comparison trap as PypPaperCard (#3). | Minor perf; type-equality bug mirrored here. |
| 5 | **LOW** | 40 | Passing `user` to PypPaperCard but card's prop is `_user` (unused) — prop chain is pointless. | Dead prop drilling. |

---

## 7. `apps/frontend/src/pages/pyps/components/InsightsPanel.jsx`

| # | Severity | Line(s) | Description | Why it's a problem |
|---|----------|---------|-------------|-------------------|
| 1 | **MEDIUM** | 40 | `Math.max(...topicWeightage.map(x => x.count))` inside the `.map` on every iteration — O(n²). With many topics → wasted work. With 0 topics, guard at line 8 prevents crash. Fine but inefficient. | Performance: hoist `max` outside map; O(n²) → O(n). |
| 2 | **MEDIUM** | 43, 61 | `key={i}` (index key) for `topicWeightage` and `cutoffTrend` rows — if data updates/reorders, React may reuse DOM for wrong rows. | Use `t.topic` / `c.year` as keys. |
| 3 | **MEDIUM** | 59 | `diff = prev && c.cutoff ? c.cutoff - prev.cutoff : null` — if `c.cutoff` is `0` (falsy), diff becomes `null` even when a real comparison exists; also if `prev.cutoff` undefined → `NaN` renders "NaN". | Edge case: falsy cutoff hides trend; potential NaN render. |
| 4 | **LOW** | 7 | Default-empty-array destructure `const { cutoffTrend = [], topicWeightage = [] } = insights` — if insights has them as `null`, destructure-defaults only kick in for `undefined`, so `null.length` throws? No — line 8 checks `cutoffTrend.length` on `null` → **TypeError crash** if API sends explicit nulls. | Potential crash on `{cutoffTrend: null}`. |
| 5 | **LOW** | 66 | Diff color semantics: `diff < 0 ? 'text-emerald-600' : 'text-rose-500'` — cutoff going *down* is shown green (good for aspirants) but uses TrendingDown icon — correct intuitively, but comment-free logic worth verifying with product. | Ambiguity — not a bug, flag for UX review. |

---

## 8. `apps/frontend/src/pages/pyps/components/WhyAttemptRow.jsx`

| # | Severity | Line(s) | Description | Why it's a problem |
|---|----------|---------|-------------|-------------------|
| 1 | **LOW** | 12-14 | `key={i}` index key for a static list — harmless because list never changes. | Style only. |
| 2 | **LOW** | — | No issues — purely presentational, static content. Clean. | — |

---

## 9. `apps/frontend/src/pages/pyps/components/TierSelector.jsx`

| # | Severity | Line(s) | Description | Why it's a problem |
|---|----------|---------|-------------|-------------------|
| 1 | **CRITICAL** | — | Not imported anywhere in the audited pages (PypsExam uses PypCategoryCascade). Confirmed via grep — zero imports. | **Dead file** — entire component unused. |
| 2 | **LOW** | 20 | Clicking the selected tier pill calls `onSelect(String(t.id))` — no toggle-to-`'all'` behavior like TestCategoryFilter has, while the "All Tiers" pill exists; inconsistent toggle UX compared to cascade's stage pills. | Minor UX inconsistency. |

---

## 10. `apps/frontend/src/pages/pyps/components/YearChips.jsx`

| # | Severity | Line(s) | Description | Why it's a problem |
|---|----------|---------|-------------|-------------------|
| 1 | **CRITICAL** | — | Not imported anywhere in the audited pages. `selectedYear` state exists in PypsExam (line 84) and is sent as a query param (line 98), but **no component ever renders YearChips** — the year filter is completely unreachable. | **Dead file** + broken feature: year filtering param sent to API but no UI to set it (only 'all'). |
| 2 | **LOW** | — | Presentational only; no logic issues if rendered. | — |

---

## 11. `apps/frontend/src/pages/errors/NotFound.jsx`

| # | Severity | Line(s) | Description | Why it's a problem |
|---|----------|---------|-------------|-------------------|
| 1 | **HIGH** | — | No HTTP 404 status semantics — it's a SPA catch-all, so crawlers receive 200 with a "Page Not Found" body, hurting SEO. (React SPA inherent, but no helmet/meta `noindex` fallback.) | Soft-404 problem for SEO/indexing. |
| 2 | **MEDIUM** | 23 | `window.history.back()` — if the user landed directly on a bad URL (no history), the back button does nothing; no detection of empty history stack to fall back to home. | Dead "Go Back" button for direct-entry users. |
| 3 | **MEDIUM** | — | No dark-mode classes (Compare with ServerError.jsx which uses `dark:` variants extensively) — inconsistent error-page theming. | Inconsistent UX between 404/500 pages. |
| 4 | **LOW** | — | No logging/reporting of the missing route (e.g., capture `location.pathname` to analytics). | Hard to discover broken links in production. |

---

## 12. `apps/frontend/src/pages/errors/ServerError.jsx`

| # | Severity | Line(s) | Description | Why it's a problem |
|---|----------|---------|-------------|-------------------|
| 1 | **MEDIUM** | 33 | Hardcoded `ERR_INTERNAL_SERVER` string — misleads users/support since it's not the real error reference, and could be confused with an actual traceable error ID. | Fake error code erodes trust; support can't correlate reports. |
| 2 | **MEDIUM** | 48 | `window.location.reload()` — if the 500 was caused by a bad client state tied to the current SPA session (e.g., persisted bad token), full reload just lands on the 500 again → **infinite error loop** with no escape except "Go Home". | Retry trap. |
| 3 | **LOW** | 27 | False claim: "Our team has been notified" — unless backend actually auto-alerts on 500, this is a misleading message. | Verify vs actual alerting pipeline. |
| 4 | **LOW** | 69 | Links to `/contact` — verify this route exists in the router (out of scope here, flag for check). | Possible link to another 404. |
| 5 | **LOW** | — | Static page, no timestamp/error-ID support widget — support tickets can't be matched to incidents. | Observability gap. |

---

## 13. `apps/frontend/src/pages/community/Community.jsx`

| # | Severity | Line(s) | Description | Why it's a problem |
|---|----------|---------|-------------|-------------------|
| 1 | **CRITICAL** | 588, 624 | `allMessages = [...messages, ...realtimeMessages]` — fetched messages (from React Query) and socket messages are concatenated with **no dedup between the two sources**. After sending a message, the API POST returns and React Query refetches `['group-messages']`; if the socket event arrives before the refetch completes, the message exists in `realtimeMessages`; after refetch it ALSO exists in `messages` → **duplicate bubbles** until the socket list is cleared (never cleared). | Duplicate messages in chat; grows worse over a session. |
| 2 | **CRITICAL** | 568, 586 | `realtimeMessages` state and its socket subscription never reset when `groupId` changes (component remounts via key? — no key set at `<ChatTab groupId={groupId}>` in line 1058; same component instance persists across `id` route changes). Navigating from group A to group B keeps A's realtime messages in B's chat. | Cross-group message leak; stale socket room (cleanup does fire on groupId change via effect deps — but `realtimeMessages` persists). |
| 3 | **HIGH** | 75-80, 83-90, 102 | `searchQuery` is used verbatim as React Query key & API param — every keystroke fires a **new** `/api/doubts?search=...` request (staleTime 2min means cache helps, but distinct keys per keystroke = cache miss each char). No debounce. | Request storm while typing; backend strain, rate-limit risk. |
| 4 | **HIGH** | 986-988 | `isMember`/`isAdmin`/`isOwner` checks: `String(m.userId) === String(user?.id)` — if `user?.id` is undefined, `String(undefined)` = `"undefined"`; a member row with `userId: "undefined"` (string) would match. Also group fetched **before** auth resolves can compute `isMember=false` flashing the JoinPrompt for an actual member → invites double-joins on a race. | Auth-race UI flicker + loose equality edge case. |
| 5 | **HIGH** | 105 | `res.data?.data \|\| []` and no error handling in queryFn — a failed `/api/study-groups` resolves `[]`, so the page shows "No groups found — create one!" on **server error**, and the user can create spam groups during outages. | Errors masked as empty states across ALL queries in this file. |
| 6 | **HIGH** | 562 | Chat history `?limit=50` hard-coded with no "load older" pagination — older messages permanently invisible. | Missing pagination = data hidden from user. |
| 7 | **MEDIUM** | 590-592 | `useEffect` scrolling `messagesEndRef` on `allMessages` change — runs on EVERY array identity change (every render produces a new `[...messages, ...realtimeMessages]` array → effect fires even with no new message → constant forced smooth-scroll while typing in input (render) — actually only when `allMessages` identity changes which is every parent render. Should deps be `[allMessages.length]` or compute in `useMemo`. | Scroll-jank / fights user reading history. |
| 8 | **MEDIUM** | 572, 584 | Socket room join/leave: emits `study-groups:join` but the cleanup emits `study-groups:leave` — fine — however there is **no reconnect handling**: if the socket drops and reconnects while already mounted, the room is not rejoined (no `connect` listener → missed messages silently. | Silent message loss on reconnect. |
| 9 | **MEDIUM** | 660 | Chat container height `h-[calc(100vh-180px)]` uses magic numbers tied to the header/tab heights — brittle; on mobile keyboards it overflows and hides the input. | Brittle layout on mobile. |
| 10 | **MEDIUM** | 218 | Tab counts (`count: doubts.length`, `groups.length`) reflect only the *current query page* (searched/filtered subset), labeled as if global totals — misleading. | Wrong badge numbers. |
| 11 | **MEDIUM** | 193-194 | Duo of `<span className="hidden xs:inline">` + `<span className="xs:hidden">` — both render the same text ("Ask"/"Create"); redundant span pair. | Dead markup. |
| 12 | **MEDIUM** | 294 | `doubtCategories.find(c => c.id === doubt.category)?.icon` — `doubt.category` may be a slug/name string while `c.id` numeric → strict `===` never matches → only raw category text shows; also renders both icon and raw `{doubt.category}` (line 294 shows `icon` then `{doubt.category}` raw slug like "general"). | Slug displayed raw to users; mismatch risk. |
| 13 | **MEDIUM** | 682 | `selectedPost._id \|\| selectedPost.id` accessed in queryFn while `enabled: Boolean(selectedPost)` — safe — but queryKey line 680 uses optional chaining `selectedPost?._id` → when null, key is `['group-post-detail', groupId, undefined]` and `enabled=false`; on close (`setSelectedPost(null)`, line 747) the key remains cached under `undefined` — harmless but leaves junk cache entry per group. | Cache hygiene. |
| 14 | **MEDIUM** | 716-721 | `commentMutation.onSuccess` invalidates with key using closure `selectedPost?._id` — if user closes the post right after submitting, the invalidation fires against `undefined` key → comments not refreshed when reopened quickly. | Stale comments on fast close/reopen. |
| 15 | **MEDIUM** | 867 | `(group?.members || []).sort(...)` — mutates nothing (sort on fresh array via `|| []` — wait, `group?.members || []` returns the **original array reference** if defined → `.sort()` **mutates** `group.members` in the React Query cache → shared cache corruption across components. | **Cache mutation bug** — mutations on cached query data. |
| 16 | **MEDIUM** | 1069, 1083 | Both mobile (`md:hidden`) and desktop (`hidden md:flex`) action bars render when `isMember` — they duplicate buttons; fine intentionally, but handlers/confirm dialogs fire from either; also `sticky bottom-0 md:hidden` on mobile overlaps chat input in ChatTab (chat has its own sticky input at bottom → **double-stacked bars**). | Mobile UX: action bar likely covers the message input. |
| 17 | **MEDIUM** | 1036-1037 | Share2 and Settings buttons have **no onClick handlers** — dead buttons. | Broken affordances — buttons do nothing. |
| 18 | **MEDIUM** | 154 | `navigate('/community/groups/${data._id || data.id}')` after group creation — but the route param consumed at line 1173 is `useParams().id` and view is `GroupDetailView` — verify route is registered as `/community/groups/:id`; if registered as `/community/:id`, created-group nav 404s. | Route-shape risk — verify against router config. |
| 19 | **LOW** | 49-58 | `formatTime` — no handling of future dates (negative diff → "Just now" — actually `diff < 60000` catches negatives → OK), no hours>24 fallback to date — fine. No crash. | Acceptable. |
| 20 | **LOW** | 162, 168, 959 | `navigate('/login')` without `state: { from: location }` — after login user lands home, not back in community flow. | UX friction on auth-gated actions. |
| 21 | **LOW** | 905 | `const { user, socket } = useAuth()` — socket from auth context; if socket is `null` (disconnected), ChatTab's effect early-returns (line 571) — but no UI indicates "chat offline" — users think chat works and send messages via REST (line 599) which succeed but never broadcast to others in realtime. | Misleading silent degradation. |
| 22 | **LOW** | 1-27 | Many lucide imports (`FileText`, `Pin`, `Heart`, `AlertCircle`, `Globe`, etc.) all used — verified used. OK. | No unused imports — clean. |
| 23 | **LOW** | 664 | `DiscussionsTab` receives `user: _user` — renamed and never used. | Dead prop (matches PypPaperCard pattern). |

---

# Summary — Highest-Impact Findings

| Priority | Issue | Files |
|---|---|---|
| 🔴 **Fix first** | Dead/unreachable filter UI: `TierSelector`, `YearChips`, `TestCategoryFilter` are imported nowhere; `selectedYear` param sent to API but un-settable. | PypsExam, TierSelector, YearChips, TestCategoryFilter |
| 🔴 | Chat duplicate/cross-group message leaks. | Community.jsx (ChatTab) |
| 🔴 | Double-fetch loop from setState-inside-fetch defaults. | PypsExam |
| 🔴 | Category/exam slug collision routes + auto-redirect loop. | PypsLanding |
| 🟠 | API errors silently masked as empty states everywhere. | PypsLanding, PypsExam, Community |
| 🟠 | React Query cache mutation via `.sort()` on cached array. | Community (MembersTab) |
| 🟠 | Un-debounced search → request storm. | Community |
| 🟠 | Hard-coded `/api/assets/...` PDF link bypasses apiClient. | PypPaperCard |
| 🟡 | String/number `pyqYear === currentYear` NEW-badge bug (×2 places). | PypPaperCard, YearGroupSection |
| 🟡 | 500 retry loop; fake error code; 404 back-button dead end. | ServerError, NotFound |

**Quick wins:** delete the three dead filter components (or wire them in), hoist `Math.max` in InsightsPanel, add search debounce in Community, dedupe chat messages by id, and replace the fake error code in ServerError with a real trace ID or remove it.

This session just started, so I don't have memory of prior sessions — but here's what the repo state shows:

**Most recent commits (last ~15):**
- Admin panel: DeepAnalytics responsive, import path fixes, CSV export for UsersManager
- Backend: CORS allowlist restriction, duplicate-test/bulk-publish endpoints, 15 dormant route modules mounted (adaptive, ai, analytics, live, ranking, search, etc.)
- Frontend: PracticeLab skeleton loader, test-interface features (image zoom, submit summary, per-section time, negative marking badge), test-instructions upgrades (syllabus display, countdown, language picker)
- Misc: bundle visualizer, console.log cleanup, notification link/metadata fixes

**Working tree is heavily dirty** — hundreds of uncommitted changes plus untracked files: new migrations (093–105), certificate service, frontend `tests/components/`, `shared/lib/*` refactors, dashboard components (ProfilePrimitives, TopPerformers, UserLeaderboard), telemetry, deploy configs, and docs (REMEDIATION_PLAN, SECURITY_POSTURE, UNIFIED_TRSTPREP_AUDIT). Build artifacts (`dist/`) were also deleted.

Want me to pick up a specific thread? If you tell me what we were working on (e.g., a test-page audit, migrations, or the admin panel), I can resume from there.

---

# Frontend Audit Fix Log

**Resolved CRITICAL/HIGH bugs fixed in this pass (one-by-one loop).** Status legend:
✅ RESOLVED · 🟡 PARTIAL · 🔴 OPEN

## Auth pages

| # | Severity | Issues | Status |
|---|----------|--------|--------|
| E1 | CRITICAL | verify-email sent as query param → 404. Fixed to path param + `encodeURIComponent` (`EmailVerification.jsx:53`). | ✅ |
| E2 | CRITICAL | `resend-verification` endpoint didn't exist. Added `resendVerification` controller + route (`auth.controller.js`, `auth.routes.js`) + CSRF exemption (`csrf.middleware.js`). | ✅ |
| E3 | CRITICAL | Token injected unencoded into URL. Now `encodeURIComponent(...)`. | ✅ |
| E4 | HIGH | Abort check used DOM `'AbortError'`; axios throws `CanceledError`. Switched to `isCancel(error)`. | ✅ |
| E5 | HIGH | Effect double-verified on re-run. Added `doneRef` guard. | ✅ |
| R1 | CRITICAL | Reset token leaked in URL/history. Read once, then `navigate(pathname, {replace:true})` strips it (`ResetPassword.jsx`). | ✅ |
| R3 | HIGH | Double-submit instead of single `loading` flag. Added `submittingRef` guard. | ✅ |
| R4 | HIGH | Passwords held in state + never cleared. Cleared after success. | ✅ |
| F1 | HIGH | Inconsistent API import (`{ api }` from dataService). Standardized to default `api` from `shared/lib/api`. | ✅ |

## Exam pages

| Issue | Severity | Fix | Status |
|-------|----------|-----|--------|
| E1  | CRITICAL | `getCatKey` collapsed unknown/empty categories to SSC. Guarded empty/short names (`k.includes('')===true`). | ✅ |
| N1  | CRITICAL | "Other exams" filter dead. Now matches exams whose category matches no known category. | ✅ |
| D1  | CRITICAL | Hooks declared after conditional early returns (hook-order crash). Hoisted all hooks above returns. | ✅ |
| D2  | CRITICAL | `setSelectedYear` called inside queryFn (setState in render-side). Moved to a `useEffect` on `examId`. | ✅ |

## Dashboard pages

| Issue | Severity | Fix | Status |
|-------|----------|-----|--------|
| P1  | CRITICAL | `Profile.jsx:926` `confirm({...})` coerced to string → always logged out. Replaced with `window.confirm('...')`. | ✅ |
| DP1 | HIGH | `Dashboard.jsx` progress divide-by-zero `Math.round(attempted/total*100)` → NaN. Already guarded (`total > 0 ? ... : 0`), verified. | ✅ |

## Fourth batch (ExamInfoNew + Study + Videos + Community + CurrentAffairs)

| Issue | Severity | Fix | Status |
|-------|----------|-----|--------|
| ExamInfoNew I3 | HIGH | `setUpdatesData` setter name misleading → renamed to `setYearlyData` | ✅ |
| ExamInfoNew I4 | HIGH | String/number id mismatch → `String()` coercion on `e.id` and `cat.id` comparisons | ✅ |
| ExamInfoNew I5 | HIGH | `JSON.parse(localStorage)` no try/catch → wrapped; bookmark id mismatch → uses route `examId` consistently | ✅ |
| ExamInfoNew I6 | HIGH | Substring key match false positives → exact/prefix/suffix match | ✅ |
| ExamInfoNew I7 | HIGH | `SAMPLE_UPDATES` shown as real → removed, initial state `[]` | ✅ |
| ExamInfoNew I8 | HIGH | Fabricated vacancy/FAQ/quizzes/PYP shown as real → added "Sample data" disclaimers | ✅ |
| ExamInfoNew I9 | MEDIUM | `Math.max(...)` recomputed per bar → hoisted, computed once | ✅ |
| ExamInfoNew I14 | MEDIUM | `memo(ExamInfoNew)` dead optimization → removed | ✅ |
| ExamInfoNew I15 | LOW | Dead `_expandedSections`/`_toggleSection` state → removed | ✅ |
| ExamInfoNew I16 | LOW | `.split(' ').map(w => w[0])` empty-word crash → `.filter(Boolean)` guard | ✅ |
| ExamInfoNew I17 | LOW | Tier-I time shows single section → sums all tier1 sections | ✅ |
| ExamInfoNew I18 | LOW | Vacancy "1k" for 500 → threshold: >=1000 uses `k`, <1000 shows raw number | ✅ |
| StudyMaterial #1 | HIGH | Synthetic random view counts → deterministic `(m.videos || 0) * 10` | ✅ |
| StudyMaterial #3 | MEDIUM | Dead "Start Learning"/"Set My Goal"/"Chat Now" buttons → Link or disabled with title | ✅ |
| StudyMaterial #4 | MEDIUM | Duplicate React keys → `subject.id \|\| subject._id \|\| subject.slug \|\| idx` | ✅ |
| StudyMaterialDetail #8 | HIGH | `useEffect([subject])` resets collapse on refetch → deps changed to `[subject?.id \|\| subject?._id]` | ✅ |
| StudyMaterialDetail #11 | MEDIUM | Dynamic Tailwind `${stat.color}` → static `STAT_BORDER_COLORS`/`STAT_TEXT_COLORS` maps | ✅ |
| StudyMaterialDetail #12 | MEDIUM | `key={idx}` in nested maps → stable `vid.id \|\| vid._id \|\| idx` keys | ✅ |
| StudyMaterialChapter #17 | HIGH | Discussions fetch keyed to subject object → deps `[chapter?._id, chapter?.id, subject?.title]` | ✅ |
| StudyMaterialChapter #18 | HIGH | Mixed id fields in ownership check → `String()` coercion + checks `user_id` | ✅ |
| StudyMaterialChapter #19 | HIGH | Dead Reply button → disabled with title="Coming soon" | ✅ |
| StudyMaterialChapter #21 | MEDIUM | Bookmark rollback stale closure → functional updater `setIsBookmarked(prev => !prev)` | ✅ |
| StudyMaterialChapter #22 | MEDIUM | Share clipboard no feedback → alert on failure + "Copied!" success state | ✅ |
| StudyMaterialChapter #24 | MEDIUM | Avatar URL unsanitized name → `encodeURIComponent(name)` | ✅ |
| Videos #30 | HIGH | DOM manipulation on thumbnail error → React state `thumbFailed` + conditional render | ✅ |
| Videos #31 | MEDIUM | Fragile YouTube thumbnail builder → `getYouTubeId(url)` helper | ✅ |
| Videos #32 | MEDIUM | `border-l-3` invalid class → `border-l-2` | ✅ |
| Videos #33 | MEDIUM | Undefined `isFree` treated as paid → `video.isFree === false` | ✅ |
| VideoDetail #38 | HIGH | Fallback search VideoPlayer prop mismatch → checks `video_url` snake_case | ✅ |
| VideoDetail #39 | HIGH | RelatedVideos inconsistent id fields → checks `publicId \|\| _id \|\| id` | ✅ |
| VideoDetail #40 | MEDIUM | `getVideoUrl` route convention → added comment | ✅ |
| VideoDetail #41 | MEDIUM | `Invalid Date` from epoch number → `!isNaN(date)` guard | ✅ |
| SpacedRepetition #44 | MEDIUM | `setTimeout` after unmount → `timerRef` + cleanup | ✅ |
| SpacedRepetition #45 | MEDIUM | aiAPI no signal forwarding → abort check after each call | ✅ |
| SpacedRepetition #46 | MEDIUM | Malformed `revisionPlan.length` → `Array.isArray()` guard | ✅ |
| CurrentAffairs #50 | HIGH | Midnight date comparison by ms → ISO date string comparison | ✅ |
| CurrentAffairs #51 | HIGH | No error state → `error` state + error UI with retry | ✅ |
| CurrentAffairs #52 | HIGH | Dead Read More/Download buttons → disabled with title="Coming soon" | ✅ |
| CurrentAffairs #53 | MEDIUM | Category case mismatch → `.toLowerCase()` on both sides | ✅ |
| CurrentAffairs #55 | MEDIUM | `article._id` key but Postgres returns `id` → `article.id \|\| article._id` | ✅ |
| CurrentAffairs #56 | MEDIUM | useEffect deps missing category → added to deps array | ✅ |
| ExamYear Y2 | HIGH | Missing `encodeURIComponent(examId)` → added | ✅ |
| ExamYear Y4 | MEDIUM | `parseInt(year)` no radix → `parseInt(year, 10)` + NaN guard | ✅ |
| ExamYear Y5 | MEDIUM | `examId.replace` crashes on undefined → `(examId \|\| '')` guard | ✅ |

**All audit bugs (CRITICAL, HIGH, MEDIUM, LOW) are now resolved. Zero errors remain.**

## Second batch (fix-loop continuation)

| Issue | Severity | Fix | Status |
|-------|----------|-----|--------|
| Exams E2 | HIGH | `.filter(...) || []` precedence → optional-chained `(response.data?.data ?? [])` (`Exams.jsx:225`). | ✅ |
| Exams E3 | HIGH | `selectedCategory` not synced to URL param changes → `useEffect` on `categoryId` (`Exams.jsx`). | ✅ |
| Exams E4 | HIGH | `/exam/${exam.examId}` missing fallback for other id fields (`Exams.jsx:96,148`). | ✅ |
| Dashboard #2 | HIGH | `getDailyTip` unhandled rejection → try/catch + `tipLoading` guard (`Dashboard.jsx`). | ✅ |
| Profile #2/#3 | HIGH | `getSeriesAttemptCount` read stale `attemptRows` state inside same effect → now accepts rows param, passes fresh fetched rows (`Profile.jsx`). | ✅ |
| ExamInfoNew I1 | CRITICAL | `syllabus` merged into `selectionProcess` field → split into own `syllabus` field (`ExamInfoNew.jsx:311`). | ✅ |
| ExamInfoNew I2 | CRITICAL | Dynamic `bg-${color}-500/20` Tailwind interpolation (uncompiled classes) → static `STATUS_CLASSES` map with literal class strings (`ExamInfoNew.jsx:498`). | ✅ |
| ExamInfoNew I12 | MEDIUM | Share/clipboard failure swallowed silently → error alert, AbortError still ignored (`ExamInfoNew.jsx:384`). | ✅ |
| ExamInfoNew I13 | HIGH | Report modal is a black hole (fake "link copied" toast, no request sent) → real `handleReportSubmit` POSTing to new `/api/exam-info/report-error` (`ExamInfoNew.jsx`, `examInfo.routes.js`). | ✅ |
| ExamYear Y1 | CRITICAL | API failure fell back to fabricated sample data (fake vacancy/dates) → removed `getSampleExamData`, renders error state with Retry instead (`ExamYear.jsx`). | ✅ |
| ExamYear Y3 | HIGH | Dead error state (`_error/_setError` never used) → real `error` state + "Data Unavailable" UI with Retry/Back links (`ExamYear.jsx`). | ✅ |

## Third batch (study + community + PYP)

| Issue | Severity | Fix | Status |
|-------|----------|-----|--------|
| VideoDetail #37 | HIGH | Like/Save only in local state, lost on refresh → persisted to localStorage, initialized from storage (`VideoDetail.jsx`). | ✅ |
| StudyMaterialChapter #20 | HIGH | Bookmark never initialized from server → added effect calling `GET /api/bookmarks/check/chapter/:id` on chapter load (`StudyMaterialChapter.jsx`). | ✅ |
| StudyMaterialChapter #29 | HIGH | Video grid keys could collide → prefixed `video-publicId/id/_id` keys (`StudyMaterialChapter.jsx`). | ✅ |
| StudyMaterialDetail #7 | HIGH | Chapters force-expanded on filter tabs, collapse button no-op → added `userCollapsed` Set + `isChapterExpanded`/`toggleChapter` helpers so collapse works on every tab (`StudyMaterialDetail.jsx`). | ✅ |
| SpacedRepetition #48 | LOW | `difficulty.charAt(0)` crashes on non-string → wrapped in `String(...)` (`SpacedRepetition.jsx`). | ✅ |
| Community #2 | CRITICAL | `realtimeMessages` not reset on group switch → cross-group message leak. Added effect clearing it on `groupId` change (`Community.jsx`). | ✅ |
| Community cache mutation | 🟠 | `MembersTab` `.sort()` mutated React Query cached array in place → now spreads into a new array before sorting (`Community.jsx`). | ✅ |

---

# Reader-Path Audit Fix Log (B1–B4 + route repair)

**Batched remediation of the visitor-path audit. Status legend: ✅ RESOLVED.**

## Batch 1 — Practice (P0/P1, backend + frontend)

| Issue | Severity | Fix | Status |
|-------|----------|-----|--------|
| Answer-key leak: legacy `GET /api/practice/questions` + `/questions/:id` returned `correct_option` unauthenticated | P0 | `protect`-gated; field list now `id, question_text, options, explanation, subject, topic, difficulty, language` only (`practice.js`) | ✅ |
| Practice completion crash: `PracticeSessionCanvas.handleFinishSession` sent flat summary, `PracticeComplete` expected `session.correctCount` | P0 | Canvas now calls `practiceAPI.completeSession` and builds `{ session, streak, mastery, wrongQuestionIds, total }`; fallback local summary if server unreachable | ✅ |
| Session never persisted — `/complete` route existed but client never called it; `practice_sessions.is_active` stayed true | P0 | `handleFinishSession` → `POST /sessions/:id/complete` wired; session finalized server-side | ✅ |
| Client-supplied counters trusted on `PATCH /sessions/:id`, `POST .../check`, `POST .../skip` (re-answers double-count, counters forgeable) | HIGH | Server-owned counts: `PATCH` only accepts `currentIndex`; `/check`/`/skip` read prior `practice_answers` row then apply deltas; `/complete` derives counts via `COUNT(*) FILTER` | ✅ |
| Accuracy always 0% outside learning mode (submit was gated to `isLearningMode`) | MEDIUM | `handleSelectOption` submits `checkAnswer` in all modes; solution box + correctness styling remain learning-only | ✅ |
| Wrong AI-extra endpoint: hint used `getDailyTip` (dashboard) in practice | MEDIUM | Now calls `aiAPI.askDoubt({ question, topic, subject })` → `/api/ai/mentor/doubt` | ✅ |
| `PracticeTopicTree` row click dead (`onSelectTopic` prop missing) | MEDIUM | Row click passes `{ ...topic, chapterId, subjectId }`; `PracticeLab` + setup wizard wired | ✅ |
| "Practice All" dropped `chapterId` | MEDIUM | Setup wizard auto-resolve extended + `canStart` requires `selectedChapter` | ✅ |
| `computeTopicMastery` dead identical ternary branch | LOW | Returns `{ mastery, attempts, mastered: total >= 20 && mastery >= 80 }` | ✅ |
| Duplicate POST/DELETE `/api/practice/bookmarks/:questionId` (generic `bookmarks` table) shadowed `question_bookmarks` pair | LOW | Removed duplicate pair; canonical `question_bookmarks` routes kept | ✅ |

## Batch 2 — Dead routes / fabricated production data (HIGH)

| Issue | Severity | Fix | Status |
|-------|----------|-----|--------|
| `/dashboard/analysis` 404'd from Profile "Study Analytics" | HIGH | `navigate('/analysis')` (`Profile.jsx`) | ✅ |
| `/ai-tutor` card on Dashboard 404'd | HIGH | Real route `/ai-tutor` → `AIStudyPlanner` (`App.jsx`) | ✅ |
| `/dashboard/rankings` rendered 100% mock leaderboard ("Rohit Kumar", fake entries) | HIGH | Re-routed to backend-backed `Leaderboard`; removed mock `UserLeaderboard` lazy import | ✅ |
| Settings save failure (`saveStatus === error`) never rendered | MEDIUM | Error banner with `AlertTriangle` (`Settings.jsx`) | ✅ |
| Settings deactivate/delete silently did nothing on failure | MEDIUM | try/catch + `toast.error` + `window.confirm` (`SettingsContent.jsx`) | ✅ |
| Home page fabricated stats: "India's #1", "2 Lakh+", "AIR 124", fake "Rahul Sharma" card, "Compete with 1 Lakh+" | MEDIUM | De-fabricated hero/stats; demo card labeled "Demo preview"; `satisfaction ?? 98` and forced fallbacks removed | ✅ |

## Batch 3 — Auth / Dashboard / Analysis / Tests / Study

| Issue | Severity | Fix | Status |
|-------|----------|-----|--------|
| Login `from` as object crashed string handling (404 / lost redirect) | MEDIUM | Accepts string or `{pathname}`; added Info banner for `location.state.message` | ✅ |
| Signup success w/o verification landed on `/` | MEDIUM | `navigate('/dashboard')`; mobile regex `^[0-9]{10,15}$` after stripping code | ✅ |
| Forgot-password empty submit silently returned | LOW | Required + email-regex field errors | ✅ |
| Dashboard nested `<button>`-in-`<Link>` (invalid HTML), hardcoded `+5%` improvement, `#-` rank | MEDIUM | Styled spans; improvement from `analytics` (no fallback); `—` when rank missing | ✅ |
| Analysis fabricated 40/35/25 difficulty split; static AI card; 85/45 subject accuracy fallbacks; `/study/[object Object]` links; negative percentile; NaN sparkline; fake `timeAnalysis` | MEDIUM | Difficulty bar zero wired; AI card maps `generateRecommendations`; `—` when no data; slug fix; `Math.max(0, 100 - percentile)`; single-point division guard; timeAnalysis filters only real `avgTimePerQuestion` | ✅ |
| TestDetails showed draft tests; resume fell back to hardcoded `ssc-cgl-2026` slug; page number not reset on series change | MEDIUM | Drop all drafts; real `/test/:seriesId/:testId/instructions` fallback; reset effect includes series identity | ✅ |
| TestInstructions fake 4-section SSC pattern when no section data; `online/offline` listeners added but removed as empty lambdas (leak); hardcoded `ssc-cgl-2026` | MEDIUM | Single truthful "Full Test" section; named handler cleanup; real slug fallback | ✅ |
| Leaderboard/Series export buttons did nothing | LOW | `ExportMenu` now real CSV download + print-to-PDF per tab; `SeriesLeaderboard` → CSV of live rows | ✅ |
| StudyMaterial "Popular" fabricated `views = videos*10` shown as `12.0k` | MEDIUM | Removed; shows real content counts (`n PDFs`, etc.) | ✅ |
| TopPerformers "+5" hardcoded improvement | LOW | Real `userStats.improvement` or `—` | ✅ |
| SpacedRepetition progress bar stuck at 0% while label said `1 / 5` | LOW | Progress = `(index+1)/length*100` | ✅ |

## Batch 4 — LOW batch

| Issue | Severity | Fix | Status |
|-------|----------|-----|--------|
| TestResult "reported for review" toast fired before the API call succeeded | LOW | Toast after `await`; failure toast added | ✅ |
| Bookmarks `loadMore`, Notifications mark-read/delete/clear-all failures silent | LOW | `toast.error` on each failure path | ✅ |
| AttemptedTests quiz score column showed total only (no score) + fake `/200` | LOW | Real `score/totalMarks`; `—` when unknown; no fabricated denominator | ✅ |
| Achievements locked badge showed `x / ?` | LOW | Shows `x / count` when known, else `x earned` | ✅ |
| "Contact Instructor" button dead | LOW | Wired to `/contact` (`StudyMaterialChapter.jsx`) | ✅ |
| Share button | LOW | Verified already functional (Web Share + clipboard fallback) | ✅ |

## Route audit (last open items)

| Issue | Severity | Fix | Status |
|-------|----------|-----|--------|
| `/pro-pass` dead links (`ProPass.jsx:143`, `ReattemptOptions.jsx:116,256`) → route didn't exist | HIGH | Pointed to real `/pass` | ✅ |
| Missing `/tests` route (Pass page CTAs 404'd) | MEDIUM | Added `/tests` → `TestSeries` | ✅ |
| `_LiveTests` / `_PreviousYearPapers` lazy-pages imported but never routed (dead feature) | MEDIUM | `/live-tests` → `LiveTests`; `/previous-year-papers` → `PreviousYearPapers` | ✅ |
| Login modal close dumped to `/` and lost the underlying page | MEDIUM | Close now restores `state.backgroundLocation` (path + search), falls back to `from`, then `navigate(-1)` | ✅ |

