# API Endpoints Documentation

> New and significantly modified endpoints added during the admin panel improvement effort.
> All endpoints require admin authentication (JWT + admin role) unless otherwise noted.

---

## Performance Optimized Endpoints

These endpoints were rewritten to push filtering, sorting, and pagination into SQL instead of loading entire tables into Node.js memory.

### `GET /admin/recent-activity`
**Auth:** protect, admin  
**Description:** Returns the 8 most recent platform events (registrations, test completions, media uploads) using SQL ORDER BY + LIMIT instead of in-memory sorting.  
**Query params:** None  
**Response:**
```json
{
  "success": true,
  "data": [
    {
      "type": "user_registration|test_completed|media_uploaded|content_uploaded",
      "title": "New user registered",
      "description": "user@email.com joined the platform",
      "time": "5 minutes ago",
      "userId": 123,
      "icon": "users",
      "color": "text-blue-600"
    }
  ]
}
```
**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/recent-activity
```

---

### `GET /admin/realtime/active-users`
**Auth:** protect, admin  
**Description:** Returns counts of active users across time windows (5min, 30min, 1hr) using COUNT(DISTINCT) aggregations with SQL FILTER. Also returns hourly activity histogram for the last 24 hours.  
**Query params:** None  
**Response:**
```json
{
  "success": true,
  "data": {
    "onlineNow": 42,
    "takingTests": 15,
    "totalRegistered": 12500,
    "activeLast5Min": 42,
    "activeLast30Min": 128,
    "activeLastHour": 310,
    "hourlyActivity": [
      { "hour": 14, "label": "14:00", "users": 85, "tests": 43 }
    ],
    "timestamp": "2026-07-01T12:00:00.000Z"
  }
}
```
**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/realtime/active-users
```

---

### `GET /admin/realtime/test-activity`
**Auth:** protect, admin  
**Description:** Returns real-time test activity stats using SQL aggregations: active in-progress tests, most popular active tests (top 10), completion rate, and average score for the last hour.  
**Query params:** None  
**Response:**
```json
{
  "success": true,
  "data": {
    "activeTestsNow": 15,
    "completedLastHour": 230,
    "completionRateLastHour": 78,
    "avgScoreLastHour": 650,
    "popularActiveTests": [
      { "testId": 10, "testName": "JEE Main Mock 1", "activeUsers": 12 }
    ],
    "timestamp": "2026-07-01T12:00:00.000Z"
  }
}
```
**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/realtime/test-activity
```

---

### `GET /admin/realtime/revenue`
**Auth:** protect, admin  
**Description:** Returns revenue and enrollment analytics using COUNT(*) FILTER aggregations. Calculates revenue from Pro Pass users, tracks enrollment trends, and lists top 5 enrolled series.  
**Query params:** None  
**Response:**
```json
{
  "success": true,
  "data": {
    "totalRevenue": 125000,
    "revenueLastHour": 2500,
    "revenueToday": 15000,
    "totalProUsers": 2500,
    "activeProUsers": 2200,
    "newProLastHour": 5,
    "newProToday": 30,
    "enrollmentsLastHour": 12,
    "enrollmentsToday": 85,
    "enrollmentsThisWeek": 420,
    "topEnrolledSeries": [
      { "seriesId": 1, "seriesName": "JEE Complete", "enrollments": 150 }
    ],
    "proPassPrice": 50,
    "timestamp": "2026-07-01T12:00:00.000Z"
  }
}
```
**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/realtime/revenue
```

---

### `GET /admin/users`
**Auth:** protect, admin  
**Description:** Paginated user list with SQL WHERE/ILIKE/ORDER BY/LIMIT/OFFSET. Previously loaded all users into memory and filtered in JS.  
**Query params:**
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Results per page (max 100) |
| `search` | string | — | ILIKE search on name, email, phone |
| `role` | string | — | Filter by `user`, `admin`, or `super_admin` |
| `status` | string | — | Filter by `active` or `inactive` |
| `pro` | boolean | false | Filter Pro users only |
| `includeInactive` | boolean | false | Include inactive users |

**Response:**
```json
{
  "success": true,
  "count": 20,
  "total": 12500,
  "page": 1,
  "limit": 20,
  "totalPages": 625,
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "is_active": true,
      "created_at": "2026-01-15T10:30:00.000Z"
    }
  ]
}
```
**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/admin/users?page=1&limit=20&search=john&role=user"
```

---

## Payments

Base path: `/admin/payments`

### `GET /admin/payments/transactions`
**Auth:** protect, admin  
**Description:** Paginated list of payment transactions with search and status filtering. Joins with users table for name/email display.  
**Query params:**
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Results per page (max 100) |
| `search` | string | — | ILIKE search on user name, email, gateway payment ID, gateway |
| `status` | string | — | Filter by `success`, `failed`, `pending`, or `refunded` |

**Response:**
```json
{
  "success": true,
  "count": 20,
  "total": 500,
  "page": 1,
  "limit": 20,
  "totalPages": 25,
  "data": [
    {
      "id": 1,
      "userId": 123,
      "userName": "John Doe",
      "userEmail": "john@example.com",
      "amount": 500,
      "currency": "INR",
      "status": "success",
      "gateway": "razorpay",
      "gatewayPaymentId": "pay_abc123",
      "createdAt": "2026-07-01T10:30:00.000Z",
      "refundedAt": null,
      "refundedBy": null,
      "metadata": {}
    }
  ]
}
```
**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/admin/payments/transactions?status=success&limit=10"
```

---

### `GET /admin/payments/stats`
**Auth:** protect, admin  
**Description:** Aggregate payment counts by status and time windows using COUNT(*) FILTER.  
**Query params:** None  
**Response:**
```json
{
  "success": true,
  "data": {
    "total_revenue": 1250000,
    "successful": 450,
    "failed": 23,
    "pending": 12,
    "refunded": 8,
    "last_24h": 35,
    "last_7d": 180,
    "last_30d": 500,
    "total": 493
  }
}
```
**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/payments/stats
```

---

### `POST /admin/payments/:id/refund`
**Auth:** protect, admin  
**Description:** Marks a successful payment as refunded. Only successful payments can be refunded. Creates an audit log entry.  
**Path params:**
| Param | Type | Description |
|---|---|---|
| `id` | integer | Payment ID |

**Body params:** None  
**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 123,
    "amount": 500,
    "currency": "INR",
    "status": "refunded",
    "refunded_at": "2026-07-01T12:00:00.000Z",
    "refunded_by": 1
  }
}
```
**Example:**
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/payments/1/refund
```

---

### `GET /admin/payments/webhooks`
**Auth:** protect, admin  
**Description:** Lists recent webhook events from the webhook_events table (up to 50). Returns empty list if table doesn't exist.  
**Query params:** None  
**Response:**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": 1,
      "event": "payment.captured",
      "gateway": "razorpay",
      "payload": {},
      "created_at": "2026-07-01T10:30:00.000Z"
    }
  ]
}
```
**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/payments/webhooks
```

---

## Content Moderation

Base path: `/admin/moderation`

### `GET /admin/moderation/stats`
**Auth:** protect, admin  
**Description:** Returns counts of doubts by status (total, open, resolved, flagged, hidden). Gracefully handles missing tables/columns.  
**Query params:** None  
**Response:**
```json
{
  "success": true,
  "data": {
    "total": 250,
    "open": 45,
    "resolved": 180,
    "flagged": 12,
    "hidden": 13
  }
}
```
**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/moderation/stats
```

---

### `GET /admin/moderation/doubts`
**Auth:** protect, admin  
**Description:** Paginated list of active doubts with user join. Supports search on title/description/user name, status filter, and flagged filter.  
**Query params:**
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Results per page (max 100) |
| `search` | string | — | ILIKE search on title, description, user name |
| `status` | string | — | Filter by `open`, `resolved`, `pending`, or `hidden` |
| `flagged` | boolean | false | Filter flagged doubts only |

**Response:**
```json
{
  "success": true,
  "count": 20,
  "total": 45,
  "page": 1,
  "limit": 20,
  "totalPages": 3,
  "data": [
    {
      "id": 1,
      "title": "Doubt about calculus",
      "description": "How to integrate x^2?",
      "status": "open",
      "user_name": "John Doe",
      "is_flagged": false,
      "created_at": "2026-07-01T10:30:00.000Z"
    }
  ]
}
```
**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/admin/moderation/doubts?status=open&limit=10"
```

---

### `PUT /admin/moderation/doubts/:id/status`
**Auth:** protect, admin  
**Description:** Updates the status of a doubt. Creates an audit log entry with previous and new status.  
**Path params:**
| Param | Type | Description |
|---|---|---|
| `id` | integer/string | Doubt ID |

**Body params:**
| Param | Type | Required | Description |
|---|---|---|---|
| `status` | string | Yes | Must be one of: `open`, `resolved`, `pending`, `hidden` |

**Response:**
```json
{
  "success": true,
  "message": "Doubt status updated to resolved"
}
```
**Example:**
```bash
curl -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status": "resolved"}' \
  http://localhost:3000/api/admin/moderation/doubts/1/status
```

---

### `DELETE /admin/moderation/doubts/:id`
**Auth:** protect, admin  
**Description:** Soft-deletes a doubt (sets `is_active = false`). Creates an audit log entry.  
**Path params:**
| Param | Type | Description |
|---||---|
| `id` | integer/string | Doubt ID |

**Response:**
```json
{
  "success": true,
  "message": "Doubt deleted"
}
```
**Example:**
```bash
curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/moderation/doubts/1
```

---

## Content Management

### `POST /admin/tests/:id/duplicate`
**Auth:** protect, admin  
**Description:** Deep-copies a test including sections, questions, and junction table links. The duplicated test is created in draft status.  
**Path params:**
| Param | Type | Description |
|---|---|---|
| `id` | integer/string | Test ID |

**Body params:** None  
**Response:**
```json
{
  "success": true,
  "data": {
    "newTestId": 456,
    "newTitle": "JEE Main Mock 1 (Copy)"
  }
}
```
**Example:**
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/tests/123/duplicate
```

---

### `PUT /admin/questions/bulk`
**Auth:** protect, admin  
**Description:** Bulk updates fields on multiple questions at once. Allowed fields: `difficulty`, `status`, `subject`, `category`, `type`, `tags`. Creates an audit log entry.  
**Body params (JSON):**
| Param | Type | Required | Description |
|---|---|---|---|
| `questionIds` | integer[] | Yes | Array of question IDs to update |
| `updates` | object | Yes | Key-value pairs of fields to update |

**Response:**
```json
{
  "success": true,
  "updated": 15
}
```
**Example:**
```bash
curl -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"questionIds": [1, 2, 3, 4, 5], "updates": {"difficulty": "Hard", "status": "active"}}' \
  http://localhost:3000/api/admin/questions/bulk
```

---

### `POST /admin/questions/upload-image`
**Auth:** protect, admin  
**Description:** Uploads an image file for use in questions. Returns a signed/public URL and storage key. Uses disk-based upload (not memory).  
**Body params:** `multipart/form-data`
| Param | Type | Required | Description |
|---|---|---|---|
| `file` | file | Yes | Image file (multipart upload) |

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://storage.example.com/questions/abc123.png",
    "storageKey": "questions/abc123.png",
    "provider": "s3"
  }
}
```
**Example:**
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/image.png" \
  http://localhost:3000/api/admin/questions/upload-image
```

---

### `GET /admin/questions/:id/history`
**Auth:** protect, admin  
**Description:** Returns the version history for a question, ordered by version number descending. Each version contains a full snapshot of the question state at that point.  
**Path params:**
| Param | Type | Description |
|---|---|---|
| `id` | integer/string | Question ID |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "question_id": 42,
      "version_number": 3,
      "snapshot": { "question_text": "...", "options": ["A", "B", "C", "D"] },
      "edited_by": 1,
      "snapshot_type": "admin_edit",
      "change_summary": "Pre-update snapshot (v3)",
      "metadata": { "source": "admin_update", "adminEmail": "admin@example.com" },
      "created_at": "2026-07-01T10:30:00.000Z"
    }
  ]
}
```
**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/questions/42/history
```

---

### `POST /admin/questions/:id/restore/:versionId`
**Auth:** protect, admin  
**Description:** Restores a question to a previous version snapshot. Only restorable fields are applied (question_text, options, correct_option, explanation, marks, etc.). Syncs test stats after restore.  
**Path params:**
| Param | Type | Description |
|---|---|---|
| `id` | integer/string | Question ID |
| `versionId` | integer/string | Version snapshot ID from history |

**Body params:** None  
**Response:**
```json
{
  "success": true,
  "data": {
    "id": 42,
    "question_text": "What is 2+2?",
    "options": ["3", "4", "5", "6"],
    "correct_option": 1,
    "updated_at": "2026-07-01T12:00:00.000Z"
  }
}
```
**Example:**
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/questions/42/restore/1
```

---

## Two-Factor Authentication (TOTP)

Base path: `/auth`  
**Note:** These are user-facing auth routes, not admin-only. All require a valid JWT (`protect` middleware).

### `POST /auth/2fa/enroll`
**Auth:** protect  
**Description:** Initiates 2FA enrollment for the authenticated user. Returns a TOTP secret and QR code URI for the user to scan with their authenticator app.  
**Body params:** None  
**Response:**
```json
{
  "success": true,
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "otpauthUri": "otpauth://totp/App:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=App",
    "qrCodeUrl": "https://api.example.com/api/auth/2fa/qr?secret=JBSWY3DPEHPK3PXP"
  }
}
```
**Example:**
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/auth/2fa/enroll
```

---

### `POST /auth/2fa/verify`
**Auth:** protect  
**Description:** Verifies a TOTP code to complete 2FA enrollment. Must be called after `/2fa/enroll` with the code from the authenticator app.  
**Body params (JSON):**
| Param | Type | Required | Description |
|---|---|---|---|
| `code` | string | Yes | 6-digit TOTP code from authenticator app |

**Response:**
```json
{
  "success": true,
  "message": "Two-factor authentication enabled successfully",
  "data": {
    "enabled": true,
    "backupCodes": ["a1b2-c3d4", "e5f6-g7h8"]
  }
}
```
**Example:**
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"code": "123456"}' \
  http://localhost:3000/api/auth/2fa/verify
```

---

### `POST /auth/2fa/disable`
**Auth:** protect  
**Description:** Disables 2FA for the authenticated user. Requires a valid TOTP code to confirm.  
**Body params (JSON):**
| Param | Type | Required | Description |
|---|---|---|---|
| `code` | string | Yes | 6-digit TOTP code to confirm disable |

**Response:**
```json
{
  "success": true,
  "message": "Two-factor authentication disabled successfully"
}
```
**Example:**
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"code": "123456"}' \
  http://localhost:3000/api/auth/2fa/disable
```

---

### `POST /auth/2fa/backup-codes`
**Auth:** protect  
**Description:** Regenerates backup codes for 2FA. Invalidates all previously issued backup codes.  
**Body params:** None  
**Response:**
```json
{
  "success": true,
  "data": {
    "backupCodes": ["a1b2-c3d4", "e5f6-g7h8", "i9j0-k1l2"]
  }
}
```
**Example:**
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/auth/2fa/backup-codes
```

---

### `GET /auth/2fa/status`
**Auth:** protect  
**Description:** Returns the current 2FA status for the authenticated user.  
**Query params:** None  
**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "enrolledAt": "2026-07-01T10:00:00.000Z",
    "backupCodesRemaining": 8
  }
}
```
**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/auth/2fa/status
```

---

### `POST /auth/login/2fa`
**Auth:** None (public, rate-limited)  
**Description:** Second step of 2FA login flow. Called after `/auth/login` returns a `requires2FA` flag. Accepts either a TOTP code or a backup code.  
**Body params (JSON):**
| Param | Type | Required | Description |
|---|---|---|---|
| `tempToken` | string | Yes | Temporary token from initial login |
| `code` | string | Yes | 6-digit TOTP code or backup code (format: `xxxx-xxxx`) |

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user"
    }
  }
}
```
**Example:**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"tempToken": "temp_xyz", "code": "123456"}' \
  http://localhost:3000/api/auth/login/2fa
```

---

## Route Module Registrations

The admin router (`admin.js`) registers 18 new route modules extracted for better maintainability:

| Module | Path | Description |
|---|---|---|
| `admin-extras.js` | (root) | Extra/misc admin routes |
| `admin-stats.js` | (root) | Statistics endpoints |
| `admin-content.js` | (root) | Content management |
| `admin-enrollments.js` | (root) | Enrollment management |
| `admin-assets.js` | (root) | Asset/file management |
| `admin-settings.js` | (root) | Settings management |
| `admin-exams.js` | (root) | Exam management |
| `admin-navigation-tags.js` | (root) | Navigation tag management |
| `admin-activity.js` | (root) | Activity tracking (includes `/recent-activity`) |
| `admin-curriculum.js` | (root) | Curriculum management |
| `admin-commerce.js` | (root) | Commerce/payment management |
| `admin-catalog.js` | (root) | Catalog management |
| `admin-realtime.js` | (root) | Real-time dashboards |
| `admin-backups.js` | (root) | Backup management |
| `admin-dynamic-content.js` | (root) | Dynamic content management |
| `admin-deep-analytics.js` | (root) | Deep analytics |
| `admin-bulk-ops.js` | (root) | Bulk operations |
| `admin-payments.js` | `/payments` | Payment transactions, stats, refunds, webhooks |
| `admin-moderation.js` | `/moderation` | Content moderation (doubts queue) |

**Additional pre-existing modules** (not new, included for completeness):

| Module | Path |
|---|---|
| `admin-categories.js` | (root) |
| `admin-users.js` | (root) |
| `admin-stages.js` | (root) |
| `admin-recycle-bin.js` | `/trash` |
| `admin-test-series.js` | (root) |
| `admin-tests.js` | (root) |
| `admin-questions.js` | (root) |
| `admin-sections.js` | `/sections` |
| `admin-analytics.js` | `/admin/analytics` |
| `admin-roles.js` | (root) |
| `admin-audit.js` | `/admin/audit-logs` |
| `admin-email-templates.js` | `/admin/email-templates` |
| `admin-navigation.js` | `/admin/navigation` |
| `admin-coming-soon.js` | `/admin/coming-soon` |
| `leaderboards-admin.js` | `/leaderboards` |
| `stages.js` | `/stages` |

---

## Summary

| Category | Endpoints Documented |
|---|---|
| Performance Optimized | 5 |
| Payments | 4 |
| Content Moderation | 4 |
| Content Management | 5 |
| Two-Factor Auth | 6 |
| **Total** | **24** |
