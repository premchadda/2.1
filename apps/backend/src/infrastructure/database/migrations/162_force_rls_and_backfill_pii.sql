-- Migration 160: Force RLS on sensitive tables, backfill PII encryption, and harmonize check constraints (SEC-03, SEC-04, SCH-03)

-- 1. Force RLS on sensitive tables so table owners/superusers cannot inadvertently bypass policies
ALTER TABLE public.two_factor_secrets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.transactions FORCE ROW LEVEL SECURITY;

-- 2. Fix search_path on encrypt_pii and decrypt_pii to include 'extensions' schema (SEC-04)
CREATE OR REPLACE FUNCTION public.encrypt_pii(plaintext text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  pii_key text := current_setting('app.pgcrypto_key', true);
BEGIN
  IF plaintext IS NULL OR plaintext = '' THEN
    RETURN NULL;
  END IF;
  IF pii_key IS NULL OR pii_key = '' THEN
    RETURN NULL;
  END IF;
  RETURN extensions.pgp_sym_encrypt(plaintext, pii_key, 'cipher-algo=aes256');
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrypt_pii(ciphertext text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  pii_key text := current_setting('app.pgcrypto_key', true);
BEGIN
  IF ciphertext IS NULL OR ciphertext = '' THEN
    RETURN NULL;
  END IF;
  IF pii_key IS NULL OR pii_key = '' THEN
    RETURN NULL;
  END IF;
  RETURN extensions.pgp_sym_decrypt(
    CASE
      WHEN ciphertext LIKE '\x%' THEN decode(substring(ciphertext from 3), 'hex')
      ELSE ciphertext::bytea
    END,
    pii_key
  );
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$function$;

-- 3. SCH-03: Tests status check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_tests_status'
  ) THEN
    ALTER TABLE public.tests
      ADD CONSTRAINT chk_tests_status
      CHECK (status IS NULL OR status IN ('draft', 'review', 'published', 'scheduled', 'archived', 'active', 'inactive'));
  END IF;
END $$;

-- 4. SCH-03: Subject topics difficulty check constraint (case-insensitive)
ALTER TABLE public.subject_topics DROP CONSTRAINT IF EXISTS chk_subject_topics_difficulty;
ALTER TABLE public.subject_topics
  ADD CONSTRAINT chk_subject_topics_difficulty
  CHECK (difficulty IS NULL OR LOWER(difficulty) IN ('easy', 'medium', 'hard', 'mixed'));

-- 5. PII Backfill execution when key is present
DO $$
DECLARE
  k text := current_setting('app.pgcrypto_key', true);
BEGIN
  IF k IS NOT NULL AND k <> '' THEN
    UPDATE public.users 
    SET phone_enc = encrypt_pii(mobile)
    WHERE mobile IS NOT NULL AND phone_enc IS NULL;
  END IF;
END $$;
