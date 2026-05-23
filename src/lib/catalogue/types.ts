/**
 * Catalogue row types. Hand-maintained until we wire `supabase gen types`.
 * Mirrors the columns in 0001_initial_schema.sql + 0004_lessons_scope_to_course.sql.
 */

export type ContentStatus =
  | "draft"
  | "live"
  | "in_progress"
  | "coming_soon"
  | "archived";

export type Subject = {
  id: string;
  slug: string;
  name: string;
  color_as: string | null;
  color_a2: string | null;
  sort_order: number;
};

export type Curriculum = {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  region: string | null;
};

export type Course = {
  id: string;
  curriculum_id: string;
  subject_id: string;
  slug: string;
  name: string;
  level: string;
  description: string | null;
  status: ContentStatus;
  estimated_launch: string | null;
  sort_order: number;
};

export type CourseWithRelations = Course & {
  curriculum: Pick<Curriculum, "id" | "slug" | "name" | "short_name" | "region">;
  subject: Pick<Subject, "id" | "slug" | "name">;
};

export type Unit = {
  id: string;
  course_id: string;
  slug: string;
  code: string | null;
  name: string;
  description: string | null;
  status: ContentStatus;
  sort_order: number;
};

export type SpecPoint = {
  id: string;
  topic_id: string;
  code: string;
  title: string;
  description: string;
  command_terms: string[] | null;
  status: ContentStatus;
  sort_order: number;
};

export type Lesson = {
  id: string;
  course_id: string | null;
  unit_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  lesson_number: number | null;
  is_core_practical: boolean;
  status: ContentStatus;
  sort_order: number;
  estimated_duration_minutes: number | null;
  summary_md: string | null;
};

/** Lesson card row used by the lesson catalogue page. */
export type LessonForCatalogue = Lesson & {
  /** Spec point codes only (e.g. "1.1", "1.2"), used as tags on the card. */
  spec_point_codes: string[];
};

/** Lesson row used by the lesson page itself. */
export type LessonForPage = Lesson & {
  spec_points: SpecPoint[];
};

/** A tiny neighbour row for prev/next nav. */
export type LessonNeighbour = Pick<Lesson, "slug" | "title" | "lesson_number">;
