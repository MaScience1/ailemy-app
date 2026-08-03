import Link from "next/link";

import { loadPaperFormOptions } from "@/lib/admin/paper-form-options";
import { PastPaperForm } from "../_form";

export const metadata = { title: "New past paper · Admin · Ailemy" };
export const dynamic = "force-dynamic";

export default async function NewPastPaperPage() {
  // Shared loader: reports WHY the option lists are empty instead of silently
  // handing the form a zero-length courses array.
  const { courses, units, error } = await loadPaperFormOptions();

  return (
    <div>
      <p className="text-sm">
        <Link href="/admin/past-papers" className="text-slate-600 hover:underline">
          ← Past papers
        </Link>
      </p>
      <h1 className="mt-2 font-display text-3xl font-medium">New past paper</h1>
      <div className="mt-6">
        <PastPaperForm
          mode="create"
          initial={null}
          courses={courses}
          units={units}
          optionsError={error}
        />
      </div>
    </div>
  );
}
