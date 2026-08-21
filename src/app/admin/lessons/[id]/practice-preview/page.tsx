import Link from "next/link";
import { notFound } from "next/navigation";

import { assertAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadLocalDeck, loadPublishedDeck } from "@/lib/lesson-deck/store.ts";
import { buildAttempt, buildSourcePack } from "@/lib/practice/engine.ts";
import { familiesForLesson, loadStatuses } from "@/lib/practice/registry.ts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Practice preview · Admin · Ailemy", robots: { index: false } };

/**
 * Admin "Preview 10 Questions" (§64) — generates exactly what a student COULD
 * receive, WITH the answers and explanations visible, regenerable by the
 * refresh link. includeDraft is true here and only here: the founder is
 * quality-checking families that students cannot yet see (§67).
 */
export default async function PracticePreviewPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ seed?: string }>;
}) {
  await assertAdmin();
  const { id } = await params;
  const { seed: seedParam } = await searchParams;
  const seed = seedParam ? Number(seedParam) >>> 0 : Math.floor(Math.random() * 0xffffffff) >>> 0;

  const admin = createAdminClient();
  const { data } = await admin
    .from("lessons")
    .select("id, slug, title, deck_path, lesson_spec_points(spec_points(code))")
    .eq("id", id)
    .maybeSingle();
  if (!data) return notFound();
  const lesson = data as unknown as {
    id: string; slug: string; title: string; deck_path: string | null;
    lesson_spec_points: { spec_points: { code: string } | null }[] | null;
  };

  // Published deck if there is one, else the local bundle — preview must work
  // before anything is staged.
  let deck = await loadPublishedDeck(lesson.deck_path);
  if (!deck.available) deck = await loadLocalDeck(lesson.slug, 1);
  if (!deck.available) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-xl font-semibold">Practice preview</h1>
        <p className="mt-3 text-sm text-red-700">No deck available: {deck.reason}</p>
      </main>
    );
  }

  const taught = (lesson.lesson_spec_points ?? [])
    .map((l) => l.spec_points?.code)
    .filter((c): c is string => Boolean(c));
  const pack = buildSourcePack(deck.manifest, taught);
  const statuses = await loadStatuses();

  let error: string | null = null;
  let questions: ReturnType<typeof buildAttempt>["questions"] = [];
  try {
    ({ questions } = buildAttempt({
      families: familiesForLesson(lesson.slug),
      statuses, pack, seed,
      includeDraft: true, // §64/§67 — admin QC of unapproved families
    }));
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-xl font-semibold">{lesson.title} — practice preview</h1>
      <p className="mt-1 text-sm text-slate-500">
        Seed {seed} · includes draft families (students receive approved only) ·{" "}
        <Link href={`/admin/lessons/${id}/practice-preview`} className="text-blue-700 underline">
          Regenerate ↻
        </Link>
      </p>
      {error ? (
        <p className="mt-6 text-sm text-red-700">{error}</p>
      ) : (
        <ol className="mt-6 grid gap-5">
          {questions.map((q) => (
            <li key={q.qIndex} className="rounded border border-slate-200 p-4">
              <p className="text-sm font-medium">{q.qIndex + 1}. {q.stem}</p>
              <ul className="mt-2 grid gap-1 text-sm">
                {q.options.map((o, i) => (
                  <li key={i} className={i === q.correctIndex ? "font-semibold text-green-700" : "text-slate-600"}>
                    {String.fromCharCode(65 + i)}. {o} {i === q.correctIndex && "✓"}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-500">
                {q.familyKey} · spec {q.specCode} · {q.kind}
                {q.reviewSlide !== null && ` · slide ${q.reviewSlide}`}
              </p>
              <p className="mt-1 text-xs text-slate-600">{q.explanation}</p>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
