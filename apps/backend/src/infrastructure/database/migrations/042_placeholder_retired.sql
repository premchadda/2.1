-- ============================================================
-- Migration 042: Placeholder (intentionally empty)
-- ============================================================
-- Audit 2026-07-01 flagged a gap between 041 and 043. Investigation
-- showed 042 was retired during a rollback and never re-applied.
-- This placeholder preserves the sequential numbering so the
-- migration runner does not skip a slot. No schema changes here.
-- If the originally-retired changes need to be re-applied, file a
-- NEW migration with the next available number (do not edit this one).
-- ============================================================
BEGIN;
  -- No-op: intentionally empty to document the retired migration slot.
  SELECT 1;
COMMIT;