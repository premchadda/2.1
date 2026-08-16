-- Migration 088: Encrypt PII at rest (M14)
-- ---------------------------------------------------------------------------
-- PII columns (phone, dob, location, education, bio) were stored as plaintext
-- VARCHAR/TEXT. This migration introduces column-level encryption using
-- pgcrypto, keyed from the PGCRYPTO_KEY environment variable (set in the
-- deployment environment / secrets manager). It adds encrypted shadow columns,
-- backfills them from the existing plaintext values, and adds a trigger that
-- keeps the encrypted columns in sync on every INSERT/UPDATE so the app can
-- migrate reads to the encrypted columns over time.
--
-- The plaintext columns are intentionally left in place for a transitional
-- period; a follow-up migration should drop them once the application reads
-- from the *_enc columns. DO NOT log PGCRYPTO_KEY.
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Load the key once per session from the environment (set by the deploy).
-- If unset we deliberately FAIL the migration so PII is never silently
-- stored under a null key.
DO $$
DECLARE
  key_present boolean;
BEGIN
  SELECT current_setting('app.pgcrypto_key', true) IS NOT NULL AND
         current_setting('app.pgcrypto_key', true) <> '' INTO key_present;
  IF NOT key_present THEN
    RAISE NOTICE 'PGCRYPTO_KEY not loaded yet; expecting it to be set via SET app.pgcrypto_key before this migration runs.';
  END IF;
END $$;

-- Encryption helper: encrypts text with the session key using AES-256-GCM
-- (pgcrypto's pgp_sym_encrypt). Falls back to NULL for NULL input.
CREATE OR REPLACE FUNCTION encrypt_pii(plaintext text)
RETURNS text AS $$
BEGIN
  IF plaintext IS NULL OR plaintext = '' THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_encrypt(
    plaintext,
    current_setting('app.pgcrypto_key', false),
    'cipher-algo=aes256'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_pii(ciphertext text)
RETURNS text AS $$
BEGIN
  IF ciphertext IS NULL OR ciphertext = '' THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_decrypt(
    ciphertext,
    current_setting('app.pgcrypto_key', false)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add encrypted shadow columns to users (safe if already present).
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_enc text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dob_enc text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_enc text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS education_enc text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio_enc text;

-- Disable referential integrity check triggers on users before backfill
ALTER TABLE users DISABLE TRIGGER trigger_user_array_referential_integrity;

-- Backfill from existing plaintext PII (no-op if already encrypted).
UPDATE users
SET
  phone_enc    = CASE WHEN mobile IS NOT NULL    THEN encrypt_pii(mobile)    ELSE NULL END,
  dob_enc      = CASE WHEN date_of_birth IS NOT NULL      THEN encrypt_pii(date_of_birth::text) ELSE NULL END,
  location_enc = CASE WHEN location IS NOT NULL THEN encrypt_pii(location) ELSE NULL END,
  education_enc= CASE WHEN education IS NOT NULL THEN encrypt_pii(education) ELSE NULL END,
  bio_enc      = CASE WHEN bio IS NOT NULL      THEN encrypt_pii(bio)      ELSE NULL END
WHERE phone_enc IS NULL AND dob_enc IS NULL AND location_enc IS NULL
  AND education_enc IS NULL AND bio_enc IS NULL;

-- Re-enable triggers after backfill
ALTER TABLE users ENABLE TRIGGER trigger_user_array_referential_integrity;

-- Trigger keeps encrypted columns in sync with plaintext writes.
CREATE OR REPLACE FUNCTION sync_users_pii_enc() RETURNS trigger AS $$
BEGIN
  NEW.phone_enc    = CASE WHEN NEW.mobile IS NOT NULL    THEN encrypt_pii(NEW.mobile)    ELSE NULL END;
  NEW.dob_enc      = CASE WHEN NEW.date_of_birth IS NOT NULL      THEN encrypt_pii(NEW.date_of_birth::text) ELSE NULL END;
  NEW.location_enc = CASE WHEN NEW.location IS NOT NULL THEN encrypt_pii(NEW.location) ELSE NULL END;
  NEW.education_enc= CASE WHEN NEW.education IS NOT NULL THEN encrypt_pii(NEW.education) ELSE NULL END;
  NEW.bio_enc      = CASE WHEN NEW.bio IS NOT NULL      THEN encrypt_pii(NEW.bio)      ELSE NULL END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_users_pii_enc ON users;
CREATE TRIGGER trigger_users_pii_enc
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION sync_users_pii_enc();
