import Link from "next/link";

import type {
  RankedArea,
  RetrievalCandidate,
  SpecUnitNode,
} from "@/lib/specification/types";
import { MasteryFigure, RETRIEVAL_META, StateLabel, TREND_META } from "./mastery-meta";

/**
 * The Phase-2 rails — Strongest, Needs attention, Retrieval due.
 *
 * ============================================================================
 * ⚠ THESE CARDS NAME THINGS; THEY CALCULATE NOTHING
 * ============================================================================
 * Ranking lives in rankings.ts and retrieval.ts, computed server-side; every
 * row here shows the REASON those engines produced, built from the same
 * numbers printed beside it (§2/§10 of the Phase 2 spec). Action links are
 * real or absent, exactly as RecommendedNext rules: a live lesson links, a
 * lesson-less point deep-links into the explorer, and no control ever opens
 * nothing. Each card renders at most three rows — the aside is a rail, not a
 * dashboard (§12: no clutter).
 */

const CARD_LIMIT = 3;

type CodeInfo = {
  title: string;
  topicName: string;
  liveLessonSlug: string | null;
  liveLessonTitle: string | null;
};

export function codeIndex(units: SpecUnitNode[]): Map<string, CodeInfo> {
  const byCode = new Map<string, CodeInfo>();
  for (const u of units) {
    for (const t of u.topics) {
      for (const p of t.points) {
        const live = p.lessons.find((l) => l.live) ?? null;
        byCode.set(p.code, {
          title: p.title ?? p.description,
          topicName: t.name,
          liveLessonSlug: live?.slug ?? null,
          liveLessonTitle: live?.title ?? null,
        });
      }
    }
  }
  return byCode;
}

function Row({
  specCode,
  info,
  specHref,
  children,
  action,
}: {
  specCode: string;
  info: CodeInfo;
  specHref: string;
  children: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <li className="border-s-2 border-[var(--subject-border)] ps-3">
      <Link
        href={`${specHref}?point=${encodeURIComponent(specCode)}`}
        className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--subject-text)]">
          {specCode} · {info.topicName}
        </span>
        <span className="mt-0.5 block text-sm font-medium text-ink group-hover:underline group-hover:underline-offset-4">
          {info.title}
        </span>
      </Link>
      {children}
      {action}
    </li>
  );
}

function LessonAction({
  info,
  lessonBase,
  verb,
}: {
  info: CodeInfo;
  lessonBase: string | null;
  verb: string;
}) {
  if (!info.liveLessonSlug || !lessonBase) return null;
  return (
    <p className="mt-1 text-xs">
      <Link
        href={`${lessonBase}/${info.liveLessonSlug}`}
        /* -my/py: a 44px hit area on a phone without moving the layout. */
        className="-my-3 inline-block py-3 underline underline-offset-4 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {verb} in {info.liveLessonTitle} →
      </Link>
    </p>
  );
}

export function StrongestAreas({
  items,
  units,
  specHref,
}: {
  items: RankedArea[];
  units: SpecUnitNode[];
  specHref: string;
}) {
  const shown = items.slice(0, CARD_LIMIT);
  if (shown.length === 0) return null;
  const byCode = codeIndex(units);
  return (
    <section aria-labelledby="strongest-heading" className="rounded-xl border border-ink/10 bg-snow p-5">
      <h2 id="strongest-heading" className="font-display text-lg font-medium tracking-tight">
        Strongest
      </h2>
      <ol className="mt-3 grid gap-3">
        {shown.map((item) => {
          const info = byCode.get(item.specCode);
          if (!info) return null;
          return (
            <Row key={item.specCode} specCode={item.specCode} info={info} specHref={specHref} action={null}>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-ink/65">
                <StateLabel state={item.facts.state} />
                <MasteryFigure facts={item.facts} />
              </p>
              <p className="mt-0.5 text-xs text-ink/60">{item.reason}</p>
            </Row>
          );
        })}
      </ol>
    </section>
  );
}

export function NeedsAttention({
  items,
  units,
  lessonBase,
  specHref,
}: {
  items: RankedArea[];
  units: SpecUnitNode[];
  lessonBase: string | null;
  specHref: string;
}) {
  const shown = items.slice(0, CARD_LIMIT);
  if (shown.length === 0) return null;
  const byCode = codeIndex(units);
  return (
    <section aria-labelledby="attention-heading" className="rounded-xl border border-ink/10 bg-snow p-5">
      <h2 id="attention-heading" className="font-display text-lg font-medium tracking-tight">
        Needs attention
      </h2>
      <ol className="mt-3 grid gap-3">
        {shown.map((item) => {
          const info = byCode.get(item.specCode);
          if (!info) return null;
          const trend = item.trend !== "insufficient-evidence" ? TREND_META[item.trend] : null;
          return (
            <Row
              key={item.specCode}
              specCode={item.specCode}
              info={info}
              specHref={specHref}
              action={<LessonAction info={info} lessonBase={lessonBase} verb="Practise" />}
            >
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-ink/65">
                <StateLabel state={item.facts.state} />
                {trend && (
                  <span className="font-mono text-[10px]" style={{ color: trend.tone }}>
                    {trend.label}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-ink/60">{item.reason}</p>
            </Row>
          );
        })}
      </ol>
    </section>
  );
}

export function RetrievalDue({
  items,
  units,
  lessonBase,
  specHref,
}: {
  items: RetrievalCandidate[];
  units: SpecUnitNode[];
  lessonBase: string | null;
  specHref: string;
}) {
  const shown = items.slice(0, CARD_LIMIT);
  if (shown.length === 0) return null;
  const byCode = codeIndex(units);
  return (
    <section aria-labelledby="retrieval-heading" className="rounded-xl border border-ink/10 bg-snow p-5">
      <h2 id="retrieval-heading" className="font-display text-lg font-medium tracking-tight">
        Worth revisiting
      </h2>
      <p className="mt-1 text-xs text-ink/55">
        Things you once showed well, ordered by how overdue a quick check is.
      </p>
      <ol className="mt-3 grid gap-3">
        {shown.map((item) => {
          const info = byCode.get(item.specCode);
          if (!info) return null;
          const meta = RETRIEVAL_META[item.retrievalState];
          return (
            <Row
              key={item.specCode}
              specCode={item.specCode}
              info={info}
              specHref={specHref}
              action={<LessonAction info={info} lessonBase={lessonBase} verb="Test my memory" />}
            >
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-ink/65">
                <span className="font-mono text-[10px]" style={{ color: meta.tone }}>
                  {meta.label}
                </span>
                <StateLabel state={item.masteryState} />
              </p>
              <p className="mt-0.5 text-xs text-ink/60">{item.reason}</p>
            </Row>
          );
        })}
      </ol>
    </section>
  );
}
