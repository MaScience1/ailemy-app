-- Lessons must be scoped to a course, not globally unique by slug
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_slug_key;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES units(id) ON DELETE SET NULL;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS lesson_number int;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS is_core_practical boolean DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS lessons_course_slug_idx ON lessons(course_id, slug);
