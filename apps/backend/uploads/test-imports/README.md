# Test Imports Directory

Storage area for full-test JSON files (with nested sections and questions) being
imported into the platform. The deeper hierarchy is **not hardcoded** — it is
created dynamically at runtime by the importer, using slugs resolved from the
database taxonomy tables.

## Top-Level Layout (static)

```
test-imports/
├── inbox/        New uploads awaiting review/validation
├── staging/      Validated, ready to commit to the database
├── imported/     Successfully imported (retained for audit trail)
├── failed/       Failed validation or import (with sibling .error.log)
├── archive/      Deprecated/retired test files
└── logs/         Import activity logs, partitioned by date
```

These six status folders are the only static parts of the layout. Everything
below them is created on demand by the import service.

## Deeper Hierarchy (dynamic, built from DB)

When a JSON file is accepted, the importer reads the file's taxonomy fields
and resolves them against the database. The resolved slugs (NOT the input
strings) are used to build the path:

```
{status}/{examCategorySlug}/{examSlug}/{stageSlug}/{testCategorySlug}/{testType}/{testSeriesSlug}/{year}/
```

| Folder Level | Source in JSON | Resolved From DB Table      | Example Value           |
|--------------|----------------|------------------------------|-------------------------|
| `status`     | (lifecycle)    | (fixed)                      | `inbox`                 |
| L1           | `examCategoryId` | `exam_categories.slug`     | `ssc`                   |
| L2           | `examId`         | `exams.slug`               | `ssc-cgl`               |
| L3           | `stageId`        | `stages.slug`              | `tier-1`                |
| L4           | `categoryId`     | `test_categories.slug`     | `mock-test`             |
| L5           | `testType`       | `test_types.slug`          | `full-length`           |
| L6           | `testSeriesId`   | `test_series.slug`         | `ssc-cgl-tier-1-2026`   |
| L7           | `pyqYear` or extracted from `testSeriesId`/`title` | numeric | `2026` |

### Concrete Example

For `SSC_CGL_Tier_I_2026_Free_Mock_Test.json`:

```
inbox/ssc/ssc-cgl/tier-1/mock-test/full-length/ssc-cgl-tier-1-2026/2026/SSC_CGL_Tier_I_2026_Free_Mock_Test.json
```

## Slug Resolution

The importer performs lookups via `dbHelpers.findBy()` against these tables:

1. `exam_categories` where `slug = $json.examCategoryId`
2. `exams` where `slug = $json.examId AND exam_category_id = <resolved>`
3. `stages` where `slug = $json.stageId AND exam_id = <resolved>`
4. `test_categories` where `slug = $json.categoryId`
5. `test_series` where `slug = <slugified $json.testSeriesId> AND stage_id = <resolved>`

If any lookup fails, the file is moved to `failed/` and a sibling
`.error.log` is written describing the unresolved identifier.

## File Lifecycle

```
upload  → inbox/    (raw, untouched)
review  → staging/  (validated, schema OK, FKs resolved)
commit  → imported/ (rows inserted into tests / test_sections / questions)
error   → failed/   (kept for diagnosis, with .error.log)
retire  → archive/  (soft-retired; retained for historical reference)
```

Each transition is logged to `logs/YYYY/MM/DD/import-<timestamp>.log`.

## Year Extraction

The `year` segment is derived in this order of precedence:

1. `json.isPyq === true` → use `json.pyqYear`
2. `json.testSeriesId` contains a 4-digit year → extract it
3. `json.title` contains a 4-digit year → extract it
4. Fallback: `unknown`

## Why No Hardcoded Folders?

The exam taxonomy is managed entirely through the admin panel:

- New exam categories, exams, stages, and test series can be added at any time.
- Renaming a slug must not require touching this directory structure.
- The hierarchy under each status folder is a **mirror of the live DB**,
  not a static template.

Hardcoding `ssc/`, `railway/`, etc. here would create a maintenance trap and
a divergence between filesystem and database.

## Security

- Files in `inbox/` are untrusted input — never symlink-follow, never execute.
- File size is capped at 50 MB per upload.
- MIME type must be `application/json`.
- Filenames are sanitized: only `[A-Za-z0-9._-]` are allowed.
- All path construction uses `path.join()` — never string concatenation.
