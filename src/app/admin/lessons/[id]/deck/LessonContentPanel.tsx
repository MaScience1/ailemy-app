import { readdir } from "node:fs/promises";
import { join } from "node:path";

import Link from "next/link";

import { loadLocalDeck } from "@/lib/lesson-deck/store.ts";
import { familiesForLesson, loadStatuses } from "@/lib/practice/registry.ts";
import { publishDeckForm, setFamilyStatusForm, stageDeckForm, unpublishDeckForm } from "./actions";
import { ActionForm } from "./ActionForm";

/**
 * Admin → Lesson → Lesson Content (§11): the deck lifecycle and the practice
 * families, on the existing lesson editor page.
 *
 * Every form posts through ActionForm (the panel's one client component) so
 * the server action's ActionResult is RENDERED — refusals in red with their
 * reason, success as a tick. The earlier all-server version discarded every
 * result, which produced two live confusions in two days (see ActionForm).
 * The founder's flow for one lesson, top to bottom:
 *
 *   1. run the ingest command the panel prints (on the machine with soffice)
 *   2. Preview slides   — every frame, from the LOCAL bundle, admin-only route
 *   3. Stage to bucket  — uploads frames+manifest (+source to its own prefix)
 *   4. Publish          — points lessons.deck_path at the staged version
 *   5. approve families — draft → approved, per family, after previewing 10
 *
 * ⚠ NOTHING HERE AUTO-PUBLISHES (§9–§10). Ingest failure keeps the last
 * published version live; staging a new version never touches the live one;
 * only the explicit Publish button moves students.
 */

export async function LessonContentPanel({
  lessonId,
  lessonSlug,
  deckPath,
}: {
  lessonId: string;
  lessonSlug: string;
  deckPath: string | null;
}) {
  // Local ingest bundles for this lesson, by version directory name.
  let versions: number[] = [];
  try {
    versions = (await readdir(join(process.cwd(), "content", "decks", lessonSlug)))
      .map((d) => /^v(\d+)$/.exec(d)?.[1])
      .filter((v): v is string => Boolean(v))
      .map(Number)
      .sort((a, b) => a - b);
  } catch {
    /* no local bundles on this machine — the panel says so below */
  }

  const families = familiesForLesson(lessonSlug);
  const statuses = await loadStatuses();

  return (
    <section className="mt-10 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-800">Lesson content</h2>

      {/* ── PowerPoint deck ─────────────────────────────────────────────── */}
      <div className="mt-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">PowerPoint</h3>
        <p className="mt-1 text-sm text-slate-600">
          {deckPath ? (
            <>Published: <code className="rounded bg-slate-100 px-1">{deckPath}</code></>
          ) : (
            "No deck published — students see the video/placeholder."
          )}
        </p>

        {versions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            No local ingest bundle on this machine. Render one where LibreOffice
            is installed:{" "}
            <code className="rounded bg-slate-100 px-1 text-xs">
              python3 scripts/lesson-ingest/ingest.py --pptx &lt;deck.pptx&gt; --slug {lessonSlug} --version 1
            </code>
          </p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {versions.map((v) => (
              <LocalVersionRow
                key={v}
                lessonId={lessonId}
                lessonSlug={lessonSlug}
                version={v}
                isPublished={deckPath === `lessons/${lessonId}/deck/v${v}`}
              />
            ))}
          </ul>
        )}

        {deckPath && (
          <ActionForm action={unpublishDeckForm} className="mt-3 flex flex-wrap items-center gap-2">
            <input type="hidden" name="lessonId" value={lessonId} />
            <button type="submit" className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">
              Unpublish deck
            </button>
          </ActionForm>
        )}
      </div>

      {/* ── Practice families (§61–§67) ─────────────────────────────────── */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Practice</h3>
        {families.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">No question families registered for this lesson.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-600">
              {families.length} families · attempt size 10 ·{" "}
              {families.filter((f) => (statuses[f.key] ?? "draft") === "approved").length} approved —{" "}
              <strong>students receive only approved families</strong>.{" "}
              <Link href={`/admin/lessons/${lessonId}/practice-preview`} className="text-blue-700 underline">
                Preview 10 questions →
              </Link>
            </p>
            {/* coverage view (§65): families per spec code and kind */}
            <p className="mt-1 text-xs text-slate-500">
              Coverage:{" "}
              {Object.entries(
                families.reduce<Record<string, number>>((acc, f) => {
                  acc[`spec ${f.specCode}`] = (acc[`spec ${f.specCode}`] ?? 0) + 1;
                  acc[f.kind] = (acc[f.kind] ?? 0) + 1;
                  return acc;
                }, {}),
              )
                .map(([k, n]) => `${k}: ${n}`)
                .join(" · ")}
            </p>
            <table className="mt-3 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-1.5 pr-3">Family</th>
                  <th className="py-1.5 pr-3">Spec</th>
                  <th className="py-1.5 pr-3">Kind</th>
                  <th className="py-1.5 pr-3">Slides</th>
                  <th className="py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {families.map((f) => {
                  const st = statuses[f.key] ?? "draft";
                  return (
                    <tr key={f.key} className="border-b border-slate-100">
                      <td className="py-1.5 pr-3 font-mono text-xs">{f.key}</td>
                      <td className="py-1.5 pr-3">{f.specCode}</td>
                      <td className="py-1.5 pr-3">{f.kind}</td>
                      <td className="py-1.5 pr-3">{f.sourceSlides.join(", ")}</td>
                      <td className="py-1.5">
                        <ActionForm action={setFamilyStatusForm} className="flex flex-wrap items-center gap-2">
                          {/* The chip is the STORED status, rendered — the one
                              truth on this row that no form-reset semantics
                              can repaint wrongly. */}
                          <span
                            className={
                              st === "approved"
                                ? "rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800"
                                : st === "disabled"
                                  ? "rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700"
                                  : "rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600"
                            }
                          >
                            {st}
                          </span>
                          <input type="hidden" name="key" value={f.key} />
                          <input type="hidden" name="lessonId" value={lessonId} />
                          {/* key={st}: React never re-applies defaultValue to a
                              mounted select, and the post-action reset restores
                              the SSR-time default — the select showed the OLD
                              status until a manual reload (the visible half of
                              the 2026-08-23 defect). Remount on fresh status. */}
                          <select
                            name="status"
                            key={st}
                            defaultValue={st}
                            className="rounded border border-slate-300 px-1.5 py-0.5 text-xs"
                          >
                            <option value="draft">draft</option>
                            <option value="approved">approved</option>
                            <option value="disabled">disabled</option>
                          </select>
                          <button type="submit" className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50">
                            Set
                          </button>
                        </ActionForm>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </section>
  );
}

async function LocalVersionRow({
  lessonId, lessonSlug, version, isPublished,
}: {
  lessonId: string;
  lessonSlug: string;
  version: number;
  isPublished: boolean;
}) {
  const local = await loadLocalDeck(lessonSlug, version);
  return (
    <li className="flex flex-wrap items-center gap-3 rounded border border-slate-200 px-3 py-2">
      <span className="font-mono text-xs">v{version}</span>
      {local.available ? (
        <span className="text-xs text-slate-600">
          {local.manifest.slideCount} slides · {local.manifest.frameCount} frames ·{" "}
          {local.manifest.deckLabel} · spec {local.manifest.specCodes.join(", ")}
        </span>
      ) : (
        <span className="text-xs text-red-600">{local.reason}</span>
      )}
      {isPublished && <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">published</span>}
      <span className="ml-auto flex items-center gap-2">
        <Link
          href={`/admin/lessons/${lessonId}/deck-preview?v=${version}`}
          className="rounded border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-50"
        >
          Preview slides
        </Link>
        <ActionForm action={stageDeckForm} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="lessonId" value={lessonId} />
          <input type="hidden" name="slug" value={lessonSlug} />
          <input type="hidden" name="version" value={version} />
          <button type="submit" className="rounded border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-50">
            Stage to bucket
          </button>
        </ActionForm>
        <ActionForm action={publishDeckForm} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="lessonId" value={lessonId} />
          <input type="hidden" name="version" value={version} />
          <button type="submit" className="rounded bg-slate-800 px-2.5 py-1 text-xs text-white hover:bg-slate-700">
            Publish v{version}
          </button>
        </ActionForm>
      </span>
    </li>
  );
}
