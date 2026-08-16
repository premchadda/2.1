-- Migration 103: Alter bookmarks.item_id column to VARCHAR(255) to support string and UUID question IDs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookmarks' AND column_name = 'item_id' AND data_type LIKE '%integer%') THEN
    ALTER TABLE bookmarks ALTER COLUMN item_id TYPE VARCHAR(255) USING item_id::varchar;
  END IF;
END $$;
