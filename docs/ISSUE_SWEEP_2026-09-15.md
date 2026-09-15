# Trstprep V2.1 — Broad Issue Sweep (2026-09-15)

Scope: full-monorepo survey (apps/backend, apps/frontend, apps/admin-panel, packages/,
scripts/, .github/workflows, .husky, root config, docs). Every finding below was
reproduced locally against this working copy; commands and file:line evidence are
included so each item can be re-verified in seconds.

Base revision: `d7740c4` (master). Working tree had 2 pre-existing modifications
(`apps/backend/src/app-port5001.js`, `apps/backend/src/infrastructure/database/postgres-helpers.js`)
— both change set, uncommitted; nothing in this sweep was edited except a throwaway
scan script which was deleted.

Severity legend: **P0** = CI/guardrail is red or a documented entry point does not exist ·
**P1** = wrong/unreachable runtime behaviour, silently unshipped tests · **P2** = fragility,
hygiene, drift, perf · **P3** = cosmetic/cleanup.

---

## 0. Summary

| #   | Finding                                                                      | Sev | Evidence                                     |
| --- | ---------------------------------------------------------------------------- | --- | -------------------------------------------- |
| 1   | Data Guard workflow fails 3 of its own gates                                 | P0  | exact CI logic re-run locally                |
| 2   | `ci.yml` `test-migrations` job calls 2 non-existent entry points             | P0  | file absence + `git ls-files`                |
| 3   | `sync-repo-brain --check` exits 1 (6 stale spans)                            | P0  | `node scripts/sync-repo-brain.mjs --check`   |
| 4   | Knowledge graph + GRAPH_REPORT stale vs HEAD                                 | P1  | `GRAPH_REPORT.md:13` vs `git rev-parse HEAD` |
| 5   | `GET /api/current-affairs` public handler is dead code                       | P1  | mount order app-port5001.js:990 vs :1064     |
| 6   | 8 literal routes shadowed by earlier `/:param` routes                        | P1  | route scan (see list)                        |
| 7   | `live-tests-public` router mounted twice at same path                        | P2  | app-port5001.js:1025 + :1064                 |
| 8   | Dead module `modules/test-series/*`                                          | P2  | no importer                                  |
| 9   | Unused imports `jwt`, `auditRoutes` in composition root                      | P3  | app-port5001.js:21, 98                       |
| 10  | `.gitignore` silently excludes 5 real test files + 23 tooling scripts        | P1  | `git status --ignored`                       |
| 11  | `scripts/run-database-audit.js` referenced by README/AGENTS/CI but untracked | P1  | `git ls-files` empty                         |
| 12  | No `typecheck` task exists anywhere; stale `tsc`-not-found logs committed    | P2  | `frontend-typecheck.log`                     |
| 13  | Backend test script uses `--passWithNoTests`                                 | P2  | apps/backend/package.json                    |
| 14  | `env-validation.mjs` (backend) is orphaned — never imported                  | P1  | repo-wide grep                               |
| 15  | ~95 env keys used in code are absent from `.env.example`                     | P2  | key diff                                     |
| 16  | Action pinning inconsistent (SHAs in ci.yml, floating tags elsewhere)        | P2  | workflows                                    |
| 17  | `.env` still in git history (2 commits) — rotation/scrub open                | P1  | `git log --all -- apps/backend/.env`         |
| 18  | `validateAdminApiKey` uses `===` for secret compare                          | P2  | origin.middleware.js:333                     |
| 19  | 10× `jwt.verify()` without `algorithms` allow-list                           | P2  | see list                                     |
| 20  | Access/refresh tokens persisted in localStorage/sessionStorage               | P2  | admin apiClient:41-44,145-181                |
| 21  | Dynamic SQL identifier interpolation in admin routes (allowlist?)            | P2  | 8 sites                                      |
| 22  | ~300 `console.*` calls instead of pino logger                                | P3  | `git grep -c`                                |
| 23  | Committed 400 KB schema dump + 1.2 MB audit JSON + stale logs                | P3  | repo root/scripts                            |
| 24  | Doc drift: AGENTS.md says next migration is `141_*` (141 already exists)     | P2  | migrations dir                               |

---

## 1. Guardrails that are currently RED (P0)

### 1.1 `data-guard.yml` fails 3 of its 6 checks

Re-ran the workflow's exact shell logic locally (Git Bash, same coreutils as
`ubuntu-latest`):

```sh
# check: "Fail if two migrations share a numeric prefix"
cd apps/backend/src/infrastructure/database/migrations
ls | awk -F'_' '/^[0-9]/{print $1}' | sed 's/[a-zA-Z]$//' | sort | uniq -d
# -> 000
# -> 056          => DUPES non-empty => exit 1
```

Duplicated prefixes (`000`, `056`):

- `000_baseline_functions.sql` + `000a_enable_rls_policies.sql`
- `056a_fix_security_definer_views_and_duplicate_indexes.sql` + `056b_units_add_part_id.sql`

The gate's `sed 's/[a-zA-Z]$//'` normalises `056a`/`056b` to `056`, i.e. the
`NNNx_` suffix convention used by this repo is itself what trips the gate.
So either the convention or the gate must change — today it is a hard CI failure.

```sh
# check: "Fail if any committed JSON contains PII keys"
PII_KEYS='full_name|avatar_url|answer_map|time_map|password_hash|phone_number|aadhaar|pan_card'
git ls-files '*.json' | xargs -I{} grep -lE "\"($PII_KEYS)\"" {}
# -> apps/backend/src/data/collections/examInfo.json          (exam "full_name": "Staff Selection Commission ...")
# -> scripts/full_db_schema_dictionary.json                   ("name": "full_name"  — a column name)
#    => HITS non-empty => exit 1
```

Both hits are **false positives** (an exam's display name and a schema-dictionary
key name), but the gate as written cannot tell a PII value from a column name —
so it fails on every push.

```sh
# check: "Run seeder fixtures through JSON parse"
for f in apps/backend/src/infrastructure/database/seeders/_fixtures/*.json; do
  node -e "const d=require('$f'); ..." || exit 1
done
# -> MODULE_NOT_FOUND for all 6 fixtures
```

`require('<repo-relative-path>')` is a **bare specifier** — Node resolves it
against `node_modules`, not the CWD. Verified for all six fixtures
(`app_settings, exam_rooms, live_tests, questions, subjects, tests.json`);
and `node -e "require('apps/backend/package.json')"` fails identically.
Fix: `require('./$f')` (or `JSON.parse(fs.readFileSync($f))`).

**Net effect:** the Data Guard workflow exits non-zero on the duplicate-prefix
step (step order) and remains red after any single fix.

### 1.2 `ci.yml` → `test-migrations` cannot start

```yaml
# .github/workflows/ci.yml:189
run: node apps/backend/src/infrastructure/database/run-migrations.js
# .github/workflows/ci.yml:193
run: node scripts/run-database-audit.js
```

- `apps/backend/src/infrastructure/database/run-migrations.js` **does not exist**
  (only `migrationRunner.js`, exporting `runMigrations(pool, { afterMigrations })`).
  No `run-migrations*` path is tracked anywhere (`git ls-files` empty).
- `scripts/run-database-audit.js` exists **on disk but is untracked** — it is
  matched by `.gitignore:74` (`run-*.js`) and `git ls-files --error-unmatch` fails.
  A fresh clone (or CI) never receives the file.

Docs compound this: `README.md:201` and `AGENTS.md` both instruct agents to run
`scripts/run-database-audit.js` "before any migration" — that file is not in the repo.

### 1.3 `docs/REPO_BRAIN.html` is stale (own guard says so)

```
$ node scripts/sync-repo-brain.mjs --check
[sync-repo-brain] note: no spans for keys: workflows, backend_tests, compose_services
[sync-repo-brain] --check: 6 span(s) stale.
exit=1
```

Stale values include `<span data-brain="head">6f832a03` (HEAD is `d7740c4`) and
`<span data-brain="migration_files">130` while migrations now run to `141_*`.

### 1.4 Auto-sync hook has not actually run (P1)

`graphify-out/GRAPH_REPORT.md:13` — _"Built from commit: `6f832a03`"_, two commits
behind HEAD (`d7740c4`). `graphify-update.log` reports **15341 nodes / 20686 edges**
while `GRAPH_REPORT.md` claims **15396 / 20776** — the two artifacts disagree.
AGENTS.md states the `.husky/post-commit` hook refreshes the graph + REPO_BRAIN after
every commit; the observable state says it is not succeeding (the hook swallows all
failures by design, and `.husky/post-commit:18` relies on `nohup sh`, which is fragile
on Windows contributors). Recommend a CI job that runs `--check` so this cannot rot
silently.

---

## 2. Routing: unreachable handlers and duplicate mounts (P1/P2)

### 2.1 The public current-affairs router never runs

```
app-port5001.js:990   app.use("/api/current-affairs", validateCsrfToken, currentAffairsRoutes);   // (1) api/routes/currentAffairs.js
app-port5001.js:1064  mountExtractedRoutes(app);                                                   // (2) mounts /api/current-affairs -> current-affairs-public.js
```

Express matches in registration order, so (1) always answers `GET /api/current-affairs`.
`currentAffairs.js:14` has its own `router.get('/', ...)`, therefore
`current-affairs-public.js:9` — the handler carrying the **PERF-02 SQL-level filtering
optimisation** ("SQL-level filtering instead of loading all study materials into memory")
— is dead code. The frontend call in `apps/frontend/src/pages/study/CurrentAffairs.jsx:34`
(`GET /api/current-affairs?date=…`) is served by the older, unoptimised handler.

### 2.2 Eight literal routes shadowed by an earlier `/:param` route

Found by scanning every `router.<verb>("/…")` in `api/routes/**` and `modules/**`
(script deleted after use). Confirmed unreachable:

| File                                      | Shadowing route                                | Unreachable route                                          |
| ----------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| `api/routes/currentAffairs.js`            | `GET /:id` (line 59)                           | `GET /categories` (line 177)                               |
| `api/routes/admin-questions.js`           | `POST /questions/:id/predict-difficulty` (812) | `POST /questions/bulk/predict-difficulty` (834)            |
| `modules/search/questionSearch.routes.js` | `POST /index/:questionId` (65)                 | `POST /index/bulk` (74)                                    |
| `modules/search/vectorSearch.routes.js`   | `POST /index/:questionId` (56)                 | `POST /index/batch` (65), `POST /index/all-unindexed` (82) |

Effects: the literal path is parsed as an id, so `id="categories"`/`"bulk"` flows into
`findById(...)` and the caller gets a 404/400 instead of the intended response.
For `currentAffairs.js:59` there is **no escape** — `GET /api/current-affairs/categories`
returns `404 {"error":"Article not found"}`. (No current client calls it, so this is a
latent API-contract bug rather than a user-visible outage.)

**Deliberately mitigated, same pattern** — these look like bugs in a scan but are
correct, because the `/:id` handler forwards:

- `api/routes/doubts.js:111` → `if (id === 'categories') return next()` (line 114)
- `api/routes/studyGroups.js:90` → `if (id === "my" || id === "categories") return next()` (line 93)

Both are still fragile: any future `/<literal>` route added below them needs the same
escape, and the frontend depends on them
(`Community.jsx:107` `/api/doubts/categories`, `:130` `/api/study-groups/categories`,
`:144` `/api/study-groups/my`). A router-level fix (declare literals before params)
removes the trap.

### 2.3 Duplicate mounts and ordering

- **Same router mounted twice:** `api/routes/live-tests-public.js` is imported at
  `app-port5001.js:114`, mounted at `:1025` (`/api/live-tests`), and mounted **again**
  inside `mountExtractedRoutes` (`public-routes-index.js:32`, also `/api/live-tests`)
  — identical router, two registrations.
- **Nested admin path ordered behind its parent:** `app.use("/api/admin/subscriptions", …)`
  at `:997` is registered _after_ `app.use("/api/admin", adminLimiter, adminRoutes)` at
  `:963`. It works only while `adminRoutes` contains no wildcard/catch-all match for
  that path — one added `router.use(...)` in `admin.js` silently kills the whole
  subscriptions-admin surface.
- Duplicate base paths also exist for `/api/exams` (`exam.routes.js` then
  `exams-public.js`) and `/api/current-affairs` (§2.1). Path sets do not currently
  collide for `/api/exams`, but the split is undocumented and order-dependent.
- `public-routes-index.js` mounts `/api/settings` and `/api/site-settings` to the same
  router (intentional alias, worth a comment) and `/api/current-affairs` redundantly.

### 2.4 Dead module: `modules/test-series/`

`apps/backend/src/modules/test-series/` contains `test-series.routes.js`,
`-controller.js`, `-service.js`, `-repository.js`. Nothing outside the directory
imports any of them (`git grep 'test-series.routes'` → no hits; the controller/service
are referenced only by each other). The live test-series API is
`api/routes/test-series-public.js`. Four files of dead code.

### 2.5 Unused imports in the composition root

`app-port5001.js:21` imports `jwt` and `:98` imports `auditRoutes` — both used only on
their import line (verified by occurrence count). `auditRoutes` is not a missing
feature (the audit router is mounted through `admin.js:26`), but the stray import
implies otherwise and will be copy-pasted by the next editor.

---

## 3. Repository hygiene: code that exists but is not in the repo (P1/P2)

### 3.1 `.gitignore` swallows real tests (silently unshipped)

`.gitignore:76` ignores `*.test.js` and only negates `!**/__tests__/**`. Test files in
any _other_ directory are therefore ignored — even though the repo's own convention
(`apps/backend/test/`, `apps/frontend/tests/`) says otherwise. Confirmed via
`git status --porcelain --ignored`:

```
!! apps/backend/test/disposable-emails.test.js
!! apps/backend/test/email-validator.test.js
!! apps/backend/test/storageProvider.test.js
!! apps/frontend/tests/apiClientRefresh.test.js
!! apps/frontend/tests/authPersistence.test.js
```

Five working tests (email validator, disposable-domain rules, storage provider,
apiClient refresh flow, auth persistence) are **not in git, never in a clone,
never in CI**. This is the most dangerous hygiene item here: it looks like coverage
that does not exist.

### 3.2 `.gitignore` swallows tooling referenced by docs and CI

Patterns `run-*.js` (`:74`), `check-*.js`/`check_*.js` (`:71-72`), `fix-*.js` (`:73`),
`run-*.js`, `check-*.mjs` (`:78-79`) match at **any depth**, so `scripts/` is
systematically hidden. 23 ignored files under `scripts/` — including
`scripts/run-database-audit.js` (§1.2) — plus:

```
!! apps/backend/scripts/run-migration-direct.js
!! apps/backend/scripts/run-migration-v4.js
!! apps/backend/scripts/run-concurrent-migration.js
!! scripts/check-*.mjs / check-*.js  (many)
!! scripts/fix-*.js
```

Committed scripts use other prefixes (`scripts/audit-*.mjs`, `scripts/inspect-*.js`,
`scripts/dry-run-reindex.mjs`), which is exactly why the rule bites quietly:
a contributor's new `check-foo.mjs` / `run-bar.js` / `fix-baz.js` vanishes from
`git status` with no warning.

### 3.3 Typechecking is not wired up at all

`frontend-typecheck.log` and `admin-typecheck.log` (tracked-adjacent, root level)
contain only:

```
'tsc' is not recognized as an internal or external command
[ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL] Command "tsc" not found
```

No workspace defines a `typecheck` script (`apps/*/package.json` have
`dev/build/lint/test/clean` only), `typescript` is not a dependency of any workspace,
yet a root `tsconfig.json` exists and `@types/react`/`@types/react-dom` are installed.
These logs are stale evidence of a command that cannot succeed.

### 3.4 Test runners that can pass with zero tests

- `apps/backend/package.json` → `test: node --experimental-vm-modules …/jest.js --passWithNoTests`
  → a misconfigured `testMatch` or a renamed directory yields a **green** CI job with
  no tests executed.
- `apps/backend/test/*.test.js` (§3.1) are outside `src/__tests__/`; if jest's
  config ever relied on that folder, those tests would be silently skipped as well.

### 3.5 Backend `env-validation.mjs` never runs

`apps/backend/src/utils/env-validation.mjs` self-describes as
_"HIGH-10 FIX: Startup env validation script"_, enforces
`REQUIRED_VARS = ['DATABASE_URL','JWT_SECRET','DB_ENCRYPTION_KEY','FRONTEND_URL']`
plus JWT/DB-key length ≥ 32, and loads `apps/backend/.env` itself. **Nothing imports
it** — the only `env-validation` references in the repo are the frontend/admin Vite
copies (`apps/frontend/src/shared/lib/env-validation.js`,
`apps/admin-panel/src/shared/lib/env-validation.js`) and docs. So the backend boots
with a weak/short `JWT_SECRET` or a missing `DB_ENCRYPTION_KEY` until something fails
at request time.

### 3.6 `.env.example` no longer describes the app (P2)

Diffing `process.env.<KEY>` usage in `apps/backend/src` against `.env.example` yields
**~95 keys used in code but absent from the example**, including the ones that matter
most for a fresh setup:

```
DB_ENCRYPTION_KEY   (required by env-validation.mjs)
DATABASE_READ_URL   (read-pool split documented in README/AGENTS)
CSRF_PEPPER / CSRF_HMAC_PEPPER
ADMIN_API_KEY, ALLOWED_ADMIN_IPS, ALLOWED_ORIGINS, ADMIN_PANEL_URL
JWT_2FA_SECRET, JWT_RESET_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN
OPENROUTER_API_KEY / AI_* (entire AI gateway block)
RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET
GOOGLE_CLIENT_ID, PGCRYPTO_KEY, SENDGRID_API_KEY, TWILIO_*, COOKIE_* , SESSION_* …
```

A contributor following `.env.example` therefore gets a backend that starts but has
payment/AI/2FA paths misconfigured at runtime rather than at boot.

---

## 4. Security observations (P1/P2)

Nothing here is a new "secrets committed today" emergency — the known 2026-06-15
incident is already documented in `docs/SECURITY_POSTURE.md` / `REMEDIATION_PLAN.md`.
These are additional hardening gaps found during this pass.

### 4.1 `apps/backend/.env` is still retrievable from git history (P1, known-open)

```
$ git log --all --oneline -- apps/backend/.env
1c1f675 feat: complete platform hardening, admin enhancements, session security, and shared utilities
abf91cd Initial full commit - all project files (excluding node_modules)
$ Test-Path apps/backend/.env
True
```

The file is untracked today (the pre-commit hook + `no-env.yml` guard work), but
the two historical blobs still hold `DATABASE_URL`, `JWT_SECRET`,
`JWT_REFRESH_SECRET` and Razorpay keys. Per `docs/REMEDIATION_PLAN.md` Phases 0/2.1,
rotation **and** a `git filter-repo` scrub remain outstanding — until the scrub lands,
any clone of this repo has DB + JWT-forgery credentials.

### 4.2 Admin API key compared with `===` (non-constant-time)

```js
// middleware/origin.middleware.js:328-333
export const validateAdminApiKey = (req, res, next) => {
  const configuredKey = process.env.ADMIN_API_KEY;
  if (!configuredKey) return next();            // whole layer skipped when unset
  const provided = req.headers["x-admin-api-key"];
  if (provided && provided === configuredKey) return next();
```

`===` on secrets is a timing side-channel; use
`crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))` guarded by an equal-length
check (and log/fail loudly when `ADMIN_API_KEY` is unset in production instead of
silently disabling the layer).

### 4.3 `jwt.verify()` without an `algorithms` allow-list (10 sites)

```
middleware/auth.middleware.js:472, :759, :852
middleware/maintenance.middleware.js:51
infrastructure/websocket/websocketManager.js:215
api/routes/fortspy.js:192
modules/auth/auth.controller.js:1027, :1365, :1566, :1863
```

None pass `{ algorithms: ["HS256"] }`. jsonwebtoken's current versions default
safely, but pinning the algorithm is the standard hardening step and prevents
regressions if a key type is ever migrated (e.g. RSA introduced for OAuth).

### 4.4 Access + refresh tokens in `localStorage` / `sessionStorage`

`apps/admin-panel/src/shared/lib/apiClient.js:41-44`, `:145-148`, `:169-181` read and
write `trstprep_token` / `trstprep_refresh_token` from `sessionStorage` **then**
`localStorage`, while the backend already issues httpOnly cookies
(`setAuthCookies`) with a CSRF double-submit flow. Dual storage doubles the logout
surface (both must be cleared) and makes any XSS a full token exfiltration. If the
cookie path is the intended one, the storage fallback should be dev-only or removed.

### 4.5 Dynamic SQL identifier interpolation in admin routes

Parameterised values are used consistently, but identifiers/columns are interpolated
from request-derived data at:

```
api/routes/admin-dynamic-content.js:147   `SELECT ${cols} FROM ${table} WHERE ${conditions...}`
api/routes/admin-backups.js:234           `INSERT INTO "${tableName}" (...) VALUES (...)`
api/routes/admin-recycle-bin.js:182       `DELETE FROM "${table}" WHERE is_deleted = true`
api/routes/admin-categories.js:39         `SELECT ... FROM "${catTable}" ...`
api/routes/admin-sections.js:757          `UPDATE "${tableName}" SET section_id = $1 ...`
api/routes/admin-email-templates.js:276   `UPDATE email_templates SET ${updates.join(', ')} ...`
api/routes/admin-tests.js:1252/1274/1331  `INSERT INTO tests (${colList}) SELECT ${selectCols} ...`
```

These need an explicit allow-list (`ALLOWED_TABLES`/`ALLOWED_COLUMNS`) before
interpolation — otherwise a crafted `table`/`colList` value becomes second-order SQL
injection. Worth confirming each site validates against a static list.

### 4.6 Guessable IDs in security-adjacent services

`Math.random()`-derived identifiers at
`services/SessionCaptureService.js:358` (`sess_…`),
`services/core/liveProctoringConsoleService.js:155` (`intv_…` incident id),
`services/core/studyMatchmakerService.js:108` (`duel_…` id), plus email/event job ids.
Not exploitable on its own (no auth is derived from them) but proctoring-incident and
session row ids are better generated with `crypto.randomUUID()`.

### 4.7 Logging: `console.*` in request paths

`git grep -c 'console\.(log|error|warn)\(' apps/backend/src` shows ~300 calls outside
the pino `logger` (`postgres-helpers.js` 40, `api/routes/practice.js` 36,
`middleware/auth.middleware.js` 19, `api/routes/payments.js` 13, …). Console output
bypasses the logger's redaction/level config, which matters for DPDP-era PII hygiene
and for log-volume control in production.

---

## 5. Docs / data drift (P2/P3)

1. **AGENTS.md migration guidance is wrong.** AGENTS.md:75 says
   _"140 … — next file is `141_*`"_, but `141_subject_videos_fortspy.sql` already
   exists in `apps/backend/src/infrastructure/database/migrations/`. An agent
   following the rule creates a second `141_*` file, which trips both the stated
   "unique prefixes" convention and `data-guard.yml`'s duplicate-prefix gate.
   `docs/REPO_BRAIN.html:1193` is further behind again ("migration files 130",
   "sequence currently reaches migration 129").
2. **`docs/REPO_BRAIN.html` head/graph spans are stale** (§1.3) — `6f832a03` vs
   `d7740c4`, plus 6 spans reported stale by the repo's own checker.
3. **Root-level build/log artifacts**: `admin-lint.log`, `backend-lint.log`,
   `frontend-lint.log` (34 KB), `db-audit.log`, `graphify-update.log`,
   `frontend-typecheck.log`, `admin-typecheck.log`, `backend-typecheck.log`
   sit in the working tree (ignored by `*.log`, so harmless to git but they mislead
   `ls`-based inspection and are stale).
4. **Heavy committed artifacts**: `database_schema_dictionary.md` (399 KB) and
   ~1.2 MB of audit JSON under `scripts/` (`full_db_schema_dictionary.json` 370 KB,
   `parsed_syllabus_tree.json` 491 KB, `tests_by_name_order.json` 153 KB,
   `full_db_missing_data_audit.json` 106 KB, `proposed_id_mapping.json` 87 KB).
   Generated dumps in VCS bloat clones and drift instantly. Move to `docs/artifacts/`
   with a regeneration script, or ignore them.
5. **Duplicated components across apps** (from the repo's own `graphify-out` dupscan,
   11 identical-content groups): `HorizontalScroll.jsx`, `Logo.jsx`, `ScrollToTop.jsx`,
   `EmptyState.jsx`, `shared/config/{assetConfig,index}.js`, `test/setup.js` are
   byte-identical in `apps/frontend` and `apps/admin-panel`; `ThemeContext.jsx` is
   duplicated in `apps/frontend/src/shared/context/` and `packages/shared-hooks/`.
   The two `packages/*` workspaces exist precisely to hold these.
6. **Lint is warning-only and never fails the build.** `frontend-lint.log` contains
   60+ `no-unused-vars` warnings and 0 errors — e.g. `Community.jsx` defines
   `refetchDoubts`/`refetchGroups` and never calls them; `ExamReadinessGauge.jsx`
   imports 7 unused icons; `ProfileSecurityTab.jsx` imports an unused `ToggleSwitch`.
   `lint-staged` runs only `prettier --write`, so none of this is ever surfaced.
7. **Supply-chain pinning is inconsistent.** `ci.yml` pins every third-party action to
   a commit SHA (H29), but `data-guard.yml:15` and `no-env.yml:14` use floating
   `actions/checkout@v4`. Same guarantee should apply to all workflows.
8. **Overlapping security gates.** `security.yml` re-runs `pnpm run lint` (already a
   `ci.yml` job) and adds `pnpm audit --audit-level=moderate`, which fails the workflow
   on _moderate_ advisories — a policy that will block unrelated PRs and duplicates
   Trivy/CodeQL coverage.

---

## 6. Recommended fix order

1. **Un-red CI** (all P0): fix `data-guard.yml` (use `require('./' + f)` or
   `JSON.parse(readFileSync(...))`); give `000a_*` / `056a_*` / `056b_*` unique
   3-digit prefixes _or_ relax the prefix normaliser; scope the PII grep to exclude
   `scripts/*schema_dictionary*.json` and `apps/backend/src/data/collections/**`.
2. **Fix `ci.yml` → `test-migrations`**: point at a real entry point
   (`migrationRunner.js` exports `runMigrations(pool, { afterMigrations })`) and
   `git add -f scripts/run-database-audit.js` (or rename it out of the `run-*` rule).
3. **Fix `.gitignore`** (highest silent-damage item): drop the generic `*.test.js` /
   `run-*.js` / `check-*.js` / `fix-*.js` rules, add `!apps/*/test/**` +
   `!apps/*/tests/**`, then commit the 5 orphaned tests and the 23 ignored scripts.
4. **Routing**: mount `current-affairs-public.js` before `currentAffairs.js` (or delete
   the duplicate `GET /` in `currentAffairs.js`); hoist literal routes above `/:param`
   routes in `currentAffairs.js`, `admin-questions.js`, `questionSearch.routes.js`,
   `vectorSearch.routes.js`; remove the duplicate `/api/live-tests` mount; delete
   `modules/test-series/` if it is truly superseded.
5. **Re-arm the guards that exist but do nothing**: import
   `apps/backend/src/utils/env-validation.mjs` before `listen()` in
   `app-port5001.js`; add a `sync-repo-brain --check` CI step; drop
   `--passWithNoTests`; reconcile `.env.example` with the ~95 missing keys.
6. **Security hardening** (§4.2-4.7): timing-safe admin-key compare, `algorithms`
   allow-list on `jwt.verify`, decide localStorage-vs-cookie token strategy, add
   table/column allow-lists to the eight dynamic-SQL sites, and migrate `console.*`
   to the pino logger.
7. **Docs**: correct the AGENTS.md "next migration is 141" line; run
   `node scripts/sync-repo-brain.mjs` to refresh `REPO_BRAIN.html`.

---

## 7. What is genuinely healthy (for balance)

- Secrets hygiene at the _tracking_ layer works: `no-env.yml`, the husky pre-commit
  `.env` block, and the untracked `apps/backend/.env` confirm no live secret is
  currently committed, and no secret _values_ were found in tracked source. A
  repo-wide scan for the guard's own patterns (`rzp_live_*`, `AKIA*`,
  `-----BEGIN … PRIVATE KEY-----`, `sk-live-*`) returns only two hits, both legitimate:
  fake placeholders in `apps/backend/src/__tests__/settingsService.test.js:91-125`
  (`"rzp_live_key_id"`) and prose in
  `docs/SECURITY_CREDENTIAL_ROTATION_AND_DPDP_RUNBOOK.md` — which is exactly why the
  `data-guard.yml`/`no-env.yml` scans exclude tests and docs.
- `ci.yml` pins third-party actions by SHA and runs CodeQL + Semgrep + Trivy.
- Error responses consistently use `sanitizeErrorMessage(...)`; parameterised SQL is
  the norm (interpolation is confined to identifiers, §4.5).
- 71 tracked backend tests in `src/__tests__/` and 22 in `apps/frontend/src/__tests__/`;
  lint across all three apps currently reports **0 errors**.
- The two uncommitted working-tree changes are legitimate robustness fixes (idempotent
  `PostgresHelpers.close()` with pool de-duplication, and a re-entrant
  `gracefulShutdown()` guard) — they should be committed rather than left dangling.
