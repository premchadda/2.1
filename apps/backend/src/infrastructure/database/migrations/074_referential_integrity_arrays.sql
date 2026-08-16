-- Migration 074: Referential integrity for legacy arrays (enrolled_series and enrolled_exams)

-- 1. Create check trigger function for users table
CREATE OR REPLACE FUNCTION check_user_array_referential_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate enrolled_series referencing test_series(id)
  IF NEW.enrolled_series IS NOT NULL AND array_length(NEW.enrolled_series, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM unnest(NEW.enrolled_series) AS s_id
      LEFT JOIN test_series ts ON ts.id = s_id
      WHERE ts.id IS NULL
    ) THEN
      RAISE EXCEPTION 'Referential integrity violation: some series IDs in enrolled_series do not exist in test_series table.';
    END IF;
  END IF;

  -- Validate enrolled_exams referencing exams(id)
  IF NEW.enrolled_exams IS NOT NULL AND array_length(NEW.enrolled_exams, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM unnest(NEW.enrolled_exams) AS e_id
      LEFT JOIN exams ex ON ex.id = e_id
      WHERE ex.id IS NULL
    ) THEN
      RAISE EXCEPTION 'Referential integrity violation: some exam IDs in enrolled_exams do not exist in exams table.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Bind trigger to users table
DROP TRIGGER IF EXISTS trigger_user_array_referential_integrity ON users;
CREATE TRIGGER trigger_user_array_referential_integrity
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION check_user_array_referential_integrity();

-- 3. Create cleanup trigger function for test_series table
CREATE OR REPLACE FUNCTION cleanup_deleted_series_from_users()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET enrolled_series = array_remove(enrolled_series, OLD.id)
  WHERE OLD.id = ANY(enrolled_series);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cleanup_deleted_series ON test_series;
CREATE TRIGGER trigger_cleanup_deleted_series
AFTER DELETE ON test_series
FOR EACH ROW EXECUTE FUNCTION cleanup_deleted_series_from_users();

-- 4. Create cleanup trigger function for exams table
CREATE OR REPLACE FUNCTION cleanup_deleted_exam_from_users()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET enrolled_exams = array_remove(enrolled_exams, OLD.id)
  WHERE OLD.id = ANY(enrolled_exams);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cleanup_deleted_exam ON exams;
CREATE TRIGGER trigger_cleanup_deleted_exam
AFTER DELETE ON exams
FOR EACH ROW EXECUTE FUNCTION cleanup_deleted_exam_from_users();
