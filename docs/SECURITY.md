# Security

Security incidents, PII breach records, and secret rotation runbook for Trstprep V2.1.

---


## PII Incident Report (2026-06-15)

*Source: `docs/security/pii-incident-2026-06-15.md`*

## PII Incident Report — 2026-06-15

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
## 1. Install git-filter-repo
pip install git-filter-repo

## 2. Create a paths file
cat > /tmp/paths.txt <<'EOF'
supabase_data/test_attempts.json
supabase_data/exam_rooms.json
supabase_data/live_tests.json
supabase_data/questions.json
supabase_data/subjects.json
EOF

## 3. Run filter-repo
git filter-repo --invert-paths --path-file /tmp/paths.txt --force

## 4. Verify
git log --all --full-history -- supabase_data/test_attempts.json
## (should print nothing)

## 5. Force push (DO NOT DO THIS WITHOUT COORDINATING WITH ALL FORKS)
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
## Block any PII keys from being committed in JSON files.
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

---


## Security Incident (2026-06-14)

*Source: `docs/SECURITY_INCIDENT_2026-06-14.md`*

## Security Incident — 2026-06-14

## Summary
Production secrets were accidentally committed to `apps/backend/.env` in the git repository. The `.env` file contains real Supabase DATABASE_URL with password, JWT_SECRET, JWT_REFRESH_SECRET, and Razorpay keys.

## Severity
**CRITICAL** — Anyone with read access to the repository can:
1. Connect to the production database directly
2. Forge valid JWTs for any user
3. Verify or impersonate Razorpay webhooks

## Affected secrets
- `DATABASE_URL` (Supabase)
- `JWT_SECRET` 
- `JWT_REFRESH_SECRET`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- (any other keys present in the .env)

## Immediate actions (do BEFORE deploy)

### 1. Rotate Supabase database password
- Supabase Dashboard → Project → Settings → Database
- Click "Reset Database Password" or generate new password
- Update `DATABASE_URL` in your secret manager

### 2. Rotate JWT secrets
Generate two new 64-character hex strings:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Use one for `JWT_SECRET` and one for `JWT_REFRESH_SECRET`.
Note: This invalidates ALL user sessions. Users will need to log in again.

### 3. Rotate Razorpay webhook secret
- Razorpay Dashboard → Settings → Webhooks → Edit → Regenerate secret
- Update `RAZORPAY_WEBHOOK_SECRET`

### 4. Scrub git history
Using git-filter-repo (recommended):
```bash
pip install git-filter-repo
git filter-repo --invert-paths --path apps/backend/.env
git push --force --all
git push --force --tags
```

Or using BFG Repo-Cleaner:
```bash
brew install bfg
bfg --delete-files apps/backend/.env
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force --all
```

### 5. Notify the team
All team members must:
- Pull the new code (with scrubbed history)
- Re-clone if they have local clones
- Re-install dependencies
- Never commit .env files again

### 6. Add CI protection
Add a `.github/workflows/no-env.yml` (or similar):
```yaml
name: No env files
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check for .env
        run: |
          if git ls-files | grep -E '\.env$|\.env\.'; then
            echo "ERROR: .env file is tracked by git"
            exit 1
          fi
```

Or add a pre-commit hook to `.git/hooks/pre-commit`:
```bash
#!/bin/sh
if git diff --cached --name-only | grep -E '^\.env$|\.env\.'; then
  echo "ERROR: Attempting to commit .env file. Aborting."
  exit 1
fi
```

## Verification
After all steps:
```bash
## Should return nothing
git log --all --full-history -- apps/backend/.env

## Should be ignored
git check-ignore -v apps/backend/.env
```

## Lessons learned
- Always use a `.env.example` template with placeholders
- Never commit `.env` even temporarily
- Use a secret manager (AWS Secrets Manager, 1Password, Doppler) for shared secrets
- Add CI checks before any PR can be merged
- Rotate secrets on a regular schedule (every 90 days)

---


## Secret Rotation Runbook

*Source: `docs/SECRET_ROTATION_RUNBOOK_2026-06-15.md`*

## Pre-Deployment Manual Action Required: Secret Rotation

**Date:** 2026-06-15
**Priority:** CRITICAL — must complete before production launch
**Status:** Pending human action

---

## Why this cannot be automated

The leaked credentials in `apps/backend/.env` belong to live external services
(Supabase, Razorpay) and an account-level JWT secret. Rotating them requires
login to each provider's dashboard. **No code change can fix this** — only
manual action.

The `.env` file is **already gitignored** correctly (`.gitignore:12-16`), so the
code-side exposure is now contained. The remaining risk is that anyone who
has read the file before this PR is merged can still use the secrets. **The
secrets must be considered compromised and rotated.**

---

## Step 1 — Rotate Supabase database password (10 min)

1. Open Supabase dashboard: https://supabase.com/dashboard
2. Project → Settings → Database
3. Click **"Reset Database Password"** (or **"Generate new password"**)
4. Copy the new connection string
5. **Save the new password** in your password manager (1Password / Bitwarden / etc.)
6. Update your local `apps/backend/.env`:
   ```
   DATABASE_URL=postgresql://postgres:<NEW_PASSWORD>@db.ylcvaxqsxqygafkpmrtf.supabase.co:5432/postgres
   ```
7. Verify the new password works:
   ```bash
   cd apps/backend
   node -e "import('dotenv/config').then(async () => { const { pool } = await import('./src/infrastructure/database/postgres-helpers.js'); const r = await pool.query('SELECT NOW()'); console.log('DB OK:', r.rows[0].now); await pool.end(); })"
   ```
8. If the backend has been deployed anywhere (staging / prod), redeploy with the new env var.

## Step 2 — Rotate JWT secrets (5 min)

Generate two new 64-character hex strings:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use the FIRST for `JWT_SECRET`, the SECOND for `JWT_REFRESH_SECRET`. **They must be different.**

Update `apps/backend/.env`:
```
JWT_SECRET=<first-new-64-char-hex>
JWT_REFRESH_SECRET=<second-new-64-char-hex>
```

**⚠️ This invalidates ALL existing user sessions.** Users will be logged out and must sign in again. This is expected and safer than leaving compromised secrets in place.

## Step 3 — Rotate Razorpay webhook secret (5 min)

1. Open Razorpay dashboard: https://dashboard.razorpay.com
2. Settings → Webhooks → click your webhook → Edit
3. **Regenerate secret**
4. Copy the new secret
5. Update `apps/backend/.env`:
   ```
   RAZORPAY_WEBHOOK_SECRET=<new-razorpay-webhook-secret>
   ```
6. Verify the new secret works by replaying a test webhook (or by checking the next live webhook delivery for a 200 response).

## Step 4 — Rotate Razorpay API keys (optional but recommended)

If you suspect the `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` were also
exposed (they appear in `.env` as well — see `apps/backend/.env:18-19` if
present), regenerate them in the Razorpay dashboard:

1. Settings → API Keys → Regenerate Key
2. Save the new key + secret in your password manager
3. Update `.env`:
   ```
   RAZORPAY_KEY_ID=<new-key-id>
   RAZORPAY_KEY_SECRET=<new-key-secret>
   ```
4. Re-deploy the backend.

## Step 5 — Scrub git history (30 min)

Even though `.env` is now gitignored, the **old commits** still contain the
secrets in the working tree. This is mostly a defense-in-depth step since the
file is only in your local clone, but if the repo is hosted on a public
Git remote, the history is exposed.

Using **git-filter-repo** (recommended):

```bash
pip install git-filter-repo
cd E:\Tech\Testprep\Trstprep V2.1
git filter-repo --invert-paths --path apps/backend/.env
git push --force --all
git push --force --tags
```

Using **BFG Repo-Cleaner** (alternative):

```bash
brew install bfg
bfg --delete-files apps/backend/.env
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force --all
```

**All team members must re-clone** after this. Communicate via your team channel.

## Step 6 — CI guard (15 min)

Add a GitHub Actions workflow that fails the build if any `.env` file (other
than `.env.example`) is ever committed:

Create `.github/workflows/no-env.yml`:

```yaml
name: No env files
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check for .env files
        run: |
          if git ls-files | grep -E '(^|/)(\.env$|\.env\.[^.]+$|\.envrc$)'; then
            echo "ERROR: .env file is tracked by git"
            exit 1
          fi
```

This is a 5-minute setup that prevents the same incident from recurring.

## Step 7 — Notify the team

Send a message to all developers:

> **Security incident: leaked production secrets**
>
> Production secrets were committed to `apps/backend/.env` in the git
> repository on 2026-06-14. They have been rotated. Action required:
>
> 1. Pull the latest changes (re-clone if your local history is corrupted)
> 2. Get the new `.env` from the team password manager (1Password / Bitwarden)
> 3. Never commit `.env` again — even temporarily
> 4. Use the password manager as your single source of truth
>
> The `.env.example` files are now the only `.env*` files in the repo.
> CI guards will fail any future attempt to commit secrets.

## Step 8 — Verify (2 min)

After all rotations:

```bash
## Should return zero results (all .env files are gitignored)
git log --all --full-history -- "apps/backend/.env"

## Should show the file is ignored
git check-ignore -v apps/backend/.env

## Login with the rotated JWT_SECRET should still work
## (your local backend should still start)
cd apps/backend && npm run dev
## In another terminal:
curl http://localhost:5001/api/health
```

## Sign-off checklist

Before marking the deploy as ready, confirm:

- [ ] Supabase password rotated and new `DATABASE_URL` in `.env`
- [ ] `JWT_SECRET` rotated to a new 64-char hex
- [ ] `JWT_REFRESH_SECRET` rotated to a different new 64-char hex
- [ ] Razorpay webhook secret rotated
- [ ] (Optional) Razorpay API key pair rotated
- [ ] Git history scrubbed (filter-repo or BFG)
- [ ] CI no-env guard workflow added
- [ ] Team notified and re-cloned
- [ ] Local backend boots with new secrets (`npm run dev` works)
- [ ] `/api/health` returns 200 OK
- [ ] Test user can sign in and get a session (verifies new JWT secret works)
- [ ] Test webhook delivery succeeds (verifies new Razorpay webhook secret)

**Once every box is checked, deployment may proceed.**

---

## Lessons learned (post-incident review notes)

- Always copy from `.env.example`; never paste actual secrets
- Use a password manager (1Password CLI, Doppler, AWS Secrets Manager) for shared secrets
- Add the CI guard **before** the first PR, not after the first incident
- Rotate secrets on a 90-day schedule, not just on incident
- Audit `git log` for `.env*` files in any new repo on day one

---

**This document is a checklist for the team lead / DevOps engineer performing
the deploy. It is not a code change. Keep it in the docs/ folder as a
historical record of the process.**

---
