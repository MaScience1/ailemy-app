import { notFound } from "next/navigation";

import { assertAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { flattenFrames } from "@/lib/lesson-deck/manifest.ts";
import { frameUrl, loadLocalDeck } from "@/lib/lesson-deck/store.ts";
import { LessonPlayer, type PlayerFrame } from "@/components/lesson/LessonPlayer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deck preview · Admin · Ailemy", robots: { index: false } };

/**
 * Admin slide preview (§9's "Ready for review", §122 A9-A11) — renders the
 * LOCAL ingest bundle through the EXACT student player component, so what the
 * founder approves is what students get. assertAdmin gates the page; the
 * frames come through the admin-only preview route, not the student route.
 */
export default async function DeckPreviewPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  await assertAdmin();
  const { id } = await params;
  const { v } = await searchParams;
  const version = Number(v ?? 1);

  const admin = createAdminClient();
  const { data: lesson } = await admin.from("lessons").select("id, slug, title").eq("id", id).maybeSingle();
  if (!lesson) return notFound();

  const deck = await loadLocalDeck(lesson.slug as string, version);
  if (!deck.available) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-xl font-semibold">Deck preview</h1>
        <p className="mt-3 text-sm text-red-700">{deck.reason}</p>
      </main>
    );
  }

  const frames: PlayerFrame[] = flattenFrames(deck.manifest).map((f) => ({
    index: f.index, slideN: f.slideN, step: f.step, stepCount: f.stepCount,
    url: frameUrl(deck, f.path), buildLabel: f.buildLabel,
  }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-xl font-semibold">
        {String(lesson.title)} — local bundle v{version} ({deck.manifest.slideCount} slides,{" "}
        {deck.manifest.frameCount} frames)
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Admin preview — this is the exact student player over the unstaged local bundle.
      </p>
      <div className="mt-6">
        <LessonPlayer
          lessonSlug={`preview-${lesson.slug}`}
          version={version}
          frames={frames}
          slideCount={deck.manifest.slideCount}
          watermark="admin preview"
        />
      </div>
    </main>
  );
}
