import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Catalogue · Admin · Ailemy" };
export const dynamic = "force-dynamic";

/**
 * Read-only reference view for the six catalogue tables an admin needs to
 * see IDs for when linking lessons. Not editable — schema changes to these
 * tables belong in migrations.
 */
export default async function AdminCataloguePage() {
  const supabase = createAdminClient();

  const [
    { data: curricula = [] },
    { data: subjects = [] },
    { data: courses = [] },
    { data: units = [] },
    { data: topics = [] },
    { data: specPoints = [] },
  ] = await Promise.all([
    supabase.from("curricula").select("id, slug, name, short_name, region").order("sort_order"),
    supabase.from("subjects").select("id, slug, name, sort_order").order("sort_order"),
    supabase
      .from("courses")
      .select("id, slug, name, level, status, curriculum_id, subject_id, pathway, sort_order")
      .order("sort_order"),
    supabase.from("units").select("id, course_id, slug, code, name, status, sort_order").order("sort_order"),
    supabase.from("topics").select("id, course_id, unit_id, slug, code, name, status, sort_order").order("sort_order"),
    supabase
      .from("spec_points")
      .select("id, topic_id, code, title, status, sort_order")
      .order("sort_order")
      .limit(500),
  ]);

  return (
    <div>
      <h1 className="font-display text-3xl font-medium">Catalogue</h1>
      <p className="mt-2 text-sm text-slate-600">
        Read-only. Use these IDs when linking lessons.
      </p>

      <ReadonlyTable
        title="Curricula"
        rows={(curricula ?? []).map((r) => [r.id, r.short_name || r.name, r.slug, r.region ?? ""])}
        headers={["ID", "Name", "Slug", "Region"]}
      />
      <ReadonlyTable
        title="Subjects"
        rows={(subjects ?? []).map((r) => [r.id, r.name, r.slug])}
        headers={["ID", "Name", "Slug"]}
      />
      <ReadonlyTable
        title="Courses"
        rows={(courses ?? []).map((r) => [
          r.id,
          r.name,
          r.slug,
          r.level,
          r.status,
          r.pathway ?? "",
        ])}
        headers={["ID", "Name", "Slug", "Level", "Status", "Pathway"]}
      />
      <ReadonlyTable
        title="Units"
        rows={(units ?? []).map((r) => [r.id, r.name, r.code ?? "", r.slug, r.course_id, r.status])}
        headers={["ID", "Name", "Code", "Slug", "Course ID", "Status"]}
      />
      <ReadonlyTable
        title="Topics"
        rows={(topics ?? []).map((r) => [
          r.id,
          r.name,
          r.code ?? "",
          r.slug,
          r.course_id,
          r.unit_id ?? "",
          r.status,
        ])}
        headers={["ID", "Name", "Code", "Slug", "Course ID", "Unit ID", "Status"]}
      />
      <ReadonlyTable
        title={`Spec points (${(specPoints ?? []).length})`}
        rows={(specPoints ?? []).map((r) => [r.id, r.code, r.title, r.topic_id, r.status])}
        headers={["ID", "Code", "Title", "Topic ID", "Status"]}
      />
    </div>
  );
}

function ReadonlyTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: (string | number | null)[][];
}) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-medium">
        {title} <span className="text-sm text-slate-500">({rows.length})</span>
      </h2>
      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((r, i) => (
              <tr key={i} className="odd:bg-white even:bg-slate-50">
                {r.map((cell, j) => (
                  <td
                    key={j}
                    className={
                      j === 0
                        ? "px-3 py-1.5 font-mono text-[11px] text-slate-500"
                        : "px-3 py-1.5"
                    }
                  >
                    {String(cell ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
