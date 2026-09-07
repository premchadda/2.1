# API Endpoints — Living Index

> As of 2026-09-06. This is an **index, not a contract**: it records
> conventions, the verified admin module map, and fully-worked examples for
> selected areas. For any endpoint not detailed below, the route file is
> authoritative. Update this file when you add/rename/remove a route.

## Conventions

- **Bases.** Admin router mounts at `/api/admin` (`app-port5001.js`). Auth
  routes mount at `/api/auth`. Public routers mount under `/api/*` (see
  Undocumented surfaces). Never add a second `/admin` prefix inside an
  admin sub-router — mounts below are relative to `/api/admin`.
- **Response envelope.** `{ "success": true, "data": ... }` (lists add
  `count`/`total`/`page`/`limit`/`totalPages`).
- **Pagination.** `?page=1&limit=20` (max 100); filtering/sorting/pagination
  is done in SQL, not in Node memory.
- **Curl pattern** used throughout:
  ```bash
  curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/...
  ```
  (`:3000` = local dev; compose exposes the backend on `:5001`.)

## Admin middleware pipeline (code order, `admin.js`)

Every `/api/admin/*` request passes, in order:

```
normalizeFields (POST/PUT/PATCH)
→ restrictAdminOrigin
→ validateAdminApiKey
→ protect (JWT)
→ admin (role)
→ validateCsrfToken
→ loadAdminPermissions
→ requireAdminPermission
→ auditMiddleware (all mutating requests + detail reads;
   plain collection GETs skip the audit write)
```

Do not bypass this chain. CSRF runs **after** `protect`/`admin` in code
(despite the header comment suggesting otherwise) — document behavior from
the `router.use` order above, not the comment.

## Admin module map (verified from `admin.js`, imports lines 23–60)

38 imports = **37 `admin-*` modules** + `leaderboards-admin`. Includes
`admin-import`, `admin-logs`, `admin-sessions`, `admin-live-tests`.
`/stages` also exists as a **top-level** public route (`/api/stages`) in
addition to the admin stages module — they are different routers.

### Mounted at root (`/api/admin/*`, no extra prefix)

| Module                     | Notes                                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `admin-activity.js`        | Includes `GET /recent-activity`                                                                                  |
| `admin-assets.js`          | Asset/file management                                                                                            |
| `admin-bulk-ops.js`        | `POST /test-series/bulk-operation`, `/tests/bulk-reassign`, `/questions/bulk-reorder`, `/questions/bulk-convert` |
| `admin-catalog.js`         | Catalog (incl. `POST /quizzes/bulk`-style bulk paths)                                                            |
| `admin-categories.js`      |                                                                                                                  |
| `admin-commerce.js`        | Commerce/notifications bulk                                                                                      |
| `admin-content.js`         |                                                                                                                  |
| `admin-curriculum.js`      |                                                                                                                  |
| `admin-dynamic-content.js` |                                                                                                                  |
| `admin-enrollments.js`     |                                                                                                                  |
| `admin-exams.js`           |                                                                                                                  |
| `admin-extras.js`          | Misc admin routes                                                                                                |
| `admin-import.js`          | Import + `GET /import/history`, `/import/history/:id`                                                            |
| `admin-navigation-tags.js` |                                                                                                                  |
| `admin-questions.js`       | `DELETE /questions/bulk`, `POST /questions/bulk` (file), `POST /questions/bulk/predict-difficulty`               |
| `admin-realtime.js`        | Realtime dashboards (below)                                                                                      |
| `admin-roles.js`           |                                                                                                                  |
| `admin-sessions.js`        |                                                                                                                  |
| `admin-settings.js`        |                                                                                                                  |
| `admin-stages.js`          | Admin side (public `/api/stages` is separate)                                                                    |
| `admin-stats.js`           | Statistics                                                                                                       |
| `admin-test-series.js`     | `POST /test-series/bulk-upload`                                                                                  |
| `admin-tests.js`           | `DELETE/POST /tests/bulk*`, `POST /tests/bulk-status`, `/tests/bulk-publish`, `POST /tests/:id/duplicate`        |
| `admin-users.js`           | `GET /users`, `POST /users/:id/2fa/disable` (admin-forced)                                                       |

### Mounted on subpaths (relative to `/api/admin` — no double `/admin`)

| Module                     | Mount              | Contents                               |
| -------------------------- | ------------------ | -------------------------------------- |
| `admin-navigation.js`      | `/navigation`      | Navigation config                      |
| `admin-audit.js`           | `/audit-logs`      | Audit log reads                        |
| `admin-recycle-bin.js`     | `/trash`           | Soft-delete recycle bin                |
| `admin-sections.js`        | `/sections`        |                                        |
| `admin-analytics.js`       | `/analytics`       |                                        |
| `admin-deep-analytics.js`  | `/analytics/deep`  |                                        |
| `admin-email-templates.js` | `/email-templates` |                                        |
| `admin-coming-soon.js`     | `/coming-soon`     |                                        |
| `admin-payments.js`        | `/payments`        | Transactions, stats, refunds, webhooks |
| `admin-moderation.js`      | `/moderation`      | Doubts queue                           |
| `admin-backups.js`         | `/backups`         |                                        |
| `admin-logs.js`            | `/logs`            |                                        |
| `leaderboards-admin.js`    | `/leaderboards`    |                                        |
| `admin-live-tests.js`      | `/live-tests`      | `POST /live-tests/bulk`                |

---

## Performance-optimized endpoints

### `GET /admin/recent-activity`

**Auth:** protect, admin
Returns the 8 most recent platform events via SQL `ORDER BY` + `LIMIT`.

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/recent-activity
```

### `GET /admin/realtime/active-users`

**Auth:** protect, admin
Counts across 5min/30min/1hr windows (`COUNT(DISTINCT)` + `FILTER`) plus a
24h hourly histogram.

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/realtime/active-users
```

### `GET /admin/realtime/test-activity`

**Auth:** protect, admin
In-progress tests, top-10 popular active tests, last-hour completion rate and
average score.

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/realtime/test-activity
```

### `GET /admin/realtime/revenue`

**Auth:** protect, admin
Revenue/enrollment analytics (`COUNT(*) FILTER`); Pro Pass revenue, enrollment
trends, top-5 enrolled series.

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/realtime/revenue
```

### `GET /admin/users`

**Auth:** protect, admin
Paginated users (SQL `WHERE`/`ILIKE`/`ORDER BY`/`LIMIT`/`OFFSET`).

| Param                     | Default          | Description                    |
| ------------------------- | ---------------- | ------------------------------ |
| `page` / `limit`          | 1 / 20 (max 100) | Pagination                     |
| `search`                  | —                | ILIKE on name, email, phone    |
| `role`                    | —                | `user`, `admin`, `super_admin` |
| `status`                  | —                | `active`, `inactive`           |
| `pro` / `includeInactive` | false / false    | Flags                          |

```bash
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/admin/users?page=1&limit=20&search=john&role=user"
```

---

## Payments (`/admin/payments`)

### `GET /admin/payments/transactions`

Paginated transactions with user join; `?search=` (name/email/gateway payment
ID/gateway), `?status=success|failed|pending|refunded`.

```bash
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/admin/payments/transactions?status=success&limit=10"
```

### `GET /admin/payments/stats`

Aggregate counts by status and time window.

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/payments/stats
```

### `POST /admin/payments/:id/refund`

Marks a **successful** payment refunded; writes an audit entry.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/payments/1/refund
```

### `GET /admin/payments/webhooks`

Last ≤50 webhook events; `[]` when the table is absent.

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/payments/webhooks
```

---

## Content moderation (`/admin/moderation`)

### `GET /admin/moderation/stats`

Doubt counts by status (`total/open/resolved/flagged/hidden`); tolerates
missing tables/columns.

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/moderation/stats
```

### `GET /admin/moderation/doubts`

Paginated doubts with user join; `?search=` (title/description/user name),
`?status=open|resolved|pending|hidden`, `?flagged=true`.

```bash
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/admin/moderation/doubts?status=open&limit=10"
```

### `PUT /admin/moderation/doubts/:id/status`

Body: `{ "status": "open|resolved|pending|hidden" }`. Audited.

```bash
curl -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status": "resolved"}' \
  http://localhost:3000/api/admin/moderation/doubts/1/status
```

### `DELETE /admin/moderation/doubts/:id`

Soft-delete (`is_active = false`). Audited.

```bash
curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/moderation/doubts/1
```

---

## Content management

### `POST /admin/tests/:id/duplicate`

Deep-copies a test (sections, questions, junction links) as a draft.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/tests/123/duplicate
```

Real bulk/question surfaces (use these — see Removed phantoms below):
`DELETE /admin/questions/bulk`, `POST /admin/questions/bulk` (multipart
file), `POST /admin/questions/bulk/predict-difficulty`,
`POST /admin/questions/bulk-reorder`, `POST /admin/questions/bulk-convert`,
`POST /admin/tests/bulk-delete|bulk-status|bulk-publish`,
`GET /admin/import/history`.

---

## Two-factor authentication (TOTP) — corrected contracts

Base path `/auth` (user-facing, not admin-only). Management routes require
`protect`; `POST /auth/login/2fa` is public + rate-limited.

| Endpoint                                 | Request                                                                                                                    | Response                                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `POST /auth/2fa/enroll`                  | no body; 403 when the admin global toggle is off                                                                           | `{ secret, otpauthUri }` **only** (no QR URL)                                               |
| `POST /auth/2fa/verify`                  | `{ "token": "<6-digit TOTP>" }` (field is `token`, not `code`)                                                             | `{ backupCodes }` + enabled message                                                         |
| `POST /auth/2fa/disable`                 | **no body** (deletes the secret row)                                                                                       | disabled message                                                                            |
| `POST /auth/2fa/backup-codes/regenerate` | no body; 400 unless 2FA enabled                                                                                            | `{ backupCodes }`                                                                           |
| `GET /auth/2fa/status`                   | —                                                                                                                          | `{ enabled, backupCodesCount, globalEnabled }` (counts + global kill-switch, no timestamps) |
| `POST /auth/login/2fa`                   | `{ tempToken, token? , backupCode?, rememberMe? }` — `token` = TOTP code, `backupCode` = backup code (either one required) | `{ token, refreshToken, user }`                                                             |

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/auth/2fa/enroll
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"token": "123456"}' http://localhost:3000/api/auth/2fa/verify
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/auth/2fa/disable
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/auth/2fa/status
curl -X POST -H "Content-Type: application/json" \
  -d '{"tempToken": "temp_xyz", "token": "123456"}' \
  http://localhost:3000/api/auth/login/2fa
```

---

## Removed phantoms (do NOT implement against these)

These contracts appeared in an earlier revision of this file and do **not**
exist in code (verified 2026-09-06):

- `PUT /admin/questions/bulk` — no such route. Real equivalents are
  `DELETE /questions/bulk`, `POST /questions/bulk` (file upload),
  `POST /questions/bulk/predict-difficulty` (`admin-questions.js`), and the
  `POST …/bulk-reorder|bulk-convert` ops (`admin-bulk-ops.js`).
- `POST /admin/questions/upload-image` — no such route.
- `GET /admin/questions/:id/history` — no question-version history endpoint.
  (Import history lives at `GET /admin/import/history`, `admin-import.js`.)
- `POST /admin/questions/:id/restore/:versionId` — no such route.

## Undocumented surfaces (route file is authoritative)

- **Auth** (`/api/auth`, `auth.routes.js` + `auth.controller.js`): login,
  `login/2fa`, register, refresh, logout, password reset/change, email verify,
  phone auth (`/api/auth/phone`), sessions (`/api/sessions`), and the 2FA
  table above.
- **Public read routers** (15 unique routers, 16 mounts,
  `public-routes-index.js`): `/api/search`, `/api/exams`, `/api/videos`,
  `/api/subscription-plans`, `/api/leaderboards`, `/api/test-series`,
  `/api/live-tests`, `/api/current-affairs`, `/api/previous-year-papers`,
  `/api/public-stats`, `/api/testimonials`, `/api/practice-questions`,
  `/api/settings` (+ alias `/api/site-settings`), `/api/contact`, `/api/faqs`.
- **AI gateway** (`app-port5001.js`): `/api/ai/mentor`, `/api/ai/explanation`,
  `/api/ai/logs`, plus `/api/embeddings` (search/index/stats),
  `/api/node-engine` (recommendations, learning-path, spaced-repetition,
  record-attempt), `/api/math`, `/api/adaptive`, `/api/adaptive-difficulty`.
- **Practice/test bridge**: `/api/practice`, `/api/question-builder`,
  `/api/test-builder`, `/api/test-templates`, `/api/sections`,
  `/api/search/questions`, `/api/search/vector`, `/api/topic-analytics`,
  `/api/weak-areas`, `/api/smart-revision` (+ alias `/api/revision`).
- **Live + realtime**: `/api/live-mock` (`liveMock.service.js`),
  `/api/live-tests`, ranking (`/api/ranking`), Socket.IO server with Redis
  adapter (`websocketManager.js`), `/api/admin/realtime/*` dashboards.
- **Everything else** (`app-port5001.js` `app.use` list): tests, questions,
  study, users, exams, exam-yearly, exam-seasons, series, exam-info,
  test-categories, exam-categories, bookmarks, notifications
  (+ `-pref`), achievements, blogs, referrals, doubts, study-groups, stages,
  payments, current-affairs, attempt, subscriptions (+ admin), intelligence,
  discussions, promotions, tag-configs, pyps, community, analytics, fortspy,
  import.
