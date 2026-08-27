-- Migration 129: Full Cascade Foreign Key System for Taxonomy and Questions Hierarchy
-- Ensures subjects -> subject_units -> subject_chapters -> subject_topics -> subject_subtopics -> questions
-- all support ON UPDATE CASCADE

-- 1. subject_units
ALTER TABLE subject_units DROP CONSTRAINT IF EXISTS units_subject_id_fkey;
ALTER TABLE subject_units ADD CONSTRAINT units_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- 2. subject_chapters
ALTER TABLE subject_chapters DROP CONSTRAINT IF EXISTS chapters_subject_id_fkey;
ALTER TABLE subject_chapters ADD CONSTRAINT chapters_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE subject_chapters DROP CONSTRAINT IF EXISTS chapters_unit_id_fkey;
ALTER TABLE subject_chapters ADD CONSTRAINT chapters_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES subject_units(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- 3. subject_topics
ALTER TABLE subject_topics DROP CONSTRAINT IF EXISTS topics_chapter_id_fkey;
ALTER TABLE subject_topics ADD CONSTRAINT topics_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES subject_chapters(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE subject_topics DROP CONSTRAINT IF EXISTS topics_subject_id_fkey;
ALTER TABLE subject_topics ADD CONSTRAINT topics_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE subject_topics DROP CONSTRAINT IF EXISTS topics_parent_topic_id_fkey;
ALTER TABLE subject_topics ADD CONSTRAINT topics_parent_topic_id_fkey FOREIGN KEY (parent_topic_id) REFERENCES subject_topics(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- 4. subject_subtopics
ALTER TABLE subject_subtopics DROP CONSTRAINT IF EXISTS subtopics_topic_id_fkey;
ALTER TABLE subject_subtopics ADD CONSTRAINT subtopics_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES subject_topics(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- 5. questions
ALTER TABLE questions DROP CONSTRAINT IF EXISTS fk_questions_subject;
ALTER TABLE questions ADD CONSTRAINT fk_questions_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_chapter_id_fkey;
ALTER TABLE questions ADD CONSTRAINT questions_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES subject_chapters(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_topic_id_fkey;
ALTER TABLE questions ADD CONSTRAINT questions_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES subject_topics(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_subtopic_id_fkey;
ALTER TABLE questions ADD CONSTRAINT questions_subtopic_id_fkey FOREIGN KEY (subtopic_id) REFERENCES subject_subtopics(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_section_id_fkey;
ALTER TABLE questions ADD CONSTRAINT questions_section_id_fkey FOREIGN KEY (section_id) REFERENCES test_sections(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_series_id_fkey;
ALTER TABLE questions ADD CONSTRAINT questions_series_id_fkey FOREIGN KEY (series_id) REFERENCES test_series(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- 6. Performance Indexes for Hierarchy Traversal
CREATE INDEX IF NOT EXISTS idx_questions_subtopic_id ON questions(subtopic_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic_id ON questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_questions_chapter_id ON questions(chapter_id);
CREATE INDEX IF NOT EXISTS idx_questions_subject_id ON questions(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_subtopics_topic_id ON subject_subtopics(topic_id);
CREATE INDEX IF NOT EXISTS idx_subject_topics_chapter_id ON subject_topics(chapter_id);
CREATE INDEX IF NOT EXISTS idx_subject_chapters_unit_id ON subject_chapters(unit_id);
CREATE INDEX IF NOT EXISTS idx_subject_units_subject_id ON subject_units(subject_id);
