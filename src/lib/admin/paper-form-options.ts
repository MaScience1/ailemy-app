import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Single source for the option lists the past-paper form needs.
 *
 * WHY THIS EXISTS: four separate call sites each built these lists inline, and
 * every one of them ended in `(courses ?? []).map(...)`. That turns any failure
 * — a missing SUPABASE_SERVICE_ROLE_KEY, a rotated key, a network blip — into a
 * dropdown containing only "— select course —", with nothing anywhere telling
 * the admin why. The catalogue itself is fine (42 courses), so an empty
 * dropdown is ALWAYS a client/credential problem, never real data.
 *
 * This loader therefore reports failure instead of returning a bare empty list:
 * the error is logged AND returned so the form can show it. It is deliberately
 * NOT swallowed.
 */

/**
 * The extra fields are OPTIONAL on purpose. Four places outside the admin panel
 * redeclare this shape structurally as `{ id: string; label: string }`
 * (past-papers/_admin-controls.tsx, _single-paper.tsx, page.tsx and
 * admin/inline-data.ts). Making the new fields optional keeps every one of them
 * assignable without edits, so enriching the option list for the admin form
 * does not ripple into the past-papers front end.
 *
 * `label` stays exactly as it was — the flat "board · subject · name (level)"
 * string — for any consumer that just wants one line of text.
 */
export type CourseOption = {
  id: string;
  label: string;
  /** curricula.short_name, e.g. "Edexcel IAL" — groups the admin dropdown. */
  boardShortName?: string;
  /** curricula.name, e.g. "Cambridge IGCSE". Often the prefix a course name
   *  actually carries, where short_name ("CIE IGCSE") is not. */
  boardName?: string;
  subjectName?: string;
  /** courses.level, e.g. "AS", "A2", "GCSE". */
  level?: string;
  /** courses.name, e.g. "Edexcel IAL AS Chemistry". */
  courseName?: string;
};
export type UnitOption = { id: string; label: string; parentId: string };

export type PaperFormOptionsResult = {
  courses: CourseOption[];
  units: UnitOption[];
  /** Human-readable failure reason, or null when the load succeeded. */
  error: string | null;
};

const KEY_HINT =
  "Could not load courses — check the SUPABASE_SERVICE_ROLE_KEY environment variable";

export async function loadPaperFormOptions(): Promise<PaperFormOptionsResult> {
  // createAdminClient() throws when the URL or service-role key is absent.
  // Catch it here so the admin sees a specific, actionable message rather than
  // an unstyled 500 — but still log the original error, and still surface it.
  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("[paper-form-options] admin client unavailable:", detail);
    return { courses: [], units: [], error: `${KEY_HINT}. (${detail})` };
  }

  const [coursesRes, unitsRes, subjectsRes, curriculaRes] = await Promise.all([
    db
      .from("courses")
      .select("id, name, level, subject_id, curriculum_id")
      .order("sort_order"),
    db.from("units").select("id, course_id, name, code").order("sort_order"),
    db.from("subjects").select("id, name"),
    db.from("curricula").select("id, short_name, name"),
  ]);

  // A query-level failure is the other silent path: PostgREST returns an error
  // and `data` is null, which the old `?? []` turned into "no courses".
  const failed = [coursesRes, unitsRes, subjectsRes, curriculaRes].find(
    (r) => r.error,
  );
  if (failed?.error) {
    console.error("[paper-form-options] query failed:", failed.error);
    return {
      courses: [],
      units: [],
      error: `${KEY_HINT}. (${failed.error.message})`,
    };
  }

  const subjectName = new Map(
    ((subjectsRes.data ?? []) as { id: string; name: string }[]).map((s) => [
      s.id,
      s.name,
    ]),
  );
  const currName = new Map(
    (
      (curriculaRes.data ?? []) as {
        id: string;
        short_name: string | null;
        name: string;
      }[]
    ).map((c) => [c.id, c.short_name || c.name]),
  );
  const currFullName = new Map(
    (
      (curriculaRes.data ?? []) as { id: string; name: string }[]
    ).map((c) => [c.id, c.name]),
  );

  const courses: CourseOption[] = (
    (coursesRes.data ?? []) as {
      id: string;
      name: string;
      level: string;
      subject_id: string;
      curriculum_id: string;
    }[]
  ).map((c) => ({
    id: c.id,
    label: `${currName.get(c.curriculum_id) ?? "?"} · ${
      subjectName.get(c.subject_id) ?? "?"
    } · ${c.name} (${c.level})`,
    boardShortName: currName.get(c.curriculum_id),
    boardName: currFullName.get(c.curriculum_id),
    subjectName: subjectName.get(c.subject_id),
    level: c.level,
    courseName: c.name,
  }));

  const units: UnitOption[] = (
    (unitsRes.data ?? []) as {
      id: string;
      course_id: string;
      name: string;
      code: string | null;
    }[]
  ).map((u) => ({
    id: u.id,
    label: u.code ? `${u.code} · ${u.name}` : u.name,
    parentId: u.course_id,
  }));

  // No error, but nothing came back. The catalogue is never legitimately empty
  // in this app — a course must exist before a paper can reference it — so this
  // means the client is talking to the wrong project or is unauthorised.
  if (courses.length === 0) {
    console.error(
      "[paper-form-options] courses query succeeded but returned 0 rows",
    );
    return {
      courses: [],
      units,
      error: `${KEY_HINT}. The request succeeded but returned no courses.`,
    };
  }

  return { courses, units, error: null };
}
