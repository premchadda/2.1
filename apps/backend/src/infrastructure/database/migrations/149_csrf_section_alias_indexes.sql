-- 147: csrf_tokens index + lifecycle repair, section_aliases CI lookup index
--
-- Findings (pg_stat_user_tables, live DB Oct 2026):
--  * csrf_tokens: ON CONFLICT (auth_token_hash) cannot work because the table
--    has no unique index on auth_token_hash -> every store falls back to
--    seq-scan DELETE + INSERT (6,978 seq scans / 19.2M tup-read lifetime).
--    Also 3,162 of 3,166 rows were expired zombies because the hourly cleanup
--    interval only purged the in-memory map, never the DB (fixed in code).
--  * section_aliases: admin-sections joins use LOWER(alias_name) = LOWER($x)
--    which no existing index can serve -> every lookup is a full scan.
--
-- All statements are idempotent — safe to re-run.
-- CSRF_TOKEN lifetime is 24h; expired-row purge is cheap via expires index.

DELETE FROM csrf_tokens WHERE expires_at < NOW();

-- Keep only the newest row per auth_token_hash
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY auth_token_hash ORDER BY created_at DESC) AS rn
    FROM csrf_tokens
)
DELETE FROM csrf_tokens t
 USING ranked
 WHERE t.id = ranked.id AND ranked.rn > 1;

-- Unique index on auth_token_hash:
--  * makes storeCsrfToken's ON CONFLICT (auth_token_hash) work natively
--  * makes all auth_token_hash lookups (validate/rotate/delete) index walks
CREATE UNIQUE INDEX IF NOT EXISTS csrf_tokens_auth_token_hash_unique
  ON csrf_tokens (auth_token_hash);

-- Case-insensitive alias lookup index for admin-sections joins
CREATE INDEX IF NOT EXISTS idx_section_aliases_alias_ci
  ON section_aliases (LOWER(alias_name));
