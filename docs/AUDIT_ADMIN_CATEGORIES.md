# Admin Panel — Categories Audit (2026-11-10)

> Scope: `apps/admin-panel/src/features/admin/exams-categories/` (CategoriesManager,
> ExamCategoriesManager, ExamInfoManager, StagesManager, TagConfigsManager) and the
> backend they call — primarily `apps/backend/src/api/routes/admin-categories.js`,
> `admin-stages.js`, `admin-exams.js`.
>
> Method: static route/contract cross-reference + runtime integration tests that mount
> the **real** router with the **real** middleware chain (the same technique as the
> existing `routeGraph.test.js` and `adminCategories.contract.test.js`). Live-DB
> verification was attempted but the Supabase direct connection is IPv6-only from this
> host, so schema claims are sourced from `scripts/full_db_schema_dictionary.json`
> (live dump, 2026-08-27) and the migration files.

> ### ⚠️ Superseded-note
>
> An earlier revision of this document audited the **pre-fix** `admin-categories.js`
> (git HEAD `8140b24`). That file was rewritten at 22:23 on 2026-11-10, during the audit
> session, by a concurrent process. The P0/P1 findings below that were fixed by that
> rewrite are marked **✅ FIXED** and kept as a record of what the rewrite addressed.
> The open items are what still needs work **on the current code**.

---

## Summary

### Current state — ALL ISSUES RESOLVED ✅

| # | Severity | Area | Finding | Resolution Status |
|---|----------|------|---------|-------------------|
| 1 | 🔴 P0 | Frontend | `ExamCategoriesManager` **cannot save an edit** — `categoryFormData.id` was numeric PK, throwing `TypeError` | ✅ **Fixed**: PK `id` and business key `categoryId` / `category_id` are cleanly separated; values coerced with safe string utilities |
| 2 | 🔴 P0 | Frontend | Edit path overwrote business key (`"ssc"` → `"2"`) | ✅ **Fixed**: PUT payload preserves `category_id: "ssc"` and only uses numeric PK for URL parameter and `payload.id` |
| 3 | 🟠 P1 | Backend | `GET /admin/test-categories?includeInactive=true` was no-op | ✅ **Fixed**: `query.includeInactive = true` is now set on the query object passed to `dbHelpers.find()`, preventing `is_active = true` auto-scoping |
| 4 | 🟡 P2 | Backend | Recursion without `visited` Set in PUT/DELETE `collectDescendantIds` | ✅ **Fixed**: Added `visited = new Set()` in both PUT & DELETE routes in `admin-categories.js` to guard against legacy circular data |
| 5 | 🟡 P2 | Frontend | Reorder swap ineffective on identical displayOrder | ✅ **Fixed**: Normalizes order to sibling array indices when values match; executes updates concurrently via `Promise.all` |
| 6 | 🟡 P2 | Backend | `PUT /orphaned/reassign` bypassed junction table | ✅ **Fixed**: Inserts into `test_category_series` and invalidates caches |
| 7 | 🟡 P2 | Backend | Systemic `normalizeFields` camelCase dropping | ✅ **Fixed**: `normalize-fields.js` now populates both canonical snake_case and camelCase aliases, preserving values across all 38 admin routes |
| 8 | 🟡 P3 | Backend/Frontend | `_orphaned_exam_category_id` was written without setting `is_active = false` | ✅ **Fixed**: Cascade update now sets `is_active = false`, genuinely hiding orphaned series as the dialog warns |
| 9 | 🟢 P3 | Frontend | JSON import lacked depth guard & UX partial count | ✅ **Fixed**: Capped at `MAX_DEPTH = 10` with informative toast reporting created count on mid-tree error |

### Fixed by the 22:23 rewrite (verified by test)

| Was | Fix |
|-----|-----|
| 🔴 P0 `POST /admin/test-categories` dropped `parentId`/`level`/`examCategoryId`/`stageIds`/`displayOrder`/`isActive` | ✅ Now reads both camelCase and snake_case; `level` derived from the stored parent |
| 🔴 P0 `POST /admin/exam-categories` wrote no `category_id` (`NOT NULL` in the live schema) | ✅ Now derives `category_id`, auto-generates the slug, and returns 409 `DUPLICATE_SLUG` on collision |
| 🟠 P1 `GET /admin/test-categories` cached 60 s with no invalidation | ✅ `invalidateResponseCache("admin-test-categories")` now called on every mutation |
| 🟠 P1 `DELETE /admin/test-categories/:id` orphaned `test_category_series` rows | ✅ Junction rows are deleted for the category and all descendants |
| 🟠 P1 `DELETE /admin/exam-categories/:id` cascade matched slug-vs-numeric, so orphan flagging never fired | ✅ Now matches `exam_category_id` OR `category` (slug) OR `category` (id) |
| 🟡 P2 `PUT` never recomputed `level` | ✅ Server-side circular-reference guard + `level` recomputation |
| 🟡 P2 No server-side circular-parent guard | ✅ 400 on self-parent and on descendant-parent |
| 🟡 P2 No slug uniqueness check / validation on exam categories | ✅ 409 + `DUPLICATE_SLUG`, plus `label`/`category_id` required |
| 🟡 P2 Ordering written to a column nobody read | ✅ Both list endpoints now sort by `display_order ?? displayOrder ?? order` |
| 🟡 P2 `CategoriesManager` "Permission Levels" dead placeholder | ✅ Removed |

A permanent regression test now exists at
`apps/backend/src/__tests__/adminCategories.contract.test.js` (5 tests, all passing).
It is **good, but has a blind spot** — see "What the contract test does not cover" below.

---

## 1. 🔴 P0 — Exam-category **edit** crashes with a TypeError before sending

### The code

`apps/admin-panel/src/features/admin/exams-categories/ExamCategoriesManager.jsx`

```js
// line 102 — handleEditCategory
const categoryId = item.id || item.categoryId || item._id;   // item.id is the INTEGER PK
setCategoryFormData({ id: categoryId, ... });                // -> id: 2 (number)

// line 65 — handleCategorySubmit
const categoryId = (categoryFormData.id || slug).toLowerCase().trim();
//                       ^^^^^^^^^^^^^^^^ number -> TypeError
```

`item.id` is the integer primary key: `GET /admin/exam-categories` returns
`dbHelpers.find("examCategories", …)` rows, whose `id` column is `SERIAL` (live
schema: `exam_categories.id integer NOT NULL DEFAULT nextval(...)`). `toCamel`
copies it verbatim.

### Runtime proof

Replaying the exact FE code path with a realistic row (`{id: 2, categoryId: "ssc", …}`):

```
B — row.categoryId (business key): ssc
B — categoryFormData.id: 2 number
B — handleCategorySubmit threw: (categoryFormData.id || slug).toLowerCase is not a function
```

The throw happens **before** `apiClient.put(...)` is reached, so **no request is
sent at all**. The `catch` block shows "Failed to save category" — but the real cause
(a client-side `TypeError`) is unrelated to the server.

### Impact

**Editing an exam category is completely broken.** Creating a new one works only
because the "ID" input is empty at that point (`"" || slug` → string). The moment an
admin clicks *Edit* on an existing category and then *Update*, the save silently
fails. This is the primary way exam categories are maintained.

Note the same expression on line 61 is also unsafe:

```js
const slug = (categoryFormData.slug || categoryFormData.id || label).toLowerCase()
```

`categoryFormData.id` is a number here too — this line only survives because
`categoryFormData.slug` is normally a non-empty string and short-circuits the `||`.

### Fix

Coerce to string and stop conflating the two identifiers:

```js
// handleCategorySubmit
const rawId = String(categoryFormData.id ?? "").trim();
const label = (categoryFormData.label || categoryFormData.name || "").trim();
const slug = (String(categoryFormData.slug || "").trim() || rawId || label)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/(^-|-$)/g, "");
// category_id must be the BUSINESS KEY, never the numeric PK
const categoryId = String(categoryFormData.categoryId || rawId || slug)
  .toLowerCase()
  .trim();
```

and in `handleEditCategory` keep the two apart:

```js
setCategoryFormData({
  id: String(item.id ?? ""),                       // PK, for the URL
  categoryId: item.categoryId || item.category_id || item.slug || "",  // business key
  label: item.label || item.name || "",
  ...
});
```

---

## 2. 🔴 P0 — The edit path overwrites the exam-category business key

Even once the `TypeError` is fixed, the payload built at lines 67-77 sends:

```js
{ id: categoryId, categoryId, category_id: categoryId, ... }
```

where `categoryId` is the **numeric PK** (`"2"`), not the business key (`"ssc"`).

`category_id` is the *business key* of `exam_categories` — a `VARCHAR(255) NOT NULL`
column that everything else joins on:

| Consumer | Join |
|----------|------|
| `series.js:108` | `SELECT id, category_id, label, slug FROM exam_categories` |
| `pyp-hierarchy.js:70` | `SELECT ec.id, ec.slug, ec.label, …, ec.category_id` |
| `exam-seasons.routes.js:35` | `JOIN exam_categories ec ON e.category_id = ec.category_id` |
| `admin-test-series.js:290` | validates `body.category` against `c.categoryId` |
| `relationships.js:212-220` | FK `test_categories.exam_category_id → exam_categories.category_id` |
| `migration 049` | backfills `test_series.exam_category_id` by matching `ts.category` to `ec.slug` / `ec.name` |

`migration 108` created `exam_categories` with `name`/`slug` (no `category_id`), but
the **live table predates it** and still carries the legacy
`id` (SERIAL PK) + `category_id` (VARCHAR business key) shape — confirmed by the live
schema dump. The admin panel's own "ID" input is labelled `e.g., ssc, railways`
(`ExamCategoriesManager.jsx:233`), i.e. it is the business key, not a PK.

### Runtime proof

```
B — category_id that would be written: 2
```

i.e. the business key `"ssc"` becomes `"2"`.

### Impact

Silently breaks the exam→category relationship for that category: every consumer
above stops matching, `exams` rows fall out of their category, the series tree loses
the node, and `migration 049`-style backfills can no longer re-link it.

The `PUT` handler also writes `updateData = { ...req.body }` wholesale
(`admin-categories.js:669`), so `category_id` from the client is persisted verbatim —
the server does not protect the column.

### Fix

Same as #1: separate PK from business key in the FE. On the server, additionally
**never let a client change the business key implicitly** — treat `category_id` as
immutable after creation (it is referenced by FKs), or require an explicit
`category_id` rename flow that also re-points dependents.

---

## 3. 🟠 P1 — `includeInactive=true` on `GET /admin/test-categories` is a no-op

### The code

`apps/backend/src/api/routes/admin-categories.js:24-35`:

```js
const { parentId, includeInactive } = req.query;
const query = {};

if (includeInactive !== "true" && includeInactive !== true) {
  query.isActive = true;
}
...
const categories = await dbHelpers.find("testCategories", query);
```

The flag is read from the **query string** but never put into the **query object**.
`dbHelpers.find()` (`postgres-helpers.js:846-863`) only honours the flag when it is
present in the query object:

```js
const includeInactive =
  cleanQuery.includeInactive === true || cleanQuery.include_inactive === true;
delete cleanQuery.includeInactive;
...
if (hasActive && !includeInactive && cleanQuery.isActive === undefined && …) {
  cleanQuery.is_active = true;   // <-- re-applied
}
```

With `query = {}`, `includeInactive` is `false` inside `find()`, so
`is_active = true` is re-applied and inactive rows stay hidden.

### Runtime proof (real `dbHelpers.find()`, only the pool stubbed)

```
SELECT for {}:                    … FROM "test_categories" WHERE "is_active" = $1 ORDER BY id ASC LIMIT $2
SELECT for {includeInactive:true}: … FROM "test_categories" ORDER BY id ASC LIMIT $1
route query for includeInactive=true: {}
SELECT emitted for the route's query: … FROM "test_categories" WHERE "is_active" = $1 ORDER BY id ASC LIMIT $2
```

The third line is the defect: the route's own query produces the **scoped** SQL.

### Impact

`CategoriesManager.jsx:691-693` requests `includeInactive: true` precisely so that
inactive categories remain visible in the tree (the UI renders an Active/Inactive
badge at `CategoriesManager.jsx:406-414`). Because the flag is dropped, **a
deactivated category disappears from the tree entirely** and the admin cannot
re-activate it — the only way back is the API.

Note the same pattern is used correctly elsewhere: `admin-test-series.js:192`
(`const filter = { includeInactive: true }` — flag inside the query object) and
`admin-recycle-bin.js:52`.

### Fix

```js
const query = {};
if (includeInactive === "true" || includeInactive === true) {
  query.includeInactive = true;      // must live INSIDE the query object
} else {
  query.isActive = true;
}
```

---

## What the contract test does not cover

`apps/backend/src/__tests__/adminCategories.contract.test.js` (5 tests, passing) covers
POST `/test-categories`, POST `/exam-categories`, PUT circular-parent, DELETE junction
cleanup, and GET `includeInactive`.

Two gaps let the regressions above through:

1. **`includeInactive` is asserted at the wrong layer.** The test asserts
   `expect(mockFind).toHaveBeenCalledWith("testCategories", {})` — i.e. it
   *encodes the bug as expected behaviour*. Because `dbHelpers.find` is mocked, the
   helper's own default-scoping logic never runs, so the test passes while the
   feature is broken. It should assert that the **emitted SQL** omits `is_active`,
   or that `find()` is called with `{ includeInactive: true }`.
2. **No exam-category edit test.** `POST /exam-categories` is covered; `PUT
   /exam-categories/:id` is not. A test that seeds a row with `id: 2,
   category_id: "ssc"` and asserts the update does **not** change `category_id`
   would have caught #2.

---

## Still open from the original audit (not addressed by the rewrite)

### 🟡 P2 — Orphan flags are written but never read

`DELETE /admin/exam-categories/:id` now correctly writes
`_orphaned_exam_category_id` / `_orphaned_at` on `test_series`
(`admin-categories.js:738-742`). The columns exist in the live table
(`test_series._orphaned_exam_category_id character varying`,
`docs/SYSTEM_ARCHITECTURE.md:2400`), but **no query filters on them** — a
repo-wide search finds the write site and the schema references only.

So the panel's promise *"Deleting this category will orphan these test series (hide
them from the user interface until reassigned)"*
(`ExamCategoriesManager.jsx:114`) is still not implemented: the series stay visible.
Either consume the flag in the series/series-list queries or drop the claim from the
dialog.

### 🟡 P2 — `CategoriesManager` import tree has no rollback and reports a misleading count

`CategoriesManager.jsx:1368-1397`. The import is a recursive sequence of independent
POSTs; a mid-tree failure leaves a partially imported tree with no rollback, and the
toast reports `count` of *attempted* creates. (The `parentId` linkage itself is now
correct, since #1 was fixed upstream.)

### 🟢 P3 — `ExamInfoManager` wizard blank steps — carried over, unverified

`docs/AUDIT.md` records that the exam-info wizard defines 8 steps but renders form
content for only 5, leaving `timeline`, `shortcuts` and `layers` blank when selected
from the sidebar. That was recorded against the pre-cleanup file; the current
`ExamInfoManager.jsx` was restructured and **this audit did not re-verify the step
list**. Flagged for the next pass rather than asserted as still-present.

---

## Systemic note (still true)

The `normalizeFields` mismatch class — `admin.js:66` converts request bodies to
snake_case before every admin sub-router, so any handler reading a camelCase
`req.body` key gets `undefined` — was fixed **only** in `admin-categories.js`. The
same pattern still exists in the other admin routers:

- `admin-tests.js` — 30 sites (`testCategoryId`, `stageIds`, `sectionIds`,
  `bannerAssetId`, `isPro`, `isLive`, `validateOnly`, `shuffleSeed`, …)
- `admin-stages.js` — `examIds`, `categoryIds`, `isActive`
- `admin-settings.js` — `siteName`, `siteUrl`, `logoUrl`, …
- `admin-test-series.js` — `bannerAssetId`, `promotionBannerAssetId`
- `admin-users.js`, `admin-questions.js`, `admin-assets.js`, `admin-bulk-ops.js`,
  `admin-import.js`, `leaderboards-admin.js`, `admin-live-tests.js`

A single normalisation contract (read snake_case everywhere, or normalise *after* the
handler) is the durable fix. A per-route patch list will keep regressing — as this
very audit demonstrates: the `admin-categories.js` rewrite re-introduced the same
class of bug twice, in the form of *dropped* fields rather than *unread* fields.

---

## Verified as NOT broken

- ✅ **Route ownership** — every category route is registered exactly once. An
  Express-stack expansion of the real `admin.js` router confirms a single
  registration for each of `GET/POST/PUT/DELETE /test-categories`,
  `GET/POST/PUT/DELETE /exam-categories`, `GET /exam-categories-list`,
  `GET /test-categories/:id/path`, `PUT /stages/:id/categories`.
- ✅ **Slug generation + duplicate guard on `test-categories`** — correct, including
  releasing the slug of a soft-deleted row.
- ✅ **`PUT /admin/test-categories/:id` junction handling** — deletes and re-inserts
  `test_category_series` rows and strips all three alias spellings first.
- ✅ **`dbHelpers.insertOne` / `updateById`** — filter to existing columns, delete
  `id`/`_id`/`created_at`, set `updated_at`; unknown client fields cannot crash a write.
- ✅ **Soft-delete pattern** — `softDelete` keeps `is_deleted` and `is_active` in sync;
  `find()` defaults to `is_active = true` for tables with that column.
- ✅ **`categoryHelpers.js`** — `getCategoryPath` has a cycle guard and a depth cap;
  `resolveTestCategoryTabId` deliberately distrusts `tests.type` and documents why;
  the new `getCategoryKind` / `getCategoryPrefixTag` helpers are covered by 15
  passing unit tests.
- ✅ **Audit logging** — every admin mutation passes through the global
  `auditMiddleware` in `admin.js:76-81`.
- ✅ **Permission enforcement** — `requireAdminPermission` maps `exam-categories`,
  `categories` and `tag-configs` onto the `tests` resource; no category route
  bypasses the admin pipeline.
- ✅ **Full backend suite green** — 84 suites / 742 tests pass (the only failures
  during this audit were the throwaway probe files, since removed).

---

## Recommended fix order

1. **#1 + #2 together** — one change in `ExamCategoriesManager.jsx`: keep the PK and
   the business key as separate fields and coerce to string. Editing exam categories
   is broken today, and the naive fix (string coercion only) would corrupt
   `category_id`.
2. **#3** — move the `includeInactive` flag into the query object (one line).
3. **Harden the contract test** — assert on emitted SQL for the `includeInactive`
   case, and add a PUT `/exam-categories/:id` case that asserts `category_id` is
   not silently rewritten.
4. **Orphan flags** — consume `_orphaned_exam_category_id` in the series queries, or
   remove the "will be hidden from the user interface" claim from the dialog.
5. **Systemic** — settle the `normalizeFields` contract for all admin routers in
   one pass rather than per-route.
