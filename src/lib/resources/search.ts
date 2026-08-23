import { createClient } from "@/lib/supabase/server";

/**
 * Resource search (§17, §18).
 *
 * ============================================================================
 * ⚠ SERVER-SIDE AND INDEXED-ISH, NEVER "DOWNLOAD THE DATABASE AND FILTER"
 * ============================================================================
 * §58 is explicit that this must not pull the catalogue into the browser.
 * Every query below is bounded, runs on the server, and searches the columns
 * a student would actually type into — lesson titles, topic names, unit
 * names, paper titles. It uses ILIKE rather than full-text search because
 * this schema has no tsvector column and adding one is schema, which is
 * parked; the parked file proposes exactly that index so this can become a
 * real FTS query without the callers changing.
 *
 * ⚠ IT SEARCHES ONLY WHAT ANON MAY READ (§60). paper_questions refuses anon
 * with 42501, so question text is not searched — and the results say what
 * they cover rather than implying they cover everything.
 */

export type SearchHit = {
  kind: "lesson" | "topic" | "unit" | "past_paper";
  title: string;
  context: string;
  href: string;
  subjectSlug: string;
  meta?: string;
};

export type SearchResult = {
  query: string;
  hits: SearchHit[];
  /** Stated on screen: what this search does NOT cover, so nobody assumes. */
  notSearched: string[];
  error: string | null;
};

const LIMIT = 40;

/** ILIKE is a pattern, so a user's % and _ must not become wildcards. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

export async function searchResources(rawQuery: string): Promise<SearchResult> {
  const query = rawQuery.trim();
  const notSearched = ["exam question text (admin-gated)", "mark schemes"];
  if (query.length < 2) {
    return { query, hits: [], notSearched, error: null };
  }

  const db = await createClient();
  const pattern = `%${escapeLike(query)}%`;

  const [lessons, topics, units, papers] = await Promise.all([
    db.from("lessons")
      .select("slug, title, status, course_id, courses(slug, subjects(slug), pathway)")
      .ilike("title", pattern).neq("status", "archived").limit(LIMIT),
    db.from("topics")
      .select("id, name, code, course_id, courses(slug, subjects(slug))")
      .ilike("name", pattern).limit(LIMIT),
    db.from("units")
      .select("id, name, code, course_id, courses(slug, subjects(slug))")
      .ilike("name", pattern).limit(LIMIT),
    // ⚠ paper_name AND paper_code, NOT `title` — past_papers has no title
    // column. The first version searched one, PostgREST answered 42703, and
    // the page said so out loud rather than quietly returning three hits
    // instead of four. That visible failure is the only reason this was found
    // in a minute rather than in a support message.
    db.from("past_papers")
      .select("slug, paper_name, paper_code, year, session, course_id, courses(slug, subjects(slug))")
      .or(`paper_name.ilike.${pattern},paper_code.ilike.${pattern}`)
      .neq("status", "archived")
      .limit(LIMIT),
  ]);

  for (const [label, res] of [
    ["lessons", lessons], ["topics", topics], ["units", units], ["past papers", papers],
  ] as const) {
    // ⚠ A failed search says so. Silently returning fewer hits would make the
    // library look empty rather than broken.
    if (res.error) return { query, hits: [], notSearched, error: `${label}: ${res.error.message}` };
  }

  const hits: SearchHit[] = [];
  type CourseRef = { slug: string; pathway?: string | null; subjects: { slug: string } | null } | null;

  for (const l of lessons.data ?? []) {
    const c = (l as unknown as { courses: CourseRef }).courses;
    if (!c?.subjects?.slug) continue;
    hits.push({
      kind: "lesson",
      title: l.title as string,
      context: c.slug,
      subjectSlug: c.subjects.slug,
      href: `/learn/${c.subjects.slug}/${c.pathway}/${c.slug}/${l.slug}`,
      meta: l.status === "live" ? "Lesson" : "Lesson · not published yet",
    });
  }
  for (const [rows, kind] of [[topics.data ?? [], "topic"], [units.data ?? [], "unit"]] as const) {
    for (const r of rows) {
      const c = (r as unknown as { courses: CourseRef }).courses;
      if (!c?.subjects?.slug) continue;
      hits.push({
        kind,
        title: r.name as string,
        context: c.slug,
        subjectSlug: c.subjects.slug,
        href: `/resources/${c.subjects.slug}/${c.slug}`,
        meta: (r.code as string) ?? (kind === "unit" ? "Unit" : "Topic"),
      });
    }
  }
  for (const p of papers.data ?? []) {
    const c = (p as unknown as { courses: CourseRef }).courses;
    if (!c?.subjects?.slug) continue;
    hits.push({
      kind: "past_paper",
      title: `${p.paper_code ? `${p.paper_code} · ` : ""}${p.paper_name as string}`,
      context: c.slug,
      subjectSlug: c.subjects.slug,
      href: `/resources/${c.subjects.slug}/${c.slug}`,
      meta: `Past paper · ${p.session} ${p.year}`,
    });
  }

  return { query, hits: hits.slice(0, LIMIT), notSearched, error: null };
}
