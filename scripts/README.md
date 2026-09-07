# Trstprep Maintenance Scripts

> As of 2026-09-06. `scripts/` holds 108 files. All invocations below run
> from the **repo root**. There is no `seed-admin.js` in this directory, no
> `src/scripts/` indirection, and no `npm --prefix apps/backend run seed`
> wiring — ignore any doc that claims otherwise.

## Admin account

| Script           | Purpose                                                                                                            | Env                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reset-admin.js` | Upserts the admin user (update if exists, else create) with a strong random password, or a fixed one when provided | `ADMIN_EMAIL` (default `admin@trstprep.com`), `ADMIN_PASSWORD` / `ADMIN_DEFAULT_PASSWORD` (fixed password override), `ADMIN_ROLE` (default `admin`) |
| `debug-user.js`  | Read-only check of the admin row + optional password verification. Never prints hashes                             | `ADMIN_DEFAULT_PASSWORD` (password to test; without it, prints a hint instead of testing)                                                           |

```bash
node scripts/reset-admin.js
ADMIN_EMAIL=ops@example.com ADMIN_DEFAULT_PASSWORD=ChangeMe123! node scripts/reset-admin.js
node scripts/debug-user.js
```

## Database audit (mandatory gate)

```bash
node scripts/run-database-audit.js
```

Run before ANY migration, DDL change, or schema assumption. (A backend copy
exists at `apps/backend/scripts/run-database-audit.js`; the repo-root copy
above is canonical for operators.)

## Seeders (no `SeedService.js` — use this)

There is no `SeedService.js` class. Seeding entry point is
`apps/backend/src/infrastructure/database/seeders/index.js` (`runSeeders`),
idempotent via upserts, order: subjects → tests → questions → live_tests →
exam_rooms → app_settings (parents before children for FKs). Runs migrations
first by default.

```bash
node apps/backend/src/infrastructure/database/seeders/index.js
```

## Audit / integrity / inspection tooling

- **Table/data audits:** `audit-all-tables-missing-data.mjs`,
  `audit-all-questions.mjs`, `full_db_missing_data_audit.json`
  (generated output), `check-table-counts.mjs`, `list-all-tables*.mjs`,
  `list-db-duplicates.js`, `reconcile-duplicates.js`.
- **Schema checks:** `check-questions-schema.mjs`, `check-tests-schema.mjs`,
  `check-marks-sync.mjs`, `sync-test-questions-marks.mjs`,
  `check-taxonomy-integrity.mjs`, `check-taxonomy-fks.mjs`,
  `inspect-*-fks.js`, `inspect-unique-constraints.js`, `validate-routes.js`.
- **Mock-data cleanup:** `check-db-mock-data.mjs`,
  `fix-database-mock-data.mjs`, `verify-mock-cleanup.mjs`,
  `find-mock-hardcoded-data.mjs`, `deep-scan-hardcoded.mjs`,
  `check-frontend-data-sources.mjs`, `verify-real-services.mjs`.
- **One-shot inspectors:** `inspect-db-ids.js`, `inspect-public-ids.js`,
  `inspect-user-attempts.js`, `query-stages.js`, `query-tests-order.mjs`,
  `list-users.mjs`, `export-db.js`, `dump-subjects-units.js`.

## Taxonomy / syllabus tooling

`apply-cascade-taxonomy.mjs`, `fix-cascade-nulls.js`,
`fix-deep-cascade-nulls*.js`, `audit-cascade-nulls.js`,
`show-full-taxonomy.mjs`, `import-syllabus.js`, `parse_master_syllabus.js`,
`build_syllabus_brain.py`, `generate_taxonomy_html.py`,
`inspect-syllabus-tables.js`, `test-chrono-pyp.mjs`.

## Dev / build / verify

`dev-sequential.mjs`, `build.mjs`, `wait-for-backend.mjs`,
`validate-routes.js`, `verify-reindex-results.mjs`,
`execute-reindex-tests.mjs`, `dry-run-reindex.mjs`, `verify-updated-exams.mjs`,
`sync-repo-brain.mjs`, `organize-docs.mjs`, `opencode-usage.mjs`,
`load-test-telemetry.js`, `scale.sh`, `test-query.js`.

## Document-parsing experiments (Python, `uv`-managed)

`chunk_files.py`, `extract_ast.py`, `get_noncode.py`, `write_ast.py`,
`test_docling.py`, `test_extract.py`, `test_marker.py`,
`split_languages.cjs`, `format-schema-artifact.mjs`,
`generate-schema-dictionary.mjs`.

## Environment variables

- `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_DEFAULT_PASSWORD` / `ADMIN_ROLE`
  — admin account scripts (above).
- `DATABASE_URL` — required by anything touching Postgres (audit, seeders,
  inspectors, fix scripts).
- `PGCRYPTO_KEY` — required by `reset-admin.js` session (`app.pgcrypto_key`).

## Security

- Keep these scripts out of production web-accessible directories.
- Never commit or log secret values; `debug-user.js` never prints hashes.
- Data-mutating scripts (`fix-*`, `backfill-*`, `reconcile-*`,
  `clean-stale-paused-attempts.js`) are one-shot tools — review before
  running, prefer dry-run variants where available.
