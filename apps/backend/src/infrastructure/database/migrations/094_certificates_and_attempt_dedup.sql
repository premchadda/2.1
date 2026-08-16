-- Migration 094: Create certificates table for certificate verification system
-- Phase 3.9: Certificate verification was a sham — verifyCertificate() accepted
-- any string and returned { isValid: true }. This migration creates the table
-- that certificateService.js uses to store and verify certificate hashes.

CREATE TABLE IF NOT EXISTS certificates (
  id SERIAL PRIMARY KEY,
  attempt_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  test_id INTEGER,
  hash VARCHAR(64) UNIQUE NOT NULL,
  salt VARCHAR(32) NOT NULL,
  recipient_name VARCHAR(255),
  test_title VARCHAR(500),
  score NUMERIC,
  total_marks NUMERIC,
  percentage NUMERIC,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  is_revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificates_hash ON certificates(hash) WHERE is_revoked = FALSE;
CREATE INDEX IF NOT EXISTS idx_certificates_attempt ON certificates(attempt_id);
CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);

-- Add unique partial index to prevent duplicate in-progress attempts
-- Phase 3.1: Race condition in test start — two concurrent POST /tests/:testId/start
-- calls could both pass the "no existing attempt" check and both insert.
CREATE UNIQUE INDEX IF NOT EXISTS attempts_user_test_inprogress
  ON attempts(user_id, test_id)
  WHERE status = 'in_progress' OR (is_completed = false AND status IS NULL);

-- Add enrollments.type column for filtered enrollment queries
-- Phase 3.8: getUserSeriesEnrollments / getUserExamEnrollments /
-- getUserStudyMaterialEnrollments were all returning unfiltered data.
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'series';
CREATE INDEX IF NOT EXISTS idx_enrollments_type ON enrollments(type) WHERE is_active = true;
