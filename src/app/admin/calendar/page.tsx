import { WEEKDAY_OPTIONS } from "@/lib/admin/schedule-form";
import { loadCalendar } from "@/lib/schedule/readers";
import { CANONICAL_TZ, formatDay, formatTime } from "@/lib/schedule/timezone";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  PeriodActions, PeriodForm, RuleActions, RuleForm, SessionActions, SessionForm,
  type CohortOption, type PeriodValue, type RuleOption, type RuleValue, type SessionValue,
} from "./_forms";

/**
 * The admin calendar (§6–§9).
 *
 * ⚠ SERVICE ROLE, AND THAT IS THE POINT OF AN ADMIN SCREEN: it shows paused
 * rules, private cohorts and cancelled lessons — everything the public policies
 * hide. Who may see it is decided by /admin/layout.tsx and the proxy, and every
 * action re-checks with assertAdmin(); nothing here weakens a policy.
 *
 * ⚠ THE PREVIEW IS THE REAL ENGINE, NOT A MOCK-UP. "Next 8 weeks" is rendered
 * by the same loadCalendar() the homepage and /calendar use, so what an admin
 * sees here after an edit is literally what a visitor will see. A separate
 * admin-only expansion would be a second implementation of the one thing §5
 * says must have only one.
 */
export const dynamic = "force-dynamic";

const WEEKDAY_LABEL = new Map(WEEKDAY_OPTIONS.map((w) => [w.value, w.label]));

function isoPlusDays(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * ⚠ WHICH ROW IS BEING EDITED LIVES IN THE URL, NOT IN CLIENT STATE (§19).
 * The page is server-rendered from the database, so an edit form opened from a
 * `?edit=` link is pre-filled with the row as it is RIGHT NOW rather than with
 * whatever was on screen when the page loaded. It also survives a reload, is
 * linkable, and works with no JavaScript — the same reasons the public calendar
 * keeps its view and date in the URL.
 */
type Search = Promise<{ edit?: string }>;

export default async function AdminCalendarPage({ searchParams }: { searchParams: Search }) {
  const editing = (await searchParams).edit ?? null;
  const db = createAdminClient();

  // Every cohort, not just public ones — an admin builds a timetable before
  // publishing the class.
  const cohortsRes = await db.from("cohorts").select("id,slug,title,is_public").order("display_order");
  const cohorts = (cohortsRes.data ?? []) as unknown as (CohortOption & { is_public: boolean })[];

  const rulesRes = await db
    .from("cohort_schedules")
    .select("id,cohort_id,weekday,start_time,end_time,timezone,valid_from,valid_until,label,is_active")
    .order("weekday");
  const periodsRes = await db
    .from("schedule_periods").select("id,cohort_id,starts_on,ends_on,reason").order("starts_on");
  const sessionsRes = await db
    .from("tuition_sessions")
    .select("id,cohort_id,schedule_id,occurs_on,status,kind,title,starts_at,ends_at,timezone,note")
    .order("occurs_on");

  const dbError = cohortsRes.error ?? rulesRes.error ?? periodsRes.error ?? sessionsRes.error;
  const notMigrated =
    dbError && ["PGRST205", "42P01", "PGRST204", "42703"].includes(dbError.code ?? "");

  const rules = (rulesRes.data ?? []) as unknown as {
    id: string; cohort_id: string; weekday: number; start_time: string; end_time: string;
    timezone: string; valid_from: string; valid_until: string | null; label: string | null; is_active: boolean;
  }[];
  const periods = (periodsRes.data ?? []) as unknown as {
    id: string; cohort_id: string | null; starts_on: string; ends_on: string; reason: string;
  }[];
  const sessions = (sessionsRes.data ?? []) as unknown as {
    id: string; cohort_id: string; schedule_id: string | null; occurs_on: string;
    status: string; kind: string; title: string | null; note: string | null;
    timezone: string | null; starts_at: string | null; ends_at: string | null;
  }[];

  const titleOf = (id: string | null) =>
    id === null ? "All cohorts" : cohorts.find((c) => c.id === id)?.title ?? "(unknown cohort)";

  const ruleOptions: RuleOption[] = rules.map((r) => ({
    id: r.id,
    label: `${titleOf(r.cohort_id)} — ${WEEKDAY_LABEL.get(r.weekday as never) ?? r.weekday} ${r.start_time.slice(0, 5)}`,
  }));

  const editRule = rules.find((r) => r.id === editing) ?? null;
  const editPeriod = periods.find((p) => p.id === editing) ?? null;
  const editSession = sessions.find((x) => x.id === editing) ?? null;

  /**
   * ⚠ RENDERED BACK IN THE ROW'S OWN ZONE, NOT THE SERVER'S. starts_at is a
   * timestamptz; formatting it with toISOString() would pre-fill the form with
   * UTC, and an admin in Doha pressing Save on an unchanged form would move the
   * lesson three hours. The zone stored on the row is the one it was typed in.
   */
  const localTime = (iso: string | null, tz: string | null): string | null =>
    iso === null ? null : formatTime(new Date(iso), tz ?? CANONICAL_TZ);

  const sessionValue = (x: typeof sessions[number]): SessionValue => ({
    id: x.id, cohort_id: x.cohort_id, schedule_id: x.schedule_id, occurs_on: x.occurs_on,
    status: x.status, kind: x.kind, title: x.title, note: x.note, timezone: x.timezone,
    starts_local: localTime(x.starts_at, x.timezone),
    ends_local: localTime(x.ends_at, x.timezone),
  });

  // ⚠ THE SAME READER EVERY PUBLIC PAGE USES.
  const preview = await loadCalendar({ from: isoPlusDays(0), to: isoPlusDays(56), includeCancelled: true });

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl font-medium">Calendar</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        A recurring timetable per cohort, plus individual changes on top of it. Editing one
        lesson never edits the series, and a break never edits the rule.
      </p>

      {dbError && (
        <p role="alert" className="mt-6 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {notMigrated
            ? "Migration 0044 has not been applied yet, so the schedule tables do not exist. Nothing on this screen can be saved until it is run — the public calendar is running on the published AS timetable in code until then."
            : "Could not load the schedule."}{" "}
          <span className="font-mono text-[11px]">{dbError.code}: {dbError.message}</span>
        </p>
      )}

      <Section title="Recurring timetable" subtitle="The rule. One row covers a whole term.">
        {editRule ? <RuleForm cohorts={cohorts} rule={editRule as RuleValue} /> : <RuleForm cohorts={cohorts} />}
        <List empty="No recurring timetable yet.">
          {rules.filter((r) => r.id !== editing).map((r) => (
            <Row key={r.id}
              head={`${titleOf(r.cohort_id)} — ${WEEKDAY_LABEL.get(r.weekday as never) ?? `weekday ${r.weekday}`}`}
              meta={`${r.start_time.slice(0, 5)}–${r.end_time.slice(0, 5)} ${r.timezone} · from ${r.valid_from}${r.valid_until ? ` until ${r.valid_until}` : " (open-ended)"}${r.is_active ? "" : " · paused"}`}
              actions={<><EditLink id={r.id} /><RuleActions id={r.id} isActive={r.is_active} /></>} />
          ))}
        </List>
      </Section>

      <Section title="Breaks and holidays" subtitle="Cancels every lesson inside the dates, without touching the rule.">
        {editPeriod ? <PeriodForm cohorts={cohorts} period={editPeriod as PeriodValue} /> : <PeriodForm cohorts={cohorts} />}
        <List empty="No breaks.">
          {periods.filter((p) => p.id !== editing).map((p) => (
            <Row key={p.id} head={p.reason}
              meta={`${titleOf(p.cohort_id)} · ${p.starts_on} → ${p.ends_on}`}
              actions={<><EditLink id={p.id} /><PeriodActions id={p.id} /></>} />
          ))}
        </List>
      </Section>

      <Section title="Individual lessons" subtitle="Move one, cancel one, or add a clinic, mock or onboarding.">
        {editSession
          ? <SessionForm cohorts={cohorts} rules={ruleOptions} session={sessionValue(editSession)} />
          : <SessionForm cohorts={cohorts} rules={ruleOptions} />}
        <List empty="No individual changes.">
          {sessions.filter((x) => x.id !== editing).map((s) => (
            <Row key={s.id}
              head={s.title ?? (s.schedule_id ? "Changed lesson" : "One-off session")}
              meta={`${titleOf(s.cohort_id)} · ${s.occurs_on} · ${s.kind} · ${s.status}${s.note ? ` · ${s.note}` : ""}`}
              actions={<><EditLink id={s.id} /><SessionActions id={s.id} restores={s.schedule_id !== null} /></>} />
          ))}
        </List>
      </Section>

      <Section title="Next 8 weeks" subtitle="Rendered by the same reader the public pages use — this is what visitors will see.">
        {preview.source === "fallback" && (
          <p className="mb-3 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            Showing the published AS timetable from code, because the database has no schedule rows yet.
            {preview.reason && <span className="ml-1 font-mono">({preview.reason})</span>}
          </p>
        )}
        {preview.refusals.length > 0 && (
          <p className="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {preview.refusals.length} row(s) refused: {preview.refusals.slice(0, 3).join("; ")}
            {preview.refusals.length > 3 ? " …" : ""}
          </p>
        )}
        <List empty="No sessions in the next 8 weeks.">
          {preview.sessions.map((s) => (
            <Row key={s.key}
              head={`${formatDay(s.startsAt, CANONICAL_TZ)} · ${s.cohort.title}`}
              meta={`${formatTime(s.startsAt, CANONICAL_TZ)}–${formatTime(s.endsAt, CANONICAL_TZ)} Doha · ${s.kind} · ${s.source}${s.status === "cancelled" ? ` · CANCELLED${s.cancelledReason ? ` (${s.cancelledReason})` : ""}` : ""}`}
              actions={null} />
          ))}
        </List>
      </Section>
    </div>
  );
}

/**
 * ⚠ A LINK, NOT A BUTTON. Opening an edit form is navigation, not an action:
 * it is safe to bookmark, safe to reload, and needs no JavaScript. Only the
 * save is a mutation.
 */
function EditLink({ id }: { id: string }) {
  return (
    <a
      href={`?edit=${id}`}
      className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-slate-500"
    >
      Edit
    </a>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="font-display text-lg font-medium">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      <div className="mt-5 space-y-6">{children}</div>
    </section>
  );
}

function List({ children, empty }: { children: React.ReactNode[]; empty: string }) {
  if (children.length === 0) return <p className="text-sm text-slate-600">{empty}</p>;
  return <ul className="space-y-2">{children}</ul>;
}

function Row({ head, meta, actions }: { head: string; meta: string; actions: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-start gap-3 rounded border border-slate-200 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">{head}</p>
        <p className="mt-0.5 font-mono text-[11px] text-slate-500">{meta}</p>
      </div>
      {actions}
    </li>
  );
}
