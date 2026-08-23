import { inline } from "@/lib/lesson/markdown";
import type { Block } from "@/lib/flashcards/types.ts";

/**
 * Renders the typed content blocks of a card face.
 *
 * ============================================================================
 * ⚠ IT REUSES THE NOTES RENDERER'S INLINE PARSER, AND THAT IS THE POINT
 * ============================================================================
 * `inline()` turns **bold**, *italic* and `code` into React ELEMENTS and never
 * interprets a tag — the whole security position of the lesson-notes renderer,
 * which exists precisely so this project does not need a markdown library plus
 * a sanitiser standing behind it forever. A second parser here would be a
 * second thing to get wrong.
 *
 * ⚠ CALLOUT TONE IS NEVER COLOUR ALONE (§49). Each renders its own label —
 * "Remember", "Exam wording", "Common mistake" — so the meaning survives
 * greyscale, a screen reader, and a student who cannot distinguish the tints.
 */

const CALLOUT: Record<"remember" | "exam" | "mistake", { label: string; className: string }> = {
  remember: { label: "Remember", className: "border-ink/20 bg-ink/[0.03]" },
  exam: { label: "Exam wording", className: "border-[var(--subject-border)] bg-[var(--subject-tint)]" },
  mistake: { label: "Common mistake", className: "border-amber-300/70 bg-amber-50/60" },
};

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="grid gap-4">
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} index={i} />
      ))}
    </div>
  );
}

function BlockView({ block: b, index }: { block: Block; index: number }) {
  switch (b.kind) {
    case "text":
      return <p className="text-[15px] leading-[1.65] text-ink/80">{inline(b.body, `t${index}`)}</p>;

    case "bullets":
      return (
        <ul className="grid gap-2 pl-5 text-[15px] leading-[1.6] text-ink/80 marker:text-[var(--subject-accent)]">
          {b.items.map((it, j) => (
            <li key={j} className="list-disc">{inline(it, `b${index}-${j}`)}</li>
          ))}
        </ul>
      );

    case "steps":
      return (
        <ol className="grid gap-2.5 text-[15px] leading-[1.6] text-ink/80">
          {b.items.map((it, j) => (
            <li key={j} className="flex gap-3">
              {/* The numbered marker is one of the accent's jobs (§3). */}
              <span
                aria-hidden
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--subject-border)] bg-[var(--subject-tint)] font-mono text-[10px] text-[var(--subject-text)]"
              >
                {j + 1}
              </span>
              <span>{inline(it, `s${index}-${j}`)}</span>
            </li>
          ))}
        </ol>
      );

    case "definition":
      return (
        <div>
          <p className="font-display text-xl font-medium leading-snug tracking-tight">{b.term}</p>
          <p className="mt-1.5 text-[15px] leading-[1.65] text-ink/80">{inline(b.body, `d${index}`)}</p>
        </div>
      );

    case "formula":
      return (
        <div>
          {/* Given real hierarchy (§45) — the equation is the point of the card. */}
          <p className="font-display text-2xl font-medium tracking-tight text-ink sm:text-[1.75rem]">
            {b.expression}
          </p>
          {b.where && b.where.length > 0 && (
            <dl className="mt-3 grid gap-1 text-sm">
              {b.where.map((w, j) => (
                <div key={j} className="flex gap-3">
                  <dt className="font-mono w-6 shrink-0 text-[var(--subject-text)]">{w.symbol}</dt>
                  <dd className="text-ink/70">{w.meaning}</dd>
                </div>
              ))}
            </dl>
          )}
          {b.units && (
            <p className="font-mono mt-2 text-[11px] uppercase tracking-[0.14em] text-ink/45">{b.units}</p>
          )}
        </div>
      );

    case "media":
      return (
        <figure>
          {/* ⚠ ASPECT RESERVED BEFORE LOAD so the card cannot shift under the
              reader's eyes (§50), and object-contain so a diagram is never
              stretched to fill a frame it does not fit (§19). */}
          <div
            className="w-full overflow-hidden rounded-md border border-ink/10 bg-ink/[0.02]"
            style={{ aspectRatio: b.media.aspect ?? "4/3" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- card media
                comes through the access-checked asset route, like deck frames */}
            <img
              src={b.media.path}
              alt={b.media.alt}
              className="h-full w-full object-contain"
              loading="lazy"
            />
          </div>
          {b.media.caption && (
            <figcaption className="mt-2 text-xs leading-relaxed text-ink/55">{b.media.caption}</figcaption>
          )}
        </figure>
      );

    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink/15 text-left">
                {b.headers.map((h, j) => (
                  <th key={j} className="font-mono py-1.5 pr-4 text-[10px] uppercase tracking-[0.14em] text-ink/55">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, j) => (
                <tr key={j} className="border-b border-ink/[0.07]">
                  {r.map((c, k) => (
                    <td key={k} className="py-2 pr-4 align-top text-ink/80">{inline(c, `tb${index}-${j}-${k}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "compare":
      return (
        // Two columns where there is room, stacked where there is not — a
        // comparison that scrolls sideways on a phone compares nothing (§38).
        <div className="grid gap-4 sm:grid-cols-2">
          {[b.left, b.right].map((side, j) => (
            <div key={j} className="rounded-md border border-ink/10 p-3.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--subject-text)]">
                {side.label}
              </p>
              <ul className="mt-2 grid gap-1.5 text-sm leading-relaxed text-ink/80">
                {side.points.map((p, k) => (
                  <li key={k}>{inline(p, `c${index}-${j}-${k}`)}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );

    case "callout": {
      const c = CALLOUT[b.tone];
      return (
        <div className={`rounded-md border px-3.5 py-3 ${c.className}`}>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/55">{c.label}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink/80">{inline(b.body, `co${index}`)}</p>
        </div>
      );
    }
  }
}
