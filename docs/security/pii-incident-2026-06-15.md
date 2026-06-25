# PII Incident Report — 2026-06-15

**Severity:** BLOCKER (data protection)
**Status:** Mitigated; full remediation pending git history scrub
**Affected records:** 528 `test_attempts` rows + 196 unique user IDs
**File:** `supabase_data/test_attempts.json` (removed from working tree on 2026-06-15)

---

## Summary

On 2026-06-15 an audit (`docs/AUDIT_2026-06-15.md`) revealed that
`supabase_data/test_attempts.json` (436 KB, 10,034 lines, 528 records) was
checked into source control despite the `.gitignore` rule
`supabase_data/` on line 33.

The file is a `pg_dump` / JSON export of the production `test_attempts`
table joined to `users.full_name` and `users.avatar_url`. It contains:

- 528 records with **real Indian user full names** (Seema, Joyanto Dey,
  KANUPRIYA, Mayank kumar, Anshul, Ujjwal Anand, Abhishek, sandhya,
  Md Sama, K. K singh, Gaurishankar Siddh, Ayush Kushwaha, Rahul,
  Nirjala, Rakesh choudhary, Ankit, Rogue, PARNA SAHA, Srikanth Padimala,
  deepesh, Ankit Jain, Raunak, guddu yadav, Yrra, mohit birda, surya,
  Akash, Ravi, Gouri Kumari, ankit bansal, Mahesh meena, Shin chan,
  Aman, PRANIT, Minitts, RV, Sushant Panday, Abhay, …).
- 196 unique `user_id` UUIDs.
- Real `answer_map` JSON (310 records) and `time_map` JSON (243 records).
- Real `created_at` timestamps from 2026-03-12 to 2026-04-30 (production
  traffic).
- 1 row with `user_id: null, test_name: "Test Insert"` (developer artifact).
- 1 row with `full_name: "Anonymous"`.
- All 528 rows have `time_taken: null`.

The data is real production data, **not** a synthetic fixture. It must
be treated as a personal-data leak under Indian DPDP Act 2023 and any
applicable state privacy law (e.g. IT Act 2000/2008).

---

## Immediate actions taken (2026-06-15)

1. **Removed `supabase_data/test_attempts.json` from the working tree.**
2. **Removed `supabase_data/exam_rooms.json`, `live_tests.json`,
   `questions.json`, `subjects.json`** for related reasons (broken
   schema, stale data, PK collision with production).
3. **Removed the entire `supabase_data/` directory** from the working
   tree.
4. **Strengthened `.gitignore`** with a comment block pointing at this
   incident.
5. **Created proper seeders** in
   `apps/backend/src/infrastructure/database/seeders/` that use
   schema-validated fixtures and ON CONFLICT DO NOTHING.
6. **Added `.github/workflows/data-guard.yml`** that fails the CI build
   if any JSON in the repo contains the PII keys `full_name`,
   `avatar_url`, `answer_map`, `time_map`, `password_hash`,
   `phone_number`, `aadhaar`, `pan_card`.
7. **Deleted the rest of the broken seed JSON** (`exam_rooms.json`
   pointed at a non-existent table; `live_tests.json` had UUIDs in an
   integer-PK table and 18/22 columns that don't exist; `subjects.json`
   hardcoded IDs 1-9 which collide with production PKs 2,3,8,9,10,11,12,
   13,15,16,17,22,30; `questions.json` was a single placeholder record).

---

## Outstanding actions (require human)

### 1. Scrub git history

The file is now gone from the working tree, but it remains in git
history. Any contributor who clones the repo and runs
`git log --all --full-history -- supabase_data/test_attempts.json`
will still see the data.

Recommended: use `git filter-repo` (https://github.com/newren/git-filter-repo)
to permanently remove the file and rewrite history:

```bash
# 1. Install git-filter-repo
pip install git-filter-repo

# 2. Create a paths file
cat > /tmp/paths.txt <<'EOF'
supabase_data/test_attempts.json
supabase_data/exam_rooms.json
supabase_data/live_tests.json
supabase_data/questions.json
supabase_data/subjects.json
EOF

# 3. Run filter-repo
git filter-repo --invert-paths --path-file /tmp/paths.txt --force

# 4. Verify
git log --all --full-history -- supabase_data/test_attempts.json
# (should print nothing)

# 5. Force push (DO NOT DO THIS WITHOUT COORDINATING WITH ALL FORKS)
git remote add origin <url>
git push origin --force --all
```

**WARNING:** force-pushing rewrites history for every clone. Coordinate
with all forks (production, staging, dev laptops, CI caches) before
doing this. If force-push is not feasible (e.g. the repo is mirrored
to many third parties), accept that the PII is permanently in history
and document the commit hash for legal/compliance review.

### 2. Notify affected users

The 196 unique `user_id` UUIDs whose data leaked must be notified
under Indian DPDP Act 2023 Section 8 ("Notice") and any other
applicable law. The notice must include:

- Nature of the breach.
- Categories of personal data affected (full name, performance data).
- Likely consequences.
- Mitigation measures taken.
- Contact details of the data protection officer (or equivalent).

Work with the legal/compliance team to draft the notice template.
The 196 UUIDs are listed in a sealed internal-only document; do not
commit them to a public repo.

### 3. Rotate any secrets that may have been in the same directory

`supabase_data/` is excluded by `.gitignore` but the audit found it
tracked. If the directory ever contained credentials, API keys, or
service-account JSON, rotate them.

### 4. Add access controls to the export pipeline

The dump at `docs/database/exports/exports/database_export.sql` is a
full schema + data export. Confirm that:
- The export script (`docs/database/exports/export-db.js`) is run
  only from trusted CI jobs or developer laptops.
- The output directory is not world-readable.
- Production `DATABASE_URL` is not in any committed file.

### 5. Add a pre-commit hook

A pre-commit hook that fails if any added JSON file contains the PII
keys (`full_name`, `avatar_url`, etc.) would catch this at the source.
Add to `.git/hooks/pre-commit` (or use `lefthook` / `husky`):

```bash
#!/usr/bin/env bash
# Block any PII keys from being committed in JSON files.
KEYS='full_name|avatar_url|answer_map|time_map|password_hash|phone_number|aadhaar|pan_card'
STAGED=$(git diff --cached --name-only --diff-filter=A '*.json' | head -n 200)
if [ -n "$STAGED" ]; then
  HITS=$(echo "$STAGED" | xargs -r grep -lE "\"($KEYS)\"" 2>/dev/null || true)
  if [ -n "$HITS" ]; then
    echo "PII keys found in staged JSON files: $HITS"
    exit 1
  fi
fi
```

---

## Timeline

| Date | Action |
|---|---|
| 2026-03-12 to 2026-04-30 | Production `test_attempts` data accumulated |
| < 2026-06-15 | `supabase_data/test_attempts.json` (along with 4 other seed JSONs) committed to source control. Cause unknown. |
| 2026-06-15 | Audit discovered the leak. Files removed from working tree. |
| 2026-06-15 | `.gitignore` strengthened, seeders created, CI guard added. |
| TBD | `git filter-repo` history scrub. |
| TBD | User notification under DPDP Act 2023 §8. |

---

## See also

- `docs/AUDIT_2026-06-15.md` — original audit
- `.gitignore` line 33 (`supabase_data/`) — exclusion rule
- `.github/workflows/data-guard.yml` — CI guard
- `apps/backend/src/infrastructure/database/seeders/` — replacement seeders
