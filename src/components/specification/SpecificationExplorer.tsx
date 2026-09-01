"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";

import type {
  CourseMastery,
  SpecMasteryFacts,
  SpecMasteryState,
  SpecPointNode,
  SpecTopicNode,
  SpecUnitNode,
} from "@/lib/specification/types";
import { unstartedFacts } from "@/lib/specification/mastery";
import { MasteryGlyph, STATE_META, StateLabel } from "./mastery-meta";

/**
 * The interactive specification tree: search, filters, expand/collapse,
 * spec-point detail. Everything is computed from props — the server did the
 * reading and the mastery arithmetic; this component only decides what is
 * VISIBLE. At today's scale (tens of points) that is instant; at thousands it
 * stays a single pass over an in-memory array per keystroke, with detail
 * bodies rendered only when open.
 *
 * ⚠ FILTERS AND SEARCH COMPOSE. A filter that ignored the query (or the
 * reverse) would show a student "secure" points they did not search for and
 * call it their result.
 *
 * URL state: q / unit / state / point are mirrored into the query string with
 * history.replaceState, so a filtered view survives refresh and can be shared
 * — without a router navigation (and a server re-read) per keystroke.
 */

type StateFilter = "all" | "needs-revision" | SpecMasteryState;

const FILTERS: { value: StateFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "needs-revision", label: "Needs revision" },
  { value: "unstarted", label: STATE_META.unstarted.label },
  { value: "insufficient", label: STATE_META.insufficient.label },
  { value: "emerging", label: STATE_META.emerging.label },
  { value: "developing", label: STATE_META.developing.label },
  { value: "secure", label: STATE_META.secure.label },
];

function matchesFilter(state: SpecMasteryState, filter: StateFilter): boolean {
  if (filter === "all") return true;
  if (filter === "needs-revision") return state === "emerging" || state === "developing";
  return state === filter;
}

function matchesQuery(p: SpecPointNode, topicName: string, q: string): boolean {
  return (
    p.code.toLowerCase().includes(q) ||
    (p.title ?? "").toLowerCase().includes(q) ||
    p.description.toLowerCase().includes(q) ||
    topicName.toLowerCase().includes(q)
  );
}

/** The matched fragment, marked. Plain text in, so an index split is safe. */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const at = text.toLowerCase().indexOf(query);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-sm bg-signal/50 text-ink">{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  );
}

export function SpecificationExplorer({
  units,
  mastery,
  lessonBase,
  initial,
}: {
  units: SpecUnitNode[];
  /** null when signed out — the tree renders with no state column at all. */
  mastery: CourseMastery | null;
  /** "/learn/<subject>/<pathway>/<course>" — where a live lesson opens. */
  lessonBase: string | null;
  initial: { q: string; unit: string; state: string; point: string };
}) {
  const [query, setQuery] = useState(initial.q);
  const [unitFilter, setUnitFilter] = useState(
    units.some((u) => u.id === initial.unit) ? initial.unit : "all",
  );
  const [stateFilter, setStateFilter] = useState<StateFilter>(
    FILTERS.some((f) => f.value === initial.state) && mastery
      ? (initial.state as StateFilter)
      : "all",
  );
  const [openTopics, setOpenTopics] = useState<Set<string>>(() => {
    // A deep-linked point arrives with its topic open.
    const t = units
      .flatMap((u) => u.topics)
      .find((t) => t.points.some((p) => p.code === initial.point));
    return new Set(t ? [t.id] : []);
  });
  const [openPoint, setOpenPoint] = useState<string | null>(initial.point || null);
  const deepLinkRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    deepLinkRef.current?.scrollIntoView({ block: "center" });
  }, []);

  // Mirror the view into the URL so refresh and share keep it.
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (unitFilter !== "all") params.set("unit", unitFilter);
    if (stateFilter !== "all") params.set("state", stateFilter);
    if (openPoint) params.set("point", openPoint);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [query, unitFilter, stateFilter, openPoint]);

  const factsOf = (code: string): SpecMasteryFacts =>
    mastery?.byCode[code] ?? unstartedFacts();

  const q = query.trim().toLowerCase();
  const filtering = q !== "" || stateFilter !== "all" || unitFilter !== "all";

  type VisibleTopic = { topic: SpecTopicNode; points: SpecPointNode[] };
  type VisibleUnit = { unit: SpecUnitNode; topics: VisibleTopic[] };

  const visible: VisibleUnit[] = useMemo(() => {
    return units
      .filter((u) => unitFilter === "all" || u.id === unitFilter)
      .map((u) => ({
        unit: u,
        topics: u.topics
          .map((t) => ({
            topic: t,
            points: t.points.filter(
              (p) =>
                (q === "" || matchesQuery(p, t.name, q)) &&
                (!mastery || matchesFilter(factsOf(p.code).state, stateFilter)),
            ),
          }))
          .filter((t) => t.points.length > 0 || (!filtering && t.topic.points.length === 0)),
      }))
      .filter((u) => u.topics.length > 0 || !filtering);
  }, [units, unitFilter, stateFilter, q, mastery, filtering]);

  const visiblePointCount = visible.reduce(
    (n, u) => n + u.topics.reduce((m, t) => m + t.points.length, 0),
    0,
  );

  const toggleTopic = (id: string) =>
    setOpenTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div>
      {/* ── Search + filters ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="relative max-w-md">
          <Search
            aria-hidden
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40"
          />
          <label htmlFor="spec-search" className="sr-only">
            Search the specification
          </label>
          <input
            id="spec-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the specification — try “mole” or “1.4”"
            /* text-base on a phone: Safari zooms a focused control under 16px
               and never zooms back (ios-safari.test.ts). */
            className="w-full rounded-lg border border-ink/15 bg-snow py-2.5 ps-9 pe-9 text-base text-ink placeholder:text-ink/40 focus:border-ink/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 md:text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute end-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-ink/50 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* State filters exist only when there is mastery to filter by. */}
        {mastery && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by mastery state">
            {FILTERS.map((f) => {
              const active = stateFilter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStateFilter(f.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink ${
                    active
                      ? "border-ink bg-ink text-parchment"
                      : "border-ink/15 bg-snow text-ink/70 hover:border-ink/35 hover:text-ink"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        )}

        {units.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor="spec-unit" className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/50">
              Unit
            </label>
            <select
              id="spec-unit"
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              /* min-w-0 + max-w-full: a select's intrinsic width is its longest
                 option, and unit names are long — without this it forces the
                 whole page to scroll sideways on a phone. */
              className="min-w-0 max-w-full rounded-lg border border-ink/15 bg-snow px-3 py-2 text-base text-ink focus:border-ink/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 md:text-sm"
            >
              <option value="all">All units</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code ? `${u.code} · ` : ""}
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Result summary / empty result ────────────────────────────────── */}
      {filtering && (
        <p className="mt-4 text-xs text-ink/55" role="status">
          {visiblePointCount === 0
            ? "No specification points match."
            : `${visiblePointCount} specification point${visiblePointCount === 1 ? "" : "s"} shown.`}
        </p>
      )}
      {filtering && visiblePointCount === 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-ink/15 bg-ink/[0.02] px-5 py-4">
          <p className="text-sm text-ink/70">
            Nothing in this specification matches that search and filter together.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setStateFilter("all");
              setUnitFilter("all");
            }}
            className="mt-2 text-sm underline underline-offset-4 hover:text-ink"
          >
            Clear search and filters
          </button>
        </div>
      )}

      {/* ── The tree ─────────────────────────────────────────────────────── */}
      <div className="mt-6 grid gap-10">
        {visible.map(({ unit, topics }) => (
          <section key={unit.id} aria-label={unit.name}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink/10 pb-2">
              <h3 className="font-display text-lg font-medium tracking-tight">
                {unit.code ? `${unit.code} · ` : ""}
                {unit.name}
              </h3>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
                {unit.topics.length === 0
                  ? "no topics mapped yet"
                  : `${unit.topics.length} topic${unit.topics.length === 1 ? "" : "s"}`}
              </p>
            </div>

            {topics.length === 0 && (
              <p className="mt-3 text-sm text-ink/55">
                The specification for this unit has not been mapped yet.
              </p>
            )}

            <ul className="mt-3 grid gap-2">
              {topics.map(({ topic, points }) => {
                const open = filtering || openTopics.has(topic.id);
                const topicFacts = mastery
                  ? mastery.byTopic[topic.id] ?? unstartedFacts()
                  : null;
                return (
                  <li key={topic.id} className="rounded-lg border border-ink/10 bg-snow">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={`topic-${topic.id}`}
                      onClick={() => toggleTopic(topic.id)}
                      disabled={filtering}
                      className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-start focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink disabled:cursor-default"
                    >
                      {topic.code && (
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--subject-text)]">
                          {topic.code}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 text-sm font-medium text-ink">
                        <Highlight text={topic.name} query={q} />
                      </span>
                      {topicFacts && topicFacts.state !== "unstarted" && (
                        <span className="text-xs text-ink/70">
                          <StateLabel state={topicFacts.state} />
                          <span className="ms-2 font-mono text-[10px] text-ink/45">
                            {topicFacts.awarded} of {topicFacts.outOf} marks
                          </span>
                        </span>
                      )}
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
                        {topic.points.length === 0
                          ? "not mapped yet"
                          : `${points.length}${filtering ? ` of ${topic.points.length}` : ""} point${topic.points.length === 1 ? "" : "s"}`}
                      </span>
                      {!filtering && topic.points.length > 0 && (
                        <ChevronDown
                          aria-hidden
                          className={`h-4 w-4 text-ink/40 transition-transform ${open ? "rotate-180" : ""}`}
                        />
                      )}
                    </button>

                    {open && points.length > 0 && (
                      <ul id={`topic-${topic.id}`} className="border-t border-ink/10">
                        {points.map((p) => (
                          <PointRow
                            key={p.id}
                            point={p}
                            facts={mastery ? factsOf(p.code) : null}
                            query={q}
                            open={openPoint === p.code}
                            onToggle={() =>
                              setOpenPoint((cur) => (cur === p.code ? null : p.code))
                            }
                            lessonBase={lessonBase}
                            anchorRef={initial.point === p.code ? deepLinkRef : undefined}
                          />
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function PointRow({
  point,
  facts,
  query,
  open,
  onToggle,
  lessonBase,
  anchorRef,
}: {
  point: SpecPointNode;
  facts: SpecMasteryFacts | null;
  query: string;
  open: boolean;
  onToggle: () => void;
  lessonBase: string | null;
  anchorRef?: React.Ref<HTMLLIElement>;
}) {
  const liveLessons = point.lessons.filter((l) => l.live);
  const draftLessons = point.lessons.filter((l) => !l.live);

  return (
    <li ref={anchorRef} className="border-b border-ink/5 last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`point-${point.id}`}
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-start transition-colors hover:bg-ink/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
      >
        <span className="font-mono w-8 shrink-0 text-[11px] text-[var(--subject-text)]">
          {point.code}
        </span>
        <span className="min-w-0 flex-1 text-sm text-ink">
          <Highlight text={point.title ?? point.description} query={query} />
        </span>
        {facts && (
          <span className="text-xs text-ink/70">
            <StateLabel state={facts.state} />
          </span>
        )}
        {facts && facts.outOf > 0 && (
          <span className="font-mono text-[10px] text-ink/45">
            {facts.awarded} of {facts.outOf}
          </span>
        )}
        <ChevronDown
          aria-hidden
          className={`h-3.5 w-3.5 text-ink/35 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div id={`point-${point.id}`} className="bg-ink/[0.02] px-4 pb-4 pt-3 sm:ps-[3.75rem]">
          {/* The specification statement, as the board words it. */}
          <p className="max-w-2xl text-sm leading-relaxed text-ink/80">
            <Highlight text={point.description} query={query} />
          </p>

          {point.commandTerms.length > 0 && (
            <p className="font-mono mt-2 text-[10px] uppercase tracking-[0.14em] text-ink/45">
              Command words: {point.commandTerms.join(" · ")}
            </p>
          )}

          {facts && (
            <div className="mt-3 text-xs text-ink/70">
              {facts.state === "unstarted" && (
                <p>{STATE_META.unstarted.blurb}</p>
              )}
              {facts.state === "insufficient" && (
                <p>
                  {facts.awarded} of {facts.outOf} mark{facts.outOf === 1 ? "" : "s"} so far —{" "}
                  {facts.marksShortOfFloor} more mark{facts.marksShortOfFloor === 1 ? "" : "s"} of
                  practice needed before this point can be rated.
                </p>
              )}
              {facts.state !== "unstarted" && facts.state !== "insufficient" && (
                <p>
                  {facts.awarded} of {facts.outOf} marks across {facts.questionCount} question
                  {facts.questionCount === 1 ? "" : "s"}.
                  {facts.lastPractisedAt &&
                    ` Last practised ${new Date(facts.lastPractisedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.`}
                </p>
              )}
            </div>
          )}

          {/* ⚠ REAL DESTINATIONS ONLY. A live lesson links; a written one is
              named with an honest note; nothing else renders a control. */}
          {(liveLessons.length > 0 || draftLessons.length > 0) && (
            <div className="mt-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
                Learn &amp; practise
              </p>
              <ul className="mt-1.5 grid gap-1">
                {liveLessons.map((l) => (
                  <li key={l.slug}>
                    {lessonBase ? (
                      <Link
                        href={`${lessonBase}/${l.slug}`}
                        /* -my/py: a comfortable hit area without moving the
                           layout — the Breadcrumb's own trick. */
                        className="-my-2.5 inline-block py-2.5 text-sm text-ink underline underline-offset-4 hover:text-ink/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                      >
                        {l.title}
                      </Link>
                    ) : (
                      <span className="text-sm text-ink/70">{l.title}</span>
                    )}
                  </li>
                ))}
                {draftLessons.map((l) => (
                  <li key={l.slug} className="text-sm text-ink/50">
                    {l.title}{" "}
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
                      · not published yet
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
