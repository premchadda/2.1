# Pre-Deployment Manual Action Required: Secret Rotation

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
# Should return zero results (all .env files are gitignored)
git log --all --full-history -- "apps/backend/.env"

# Should show the file is ignored
git check-ignore -v apps/backend/.env

# Login with the rotated JWT_SECRET should still work
# (your local backend should still start)
cd apps/backend && npm run dev
# In another terminal:
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
