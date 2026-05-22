-- ============================================================================
-- AILEMY INITIAL SCHEMA — v1.1 (revised)
-- ============================================================================

-- Status enum — expanded with draft and archived
CREATE TYPE content_status AS ENUM ('draft', 'live', 'in_progress', 'coming_soon', 'archived');
CREATE TYPE user_role AS ENUM ('student', 'parent', 'teacher', 'school_admin');
CREATE TYPE subscription_tier AS ENUM ('free', 'founding_member', 'student', 'parent');

-- Catalogue
CREATE TABLE curricula (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,
  name          text NOT NULL,
  short_name    text NOT NULL,
  region        text,
  description   text,
  sort_order    int DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE subjects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,
  name          text NOT NULL,
  color_as      text,
  color_a2      text,
  sort_order    int DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE courses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_id   uuid NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
  subject_id      uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  slug            text UNIQUE NOT NULL,
  name            text NOT NULL,
  level           text NOT NULL,
  description     text,
  status          content_status DEFAULT 'coming_soon',
  estimated_launch text,
  sort_order      int DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (curriculum_id, subject_id, level)
);

-- NEW: units sit between courses and topics, but are optional
CREATE TABLE units (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  slug            text NOT NULL,
  code            text,        -- 'WCH11', 'Unit 1', 'Paper 1'
  name            text NOT NULL,
  description     text,
  status          content_status DEFAULT 'coming_soon',
  sort_order      int DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (course_id, slug)
);

-- Topics — unit_id is NULLABLE so curricula without units still work
CREATE TABLE topics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  unit_id         uuid REFERENCES units(id) ON DELETE SET NULL,
  slug            text NOT NULL,
  code            text,
  name            text NOT NULL,
  description     text,
  status          content_status DEFAULT 'coming_soon',
  sort_order      int DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (course_id, slug)
);

CREATE TABLE spec_points (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id            uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  code                text NOT NULL,
  title               text NOT NULL,
  description         text NOT NULL,
  command_terms       text[],
  diagram_svg         text,
  hydrogen_audio_url  text,
  hydrogen_video_url  text,
  status              content_status DEFAULT 'draft',  -- start as draft until verified
  verified_at         timestamptz,                      -- set when content matches official spec
  sort_order          int DEFAULT 0,
  created_at          timestamptz DEFAULT now(),
  UNIQUE (topic_id, code)
);

CREATE TABLE lessons (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                        text UNIQUE NOT NULL,
  title                       text NOT NULL,
  description                 text,
  voice_video_mux_id          text,
  worksheet_video_mux_id      text,
  animated_video_mux_id       text,
  ppt_pdf_url                 text,
  worksheet_pdf_url           text,
  summary_md                  text,
  transcript                  text,
  estimated_duration_minutes  int,
  status                      content_status DEFAULT 'coming_soon',
  sort_order                  int DEFAULT 0,
  created_at                  timestamptz DEFAULT now()
);

CREATE TABLE lesson_spec_points (
  lesson_id      uuid REFERENCES lessons(id) ON DELETE CASCADE,
  spec_point_id  uuid REFERENCES spec_points(id) ON DELETE CASCADE,
  PRIMARY KEY (lesson_id, spec_point_id)
);

-- Users
CREATE TABLE profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     text,
  role          user_role DEFAULT 'student',
  country       text,
  founding_member boolean DEFAULT false,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE parent_students (
  parent_id     uuid REFERENCES profiles(id) ON DELETE CASCADE,
  student_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  relationship  text,
  created_at    timestamptz DEFAULT now(),
  PRIMARY KEY (parent_id, student_id)
);

CREATE TABLE student_courses (
  student_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  course_id     uuid REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at   timestamptz DEFAULT now(),
  PRIMARY KEY (student_id, course_id)
);

-- Activity tables (unchanged from v1)
CREATE TABLE progress (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id         uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  watched_seconds   int DEFAULT 0,
  total_seconds     int,
  completed         boolean DEFAULT false,
  last_seen_at      timestamptz DEFAULT now(),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE (student_id, lesson_id)
);

CREATE TABLE generated_questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  spec_point_id   uuid NOT NULL REFERENCES spec_points(id) ON DELETE CASCADE,
  question_text   text NOT NULL,
  mark_scheme     text NOT NULL,
  total_marks     int NOT NULL,
  difficulty      text,
  command_term    text,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE student_answers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_id     uuid NOT NULL REFERENCES generated_questions(id) ON DELETE CASCADE,
  answer_text     text NOT NULL,
  submitted_at    timestamptz DEFAULT now()
);

CREATE TABLE ai_marks (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id                uuid NOT NULL REFERENCES student_answers(id) ON DELETE CASCADE,
  marks_awarded            int NOT NULL,
  total_marks              int NOT NULL,
  feedback                 text,
  what_was_correct         text,
  what_was_missing         text,
  improvement_suggestion   text,
  marked_at                timestamptz DEFAULT now()
);

CREATE TABLE chatbox_interactions (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id                  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id                   uuid REFERENCES lessons(id) ON DELETE SET NULL,
  spec_point_id               uuid REFERENCES spec_points(id) ON DELETE SET NULL,
  video_timestamp_seconds     int,
  question                    text NOT NULL,
  response                    text NOT NULL,
  created_at                  timestamptz DEFAULT now()
);

CREATE TABLE waitlist (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  course_id     uuid REFERENCES courses(id) ON DELETE SET NULL,
  source        text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX waitlist_email_idx ON waitlist(email);
CREATE INDEX waitlist_course_idx ON waitlist(course_id);

CREATE TABLE subscriptions (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_subscription_id    text UNIQUE,
  stripe_customer_id        text,
  tier                      subscription_tier DEFAULT 'free',
  status                    text DEFAULT 'inactive',
  current_period_end        timestamptz,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

-- ============================================================================
-- ROW LEVEL SECURITY (with units table added)
-- ============================================================================

ALTER TABLE curricula ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE spec_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_spec_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalogue_public_read_curricula" ON curricula FOR SELECT USING (true);
CREATE POLICY "catalogue_public_read_subjects" ON subjects FOR SELECT USING (true);
CREATE POLICY "catalogue_public_read_courses" ON courses FOR SELECT USING (true);
CREATE POLICY "catalogue_public_read_units" ON units FOR SELECT USING (true);
CREATE POLICY "catalogue_public_read_topics" ON topics FOR SELECT USING (true);
CREATE POLICY "catalogue_public_read_spec_points" ON spec_points FOR SELECT USING (true);
CREATE POLICY "catalogue_public_read_lessons" ON lessons FOR SELECT USING (true);
CREATE POLICY "catalogue_public_read_lesson_spec_points" ON lesson_spec_points FOR SELECT USING (true);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_parent_read_student" ON profiles FOR SELECT
  USING (id IN (SELECT student_id FROM parent_students WHERE parent_id = auth.uid()));

ALTER TABLE parent_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parent_students_read_own" ON parent_students FOR SELECT
  USING (auth.uid() = parent_id OR auth.uid() = student_id);
CREATE POLICY "parent_students_insert_own" ON parent_students FOR INSERT
  WITH CHECK (auth.uid() = parent_id OR auth.uid() = student_id);

ALTER TABLE student_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student_courses_read_own" ON student_courses FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "student_courses_insert_own" ON student_courses FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "student_courses_delete_own" ON student_courses FOR DELETE USING (auth.uid() = student_id);

ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progress_student_read_own" ON progress FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "progress_student_write_own" ON progress FOR ALL USING (auth.uid() = student_id);
CREATE POLICY "progress_parent_read_linked" ON progress FOR SELECT
  USING (student_id IN (SELECT student_id FROM parent_students WHERE parent_id = auth.uid()));

ALTER TABLE generated_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questions_own" ON generated_questions FOR ALL USING (auth.uid() = student_id);

ALTER TABLE student_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "answers_own" ON student_answers FOR ALL USING (auth.uid() = student_id);

ALTER TABLE ai_marks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marks_own" ON ai_marks FOR ALL
  USING (answer_id IN (SELECT id FROM student_answers WHERE student_id = auth.uid()));

ALTER TABLE chatbox_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chatbox_own" ON chatbox_interactions FOR ALL USING (auth.uid() = student_id);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "waitlist_public_insert" ON waitlist FOR INSERT WITH CHECK (true);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions_read_own" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Triggers (unchanged)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER touch_profiles BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_subscriptions BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_progress BEFORE UPDATE ON progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
