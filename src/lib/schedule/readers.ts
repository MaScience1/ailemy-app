import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Cohort } from "@/lib/public/catalogue";
import { loadCohorts } from "@/lib/public/readers";

import { AS_COHORT_SLUG, FALLBACK_PERIODS, FALLBACK_OVERRIDES, fallbackRules } from "./fallback.ts";
import {
  expandSchedule,
  type IsoWeekday, type Occurrence, type SchedulePeriod, type ScheduleRule, type SessionKind,
  type SessionOverride, type SessionStatus,
} from "./recurrence.ts";
import { CANONICAL_TZ } from "./timezone.ts";

/**
 * THE one schedule source (§5).
 *
 * ============================================================================
 * ⚠ EVERY SURFACE READS THIS. THAT IS THE WHOLE POINT OF THE PHASE.
 * ============================================================================
 * The homepage preview, /calendar, /tuition, the three subject pages and the
 * admin calendar all call loadCalendar(). None of them holds a time, a weekday
 * or a date of its own. Change Tuesday 19:00 to 19:30 in one place and every
 * one of them moves — which is §5's requirement stated as an architecture
 * rather than as a promise.
 *
 * ⚠ READS AS anon, LIKE THE REST OF THE PUBLIC LAYER. 0044's policies are what
 * decide which sessions a visitor may see, and reading with a key that bypasses
 * RLS would show the founder rows a real visitor cannot — right on the page
 * whose correctness only a signed-out person can check.
 *
 * ⚠ FALLBACK IS PER-COHORT, NOT ALL-OR-NOTHING. If the database has rules for
 * the AS cohort we use them; if it has none at all we fall back to the one
 * published timetable that exists today. What we never do is manufacture rules
 * for Y11 or Y10, in either path.
 */

const NOT_MIGRATED = new Set(["PGRST205", "PGRST204", "42P01", "42703"]);

function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type CalendarSession = Occurrence & { cohort: Cohort };

export type CalendarLoad = {
  sessions: CalendarSession[];
  /** "database" once 0044 is applied and rules exist; "fallback" until then. */
  source: "database" | "fallback";
  reason?: string;
  /** Rows the mappers refused, travelling with the result rather than logged away. */
  refusals: string[];
};

export type CalendarQuery = {
  /** Inclusive "YYYY-MM-DD" window. Callers must bound it — §67. */
  from: string;
  to: string;
  /** Subject slug filter, applied to the cohort. */
  subject?: string;
  /** Cohort slug filter, for a single-cohort page. */
  cohortSlug?: string;
  /**
   * ⚠ COHORTS THE VIEWER IS ENROLLED ON. Supplied by loadMyTuition from that
   * viewer's own cohort_enrolments rows. Without it a non-public cohort is
   * absent from the catalogue read, `scoped` comes back empty, and the
   * student's calendar renders "no cohorts match the query" — blank, for
   * somebody who has paid, with nothing on screen linking it to is_public.
   */
  entitledSlugs?: readonly string[];
  includeCancelled?: boolean;
};

const WEEKDAYS = new Set([1, 2, 3, 4, 5, 6, 7]);
const KINDS = new Set<SessionKind>(["teaching", "onboarding", "revision", "mock", "clinic"]);

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : null;

/** "19:00:00" from Postgres `time` → "19:00". Refuses anything else. */
function hhmm(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const m = /^(\d{2}):(\d{2})/.exec(s);
  return m ? `${m[1]}:${m[2]}` : null;
}

function ruleFromRow(row: Record<string, unknown>): ScheduleRule | string {
  const id = str(row.id);
  if (!id) return "schedule rule with no id";
  const cohortId = str(row.cohort_id);
  if (!cohortId) return `${id}: no cohort_id`;
  const weekday = Number(row.weekday);
  if (!WEEKDAYS.has(weekday)) return `${id}: weekday ${JSON.stringify(row.weekday)} is not 1–7`;
  const startTime = hhmm(row.start_time);
  const endTime = hhmm(row.end_time);
  if (!startTime || !endTime) return `${id}: unreadable start/end time`;
  const validFrom = str(row.valid_from);
  if (!validFrom) return `${id}: no valid_from`;
  return {
    id, cohortId, weekday: weekday as IsoWeekday, startTime, endTime,
    // ⚠ CANONICAL, NEVER THE SERVER'S ZONE. A NULL timezone column means the
    // school's own zone, not "wherever this process happens to run".
    timezone: str(row.timezone) ?? CANONICAL_TZ,
    validFrom,
    validUntil: str(row.valid_until),
    label: str(row.label),
    isActive: row.is_active !== false,
  };
}

function periodFromRow(row: Record<string, unknown>): SchedulePeriod | string {
  const id = str(row.id);
  if (!id) return "break with no id";
  const startsOn = str(row.starts_on);
  const endsOn = str(row.ends_on);
  if (!startsOn || !endsOn) return `${id}: incomplete period`;
  if (endsOn < startsOn) return `${id}: ends before it starts`;
  return { id, cohortId: str(row.cohort_id), startsOn, endsOn, reason: str(row.reason) ?? "No class" };
}

function overrideFromRow(row: Record<string, unknown>): SessionOverride | string {
  const id = str(row.id);
  if (!id) return "session with no id";
  const cohortId = str(row.cohort_id);
  if (!cohortId) return `${id}: no cohort_id`;
  const occursOn = str(row.occurs_on);
  if (!occursOn) return `${id}: no occurs_on`;
  const kind = str(row.kind) as SessionKind | null;
  if (!kind || !KINDS.has(kind)) return `${id}: kind ${JSON.stringify(row.kind)} is not recognised`;
  const status = str(row.status);
  if (status !== "scheduled" && status !== "cancelled") return `${id}: status ${JSON.stringify(status)}`;
  return {
    id, cohortId,
    scheduleId: str(row.schedule_id),
    occursOn,
    status: status as SessionStatus,
    kind,
    title: str(row.title),
    startsAtISO: str(row.starts_at),
    endsAtISO: str(row.ends_at),
    timezone: str(row.timezone),
    note: str(row.note),
  };
}

export async function loadCalendar(q: CalendarQuery): Promise<CalendarLoad> {
  const { data: cohorts } = await loadCohorts({ entitledSlugs: q.entitledSlugs });
  const byId = new Map(cohorts.map((c) => [c.slug, c]));

  const scoped = cohorts.filter(
    (c) => (!q.subject || c.subject === q.subject) && (!q.cohortSlug || c.slug === q.cohortSlug),
  );
  if (scoped.length === 0) {
    return { sessions: [], source: "fallback", reason: "no cohorts match the query", refusals: [] };
  }

  const db = anonClient();
  const refusals: string[] = [];
  let rules: ScheduleRule[] = [];
  let periods: SchedulePeriod[] = [];
  let overrides: SessionOverride[] = [];
  let source: CalendarLoad["source"] = "database";
  let reason: string | undefined;

  if (!db) {
    source = "fallback";
    reason = "supabase env vars absent";
  } else {
    const [r, p, o] = await Promise.all([
      db.from("cohort_schedules").select("id,cohort_id,weekday,start_time,end_time,timezone,valid_from,valid_until,label,is_active"),
      db.from("schedule_periods").select("id,cohort_id,starts_on,ends_on,reason"),
      db.from("tuition_sessions").select("id,cohort_id,schedule_id,occurs_on,status,kind,title,starts_at,ends_at,timezone,note")
        .gte("occurs_on", q.from).lte("occurs_on", q.to),
    ]);

    const failed = [r.error, p.error, o.error].find(Boolean);
    if (failed) {
      source = "fallback";
      reason = NOT_MIGRATED.has(failed.code ?? "")
        ? `0044 not applied (${failed.code}: ${failed.message})`
        : `${failed.code}: ${failed.message}`;
    } else {
      for (const row of (r.data ?? []) as unknown as Record<string, unknown>[]) {
        const m = ruleFromRow(row); typeof m === "string" ? refusals.push(m) : rules.push(m);
      }
      for (const row of (p.data ?? []) as unknown as Record<string, unknown>[]) {
        const m = periodFromRow(row); typeof m === "string" ? refusals.push(m) : periods.push(m);
      }
      for (const row of (o.data ?? []) as unknown as Record<string, unknown>[]) {
        const m = overrideFromRow(row); typeof m === "string" ? refusals.push(m) : overrides.push(m);
      }
      // ⚠ NO RULES AND NO SESSIONS AT ALL means nobody has built a timetable
      // yet, not that the school has none. Zero rows for a SPECIFIC cohort is a
      // real answer and is left alone — that is Y11 and Y10.
      if (rules.length === 0 && overrides.length === 0) {
        source = "fallback";
        reason = "no schedule rows yet";
      }
    }
  }

  if (source === "fallback") {
    const as = byId.get(AS_COHORT_SLUG);
    rules = as ? fallbackRules(as.slug) : [];
    periods = [...FALLBACK_PERIODS];
    overrides = [...FALLBACK_OVERRIDES];
  }

  // Cohort identity: DB rules key on cohorts.id, the fallback keys on slug.
  // Both are resolved against the same cohort list here, so a session can never
  // be rendered without the cohort it belongs to.
  const cohortKey = new Map<string, Cohort>();
  for (const c of scoped) { cohortKey.set(c.slug, c); }
  const idToSlug = new Map<string, string>();
  if (source === "database") {
    /**
       * ⚠ THE SECOND is_public FILTER — the one that would have survived a fix
       * applied only to loadCohorts. This map turns a rule's cohort_id into a
       * slug; a cohort missing from it resolves to undefined and its sessions
       * are dropped even though the cohort itself loaded fine. Both filters had
       * to move together, or the bug looks fixed and stays.
       */
      const entitled = (q.entitledSlugs ?? []).filter((x) => /^[a-z0-9-]+$/.test(x));
      const idRows = await db!.from("cohorts").select("id,slug").or(
        entitled.length > 0
          ? `is_public.eq.true,slug.in.(${entitled.join(",")})`
          : "is_public.eq.true",
      );
    for (const row of (idRows.data ?? []) as unknown as { id: string; slug: string }[]) {
      idToSlug.set(row.id, row.slug);
    }
  }
  const resolve = (cohortId: string): Cohort | undefined =>
    cohortKey.get(source === "database" ? idToSlug.get(cohortId) ?? "" : cohortId);

  const wanted = new Set(scoped.map((c) => (source === "database"
    ? [...idToSlug.entries()].find(([, s]) => s === c.slug)?.[0] ?? c.slug
    : c.slug)));

  const occurrences = expandSchedule({
    rules: rules.filter((r) => wanted.has(r.cohortId)),
    periods,
    overrides: overrides.filter((o) => wanted.has(o.cohortId)),
    from: q.from, to: q.to,
    includeCancelled: q.includeCancelled ?? true,
  });

  const sessions: CalendarSession[] = [];
  for (const o of occurrences) {
    const cohort = resolve(o.cohortId);
    // ⚠ A SESSION WITH NO RESOLVABLE COHORT IS DROPPED AND REPORTED, never
    // rendered with a blank title. It would mean a private or deleted cohort
    // leaked a session into a public read.
    if (!cohort) { refusals.push(`session ${o.key}: no public cohort ${o.cohortId}`); continue; }
    sessions.push({ ...o, cohort });
  }

  return { sessions, source, reason, refusals };
}
