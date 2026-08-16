-- Migration 085: Add unique event_uuid constraint to attempt_events to enforce event de-duplication
ALTER TABLE attempt_events ADD COLUMN IF NOT EXISTS event_uuid UUID UNIQUE;

-- Create index IF NOT EXISTS on event_uuid to optimize deduplication checks
CREATE INDEX IF NOT EXISTS idx_attempt_events_event_uuid ON attempt_events(event_uuid);
