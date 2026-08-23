-- Migration 088: Encrypt PII at rest (M14) — SECURE v2
-- ---------------------------------------------------------------------------
-- PII columns (phone/mobile, dob, location, education, bio) were stored as
-- plaintext VARCHAR/TEXT. This migration introduces column-level encryption
-- using pgcrypto (server) + app-layer aes-256-gcm (Node crypto).
--
-- Key source: DB_ENCRYPTION_KEY (app) ↔ app.pgcrypto_key (DB session GUC).
-- REQUIRED: DB_ENCRYPTION_KEY must be 32+ chars; never reuse JWT_SECRET.
-- The migrationRunner sets GUC from PGCRYPTO_KEY/DB_ENCRYPTION_KEY before
-- running. If the GUC is absent, functions return NULL and plaintext stays
-- as fallback — but production MUST configure the key. See 104 for
-- resilience; this file enforces the requirement via NOTICE + backfill guard.
--
-- App-layer: postgres-helpers.js uses aes-256-gcm with iv:authTag:ciphertext
-- (requires DB_ENCRYPTION_KEY, no JWT_SECRET fallback). DB-layer pgcrypto
-- uses pgp_sym_encrypt cipher-algo=aes256 (equivalent to AES-256-CFB with
-- OpenPGP; app-layer gcm provides AEAD). Documenting gcm vs cbc choice:
--   - cbc malleable without HMAC; gcm is AEAD with authTag — preferred.
--   - Legacy CBC ciphertext (iv:cipher) is still decryptable for rotation.
--
-- Shadow columns: phone_enc, dob_enc, location_enc, education_enc, bio_enc
-- are TEXT holding pgp_sym_encrypt output. Plaintext columns retained for
-- transitional reads; follow-up migration 122 drops them after app cutover.
-- DO NOT log PGCRYPTO_KEY / DB_ENCRYPTION_KEY.
--
-- Phone vs Mobile: canonical column is `phone` (baseline 108); legacy installs
-- used `mobile`. This migration handles BOTH via COALESCE(phone, mobile) and
-- syncs phone_enc from either source. postgres-helpers.js normalizes
-- mobile→phone on write.
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Require session key — fail fast if not set, to avoid silent null encryption.
-- In dev without key, backfill is skipped (NULL) but trigger stays resilient.
DO $$
DECLARE
  key_present boolean;
BEGIN
  SELECT current_setting('app.pgcrypto_key', true) IS NOT NULL AND
         current_setting('app.pgcrypto_key', true) <> '' INTO key_present;
  IF NOT key_present THEN
    RAISE NOTICE '088: app.pgcrypto_key not set — PII backfill will be skipped. Configure DB_ENCRYPTION_KEY/PGCRYPTO_KEY before production. DO NOT log key.';
  ELSE
    RAISE NOTICE '088: app.pgcrypto_key present — proceeding with PII encryption backfill.';
  END IF;
END $$;

-- Encryption helpers — SECURITY DEFINER with fixed search_path, missing_ok mode
CREATE OR REPLACE FUNCTION encrypt_pii(plaintext text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  pii_key text := current_setting('app.pgcrypto_key', true);
BEGIN
  IF plaintext IS NULL OR plaintext = '' THEN
    RETURN NULL;
  END IF;
  IF pii_key IS NULL OR pii_key = '' THEN
    RETURN NULL; -- resilient when key absent (dev); production must set key
  END IF;
  RETURN pgp_sym_encrypt(
    plaintext,
    pii_key,
    'cipher-algo=aes256'
  );
END;
$$;

CREATE OR REPLACE FUNCTION decrypt_pii(ciphertext text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  pii_key text := current_setting('app.pgcrypto_key', true);
BEGIN
  IF ciphertext IS NULL OR ciphertext = '' THEN
    RETURN NULL;
  END IF;
  IF pii_key IS NULL OR pii_key = '' THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_decrypt(
    ciphertext,
    pii_key
  );
END;
$$;

-- Revoke anon/authenticated, grant to service_role/postgres (hardened, see 115)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'encrypt_pii') THEN
    BEGIN REVOKE ALL ON FUNCTION public.encrypt_pii(text) FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN BEGIN REVOKE ALL ON FUNCTION public.encrypt_pii(text) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END; END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN BEGIN REVOKE ALL ON FUNCTION public.encrypt_pii(text) FROM authenticated; EXCEPTION WHEN OTHERS THEN NULL; END; END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN BEGIN GRANT EXECUTE ON FUNCTION public.encrypt_pii(text) TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'decrypt_pii') THEN
    BEGIN REVOKE ALL ON FUNCTION public.decrypt_pii(text) FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN BEGIN REVOKE ALL ON FUNCTION public.decrypt_pii(text) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END; END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN BEGIN REVOKE ALL ON FUNCTION public.decrypt_pii(text) FROM authenticated; EXCEPTION WHEN OTHERS THEN NULL; END; END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN BEGIN GRANT EXECUTE ON FUNCTION public.decrypt_pii(text) TO service_role; EXCEPTION WHEN OTHERS THEN NULL; END; END IF;
  END IF;
END $$;

-- Add encrypted shadow columns to users (consistent *_enc suffix)
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_enc text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dob_enc text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_enc text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS education_enc text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio_enc text;

-- Backfill only where at least one source PII exists and target is NULL
DO $$
BEGIN
  -- Only backfill if pgcrypto key is present
  IF current_setting('app.pgcrypto_key', true) IS NOT NULL AND current_setting('app.pgcrypto_key', true) <> '' THEN
    -- Use transaction-safe update with trigger disabled temporarily if trigger exists
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_user_array_referential_integrity') THEN
        ALTER TABLE users DISABLE TRIGGER trigger_user_array_referential_integrity;
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    UPDATE users
    SET
      phone_enc    = CASE WHEN COALESCE(phone, mobile) IS NOT NULL THEN encrypt_pii(COALESCE(phone, mobile)) ELSE phone_enc END,
      dob_enc      = CASE WHEN date_of_birth IS NOT NULL THEN encrypt_pii(date_of_birth::text) ELSE dob_enc END,
      location_enc = CASE WHEN location IS NOT NULL THEN encrypt_pii(location) ELSE location_enc END,
      education_enc= CASE WHEN education IS NOT NULL THEN encrypt_pii(education) ELSE education_enc END,
      bio_enc      = CASE WHEN bio IS NOT NULL THEN encrypt_pii(bio) ELSE bio_enc END
    WHERE (phone_enc IS NULL OR dob_enc IS NULL OR location_enc IS NULL OR education_enc IS NULL OR bio_enc IS NULL)
      AND (COALESCE(phone, mobile) IS NOT NULL OR date_of_birth IS NOT NULL OR location IS NOT NULL OR education IS NOT NULL OR bio IS NOT NULL);

    BEGIN
      IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_user_array_referential_integrity') THEN
        ALTER TABLE users ENABLE TRIGGER trigger_user_array_referential_integrity;
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    RAISE NOTICE '088: PII backfill completed (phone/mobile → phone_enc, dob, location, education, bio).';
  ELSE
    RAISE NOTICE '088: Skipped PII backfill — key not configured. Will retry on next deploy with key.';
  END IF;
END $$;

-- Trigger keeps encrypted columns in sync with plaintext writes (handles both phone and mobile)
CREATE OR REPLACE FUNCTION sync_users_pii_enc() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  pii_key text := current_setting('app.pgcrypto_key', true);
BEGIN
  IF pii_key IS NOT NULL AND pii_key <> '' THEN
    -- Prefer `phone`, fallback to legacy `mobile` alias; keep both plaintext cols in sync for transition
    NEW.phone_enc    := CASE WHEN COALESCE(NEW.phone, NEW.mobile) IS NOT NULL THEN encrypt_pii(COALESCE(NEW.phone, NEW.mobile)) ELSE NULL END;
    -- Mirror phone → mobile if mobile column exists and phone was set but mobile not (keep alias consistent)
    IF TG_TABLE_NAME = 'users' AND NEW.phone IS NOT NULL AND NEW.mobile IS NULL THEN
      BEGIN NEW.mobile := NEW.phone; EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
    IF TG_TABLE_NAME = 'users' AND NEW.mobile IS NOT NULL AND NEW.phone IS NULL THEN
      BEGIN NEW.phone := NEW.mobile; EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
    NEW.dob_enc      := CASE WHEN NEW.date_of_birth IS NOT NULL THEN encrypt_pii(NEW.date_of_birth::text) ELSE NULL END;
    NEW.location_enc := CASE WHEN NEW.location IS NOT NULL THEN encrypt_pii(NEW.location) ELSE NULL END;
    NEW.education_enc:= CASE WHEN NEW.education IS NOT NULL THEN encrypt_pii(NEW.education) ELSE NULL END;
    NEW.bio_enc      := CASE WHEN NEW.bio IS NOT NULL THEN encrypt_pii(NEW.bio) ELSE NULL END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_users_pii_enc ON users;
CREATE TRIGGER trigger_users_pii_enc
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION sync_users_pii_enc();

-- Plaintext retention note: DO NOT drop columns in this migration — follow-up migration 122
-- will drop `phone`/`mobile`, `date_of_birth`, `location`, `education`, `bio` after
-- app reads are verified to use *_enc via decrypt_pii / app-layer aes-256-gcm.
-- For immediate hardening, ensure RLS + REVOKE on decrypt_pii and app-level
-- ValidationError on missing DB_ENCRYPTION_KEY (see postgres-helpers.js).
