import Link from "next/link";
import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { loadPaperFormOptions } from "@/lib/admin/paper-form-options";
import { PastPaperForm } from "../_form";

export const metadata = { title: "Edit past paper · Admin · Ailemy" };
export const dynamic = "force-dynamic";

export default async function EditPastPaperPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Option lists come from the shared loader so a credentials failure surfaces
  // as a banner rather than an empty Course dropdown.
  const optionsPromise = loadPaperFormOptions();

  // The row itself still needs the admin client. If that throws, the shared
  // loader will have reported the same underlying problem — but this page
  // cannot render an edit form without the row, so a 404 is the honest outcome.
  let paper: Record<string, unknown> | null = null;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      // select("*") rather than an explicit column list: this row feeds
      // PastPaperForm, and "*" keeps working whether or not migration 0012
      // has been applied.
      .from("past_papers")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      console.error("[admin/past-papers] row fetch failed:", error);
    }
    paper = data ?? null;
  } catch (e) {
    console.error("[admin/past-papers] admin client unavailable:", e);
  }

  const { courses, units, error: optionsError } = await optionsPromise;

  if (!paper) return notFound();

  return (
    <div>
      <p className="text-sm">
        <Link href="/admin/past-papers" className="text-slate-600 hover:underline">
          ← Past papers
        </Link>
      </p>
      <h1 className="mt-2 font-display text-3xl font-medium">
        Edit past paper{" "}
        <span className="font-mono text-sm text-slate-500">
          {String(paper.id).slice(0, 8)}
        </span>
      </h1>
      <div className="mt-6">
        <PastPaperForm
          mode="edit"
          initial={paper as never}
          courses={courses}
          units={units}
          optionsError={optionsError}
        />
      </div>
    </div>
  );
}
