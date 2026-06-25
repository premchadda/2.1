# Security Incident — 2026-06-14

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
# Should return nothing
git log --all --full-history -- apps/backend/.env

# Should be ignored
git check-ignore -v apps/backend/.env
```

## Lessons learned
- Always use a `.env.example` template with placeholders
- Never commit `.env` even temporarily
- Use a secret manager (AWS Secrets Manager, 1Password, Doppler) for shared secrets
- Add CI checks before any PR can be merged
- Rotate secrets on a regular schedule (every 90 days)
