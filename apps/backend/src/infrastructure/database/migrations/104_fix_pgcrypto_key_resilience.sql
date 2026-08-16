-- Migration 104: Make PII-at-rest encryption resilient to a missing session key
-- ---------------------------------------------------------------------------
-- Migration 088 introduced encrypt_pii()/decrypt_pii() plus the
-- trigger_users_pii_enc trigger on `users`, which calls
-- current_setting('app.pgcrypto_key', false). The runtime write pool never
-- sets that session config (only migrationRunner does), so when PGCRYPTO_KEY
-- is not configured, EVERY INSERT/UPDATE on `users` throws:
--     42704: unrecognized configuration parameter "app.pgcrypto_key"
-- This broke logout (`UPDATE users SET refresh_token_version = ...`) with a
-- 500 even though it touches no PII columns.
--
-- Fix: use current_setting(..., true) (missing_ok) and treat an empty/absent
-- key as "encryption disabled" so those calls become a no-op instead of an
-- error. Writes still succeed and the plaintext columns keep working; the *_enc
-- columns simply stay NULL until a real PGCRYPTO_KEY is configured. Never log
-- the key value.
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION encrypt_pii(plaintext text)
RETURNS text AS $$
DECLARE
  pii_key text := current_setting('app.pgcrypto_key', true); -- missing_ok
BEGIN
  IF plaintext IS NULL OR plaintext = '' THEN
    RETURN NULL;
  END IF;
  -- No session key configured -> encryption disabled; do not fail the write.
  IF pii_key IS NULL OR pii_key = '' THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_encrypt(plaintext, pii_key, 'cipher-algo=aes256');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_pii(ciphertext text)
RETURNS text AS $$
DECLARE
  pii_key text := current_setting('app.pgcrypto_key', true); -- missing_ok
BEGIN
  IF ciphertext IS NULL OR ciphertext = '' THEN
    RETURN NULL;
  END IF;
  IF pii_key IS NULL OR pii_key = '' THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_decrypt(ciphertext, pii_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: keep *_enc columns in sync, but never crash when the key is absent.
-- Only derive encrypted values when the key is actually present; otherwise keep
-- the prior encrypted value (or NULL) and leave plaintext columns as the source.
CREATE OR REPLACE FUNCTION sync_users_pii_enc() RETURNS trigger AS $$
DECLARE
  pii_key text := current_setting('app.pgcrypto_key', true); -- missing_ok
BEGIN
  IF pii_key IS NOT NULL AND pii_key <> '' THEN
    NEW.phone_enc    = CASE WHEN NEW.mobile        IS NOT NULL THEN encrypt_pii(NEW.mobile)                 ELSE NULL END;
    NEW.dob_enc      = CASE WHEN NEW.date_of_birth IS NOT NULL THEN encrypt_pii(NEW.date_of_birth::text)    ELSE NULL END;
    NEW.location_enc = CASE WHEN NEW.location      IS NOT NULL THEN encrypt_pii(NEW.location)               ELSE NULL END;
    NEW.education_enc= CASE WHEN NEW.education     IS NOT NULL THEN encrypt_pii(NEW.education)              ELSE NULL END;
    NEW.bio_enc      = CASE WHEN NEW.bio           IS NOT NULL THEN encrypt_pii(NEW.bio)                    ELSE NULL END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-assert the trigger (idempotent).
DROP TRIGGER IF EXISTS trigger_users_pii_enc ON users;
CREATE TRIGGER trigger_users_pii_enc
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION sync_users_pii_enc();
