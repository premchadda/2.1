# Trstprep V2.1 — Out-of-Band Security Credential Rotation & DPDP Act 2023 Compliance Runbook

**Classification:** Operational Security & Legal Compliance Runbook  
**Authority:** Follows `AGENTS.md` Pre-Flight Audit Rule #1, `docs/SECURITY_POSTURE.md`, and `docs/REMEDIATION_PLAN.md` (Phase 0 & Phase 2.1).  
**Target Audience:** DevOps / Platform Engineers, Database Administrators, Security Officers, Legal & Compliance Team.

---

## 1. Executive Context & Exposure Assessment

During previous development cycles prior to Git tracking enforcement:

1. **Committed Environment Secrets (`apps/backend/.env`):**
   - Live Supabase `DATABASE_URL` with database passwords.
   - Symmetric JWT secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`).
   - Payment gateway keys (Razorpay Key ID / Secret).
   - AI provider keys (OpenRouter API keys, previously MiniMax keys).
   - _Current State:_ `.env` files are excluded from the working tree via `git rm --cached` and `.gitignore`, but historical commits retain the unencrypted blobs.
2. **Committed PII & User Data:**
   - Legacy test attempts (528 rows) containing 196 real Indian student names, phone numbers, and attempt histories were committed in early migration snapshots (`test_attempts` data).
   - _Current State:_ The live database converted `test_attempts` to a view in migrations 039/048, but historical commits contain identifiable personal data of Indian data principals.
   - _Legal Implication:_ Under India's **Digital Personal Data Protection Act (DPDP Act) 2023**, processing and retention of personal data requires transparent notice, defined purpose limitations, and breach/exposure risk remediation protocols.

---

## 2. Phase A: Out-of-Band Credential Rotation (Execute FIRST)

> [!CAUTION]
> Secret rotation **MUST precede** git history rewriting (`git filter-repo`). Rewriting git history without rotating the credentials leaves the database and authentication infrastructure fully vulnerable if an attacker already cloned the repository or pulled cache archives.

### Step A.1: Generate Cryptographically Secure Keys

Run the following commands in an isolated terminal to generate new 256-bit / 512-bit secrets:

```bash
# Generate New JWT Secret (Session Auth)
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

# Generate New Refresh Token Secret
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

# Generate New Password Reset Secret (Purpose-Isolated)
node -e "console.log('JWT_RESET_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

# Generate New 2FA / Phone Auth Secret (Purpose-Isolated)
node -e "console.log('JWT_2FA_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

# Generate New Database Column Encryption Key (pgcrypto)
node -e "console.log('PGCRYPTO_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

### Step A.2: Rotate Supabase PostgreSQL Database Credentials

1. **Log in to Supabase Management Console:**
   - Navigate to **Project Settings** → **Database** → **Database Password**.
2. **Reset Database Password:**
   - Click **Reset Database Password** and generate a secure 32+ character passphrase.
   - Note the updated URI string for pooler (`6543`) and direct connection (`5432`).
3. **Terminate Active Connections:**
   - Run the query in the Supabase SQL Editor to terminate any rogue open sessions using the old credentials:
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE usename = 'postgres' AND pid <> pg_backend_pid();
   ```

### Step A.3: Rotate Third-Party Provider Keys

1. **Razorpay Dashboard:**
   - Go to **Settings** → **API Keys** → **Regenerate Key**.
   - Select an overlap grace window (e.g. 24 hours) or immediately invalidate if active abuse is suspected.
   - Update `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
2. **OpenRouter API Key:**
   - Navigate to [OpenRouter Account Keys](https://openrouter.ai/keys).
   - Revoke existing key and issue a new restricted-budget key.
   - Update `OPENROUTER_API_KEY`.
3. **Storage / S3 / R2 Keys (if configured):**
   - Cycle AWS / Cloudflare R2 Access Key ID and Secret Access Key.

### Step A.4: Deploy Secrets to Production Environment

- Update the production secrets in host daemon configuration (`/etc/systemd/system/...`, Docker secrets, or Vercel/Fly.io dashboard).
- Ensure `NODE_ENV=production` is strictly declared.
- **Restart backend services** and verify health checks:
  ```bash
  curl -i https://<your-api-domain>/health
  ```

---

## 3. Phase B: Git History Scrubbing with `git filter-repo`

> [!WARNING]
> This operation rewrites repository history, altering commit hashes. All contributors must coordinate to pull the scrubbed history or re-clone.

### Step B.1: Prerequisites & Clean Working Tree

1. Ensure all current work is committed or stashed:
   ```bash
   git status
   ```
2. Create a clean backup clone of the repository:
   ```bash
   cd ..
   git clone --mirror "e:\Tech\Testprep\Trstprep V2.1" trstprep-pre-scrub-backup.git
   cd "e:\Tech\Testprep\Trstprep V2.1"
   ```

### Step B.2: Install `git-filter-repo`

If using Python:

```bash
uv pip install git-filter-repo
# or
pip install git-filter-repo
```

### Step B.3: Purge Leaked Files from History

Execute `git filter-repo` to permanently expunge environment files and unhashed credential logs:

```bash
git filter-repo --invert-paths \
  --path "apps/backend/.env" \
  --path "apps/backend/.env.production" \
  --path "apps/frontend/.env" \
  --path "apps/admin-panel/.env" \
  --path "M3 Key.txt" \
  --path-glob "*.env*" \
  --force
```

### Step B.4: Scrub PII Strings & Specific Credentials

Create an expressions file `scrub-expressions.txt`:

```text
# Replace exposed connection strings and tokens with sanitized placeholders
regex:postgres:\/\/postgres:([^@]+)@==>postgres://postgres:REDACTED@
regex:rzp_live_[a-zA-Z0-9]+==>rzp_live_REDACTED
regex:rzp_test_[a-zA-Z0-9]+==>rzp_test_REDACTED
regex:sk-or-v1-[a-f0-9]+==>sk-or-v1-REDACTED
```

Run string replacements across commit history:

```bash
git filter-repo --replace-text scrub-expressions.txt --force
rm scrub-expressions.txt
```

### Step B.5: Garbage Collect and Force Push

```bash
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push to remote (coordinate with team)
git push origin --force --all
git push origin --force --tags
```

---

## 4. Phase C: DPDP Act 2023 Compliance Action Plan

The **Digital Personal Data Protection Act, 2023 (DPDP Act 2023)** mandates that Data Fiduciaries (Trstprep) ensure personal data is collected, stored, and processed lawfully, with transparent notice and breach mitigation.

### Step C.1: Audit of Historical PII Exposure

1. **Catalog Affected Data Principals:**
   - 196 user accounts present in legacy migration data.
   - Identified data attributes: Student full name, email address, phone number, category preferences, test attempt timestamps, question score tallies.
2. **Assess Risk Level:**
   - Financial data (credit card / banking): **Zero exposure** (handled exclusively via Razorpay redirect/tokens).
   - Passwords: **Bcrypt salted hashes** (not plaintext).
   - High-sensitivity identity identifiers (Aadhaar / PAN): **Not collected**.

### Step C.2: DPDP Section 8 & Section 6 Compliance Protocol

1. **Notice Obligation (Section 5 & 6):**
   - Provide an updated Privacy Notice on the Trstprep platform informing students:
     - The categories of personal data processed (educational performance, contact details).
     - The explicit purpose: Generating personalized exam readiness insights, rank predictions, and assessment certificates.
     - The mechanisms for exercising Data Principal rights (Access, Correction, Erasure).
2. **Right to Erasure / Nominee (Section 12 & 14):**
   - Confirm that the database supports the soft-delete and purge pattern implemented in migration `008` / `094-101`.
   - Admin panel endpoint `/api/admin/users/:id` with `super_admin` role allows fulfilling user erasure and data portability requests.
3. **Security Safeguards (Section 8(5)):**
   - Document technical controls:
     - Storage at rest encrypted via Supabase AES-256.
     - Sensitive fields encrypted via `pgcrypto`.
     - In-transit encryption: Strict TLS 1.3 enforced via Nginx.
     - Role-Based Access Control (RBAC): Defense-in-depth admin middleware pipeline (`restrictAdminOrigin → validateAdminApiKey → protect → admin → validateCsrfToken → auditMiddleware`).
     - Audit logging: Canonical `audit_logs` records every administrative mutation and export.

---

## 5. Pre-Commit Guardrails & CI Enforcement

To guarantee zero regression and prevent future credential or PII leaks:

1. **Pre-commit PII and Secret Hook:**
   - Active in `.husky/pre-commit` using regex scanners for AWS, Supabase, JWT, and Razorpay tokens.
2. **CI Data Guard:**
   - Runs on every push/PR via `.github/workflows/data-guard.yml`.
   - Fails the build if any `.env`, private key, or credential pattern is detected in git diffs.
3. **Knowledge Graph & Brain Integrity:**
   - Verified via `scripts/sync-repo-brain.mjs` and `graphify`.
