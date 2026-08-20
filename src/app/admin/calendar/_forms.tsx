"use client";

import { useActionState } from "react";
import { useState, useTransition } from "react";

import { SESSION_KINDS, WEEKDAY_OPTIONS } from "@/lib/admin/schedule-form";

import {
  createPeriod, createRule, createSession,
  deletePeriod, deleteRule, deleteSession, setRuleActive,
  updatePeriod, updateRule, updateSession,
} from "./actions";

type Result = { ok: true } | { ok: false; error: string };

const input =
  "mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none";

export type CohortOption = { id: string; slug: string; title: string };
export type RuleOption = { id: string; label: string };

/**
 * ============================================================================
 * ⚠ ONE FORM PER THING, USED FOR BOTH ADD AND EDIT (§19)
 * ============================================================================
 * Each form below takes an optional existing row. Present, it binds the update
 * action and pre-fills; absent, it binds create. A separate EditRuleForm would
 * be a second statement of what fields a rule has, and the copy that drifts is
 * always the one fewer people look at — the same argument the server actions
 * make for sharing readRuleForm() between create and update.
 */
export type RuleValue = {
  id: string; cohort_id: string; weekday: number; start_time: string; end_time: string;
  timezone: string; valid_from: string; valid_until: string | null;
  label: string | null; is_active: boolean;
};
export type PeriodValue = {
  id: string; cohort_id: string | null; starts_on: string; ends_on: string; reason: string;
};
export type SessionValue = {
  id: string; cohort_id: string; schedule_id: string | null; occurs_on: string;
  status: string; kind: string; title: string | null; note: string | null;
  timezone: string | null; starts_local: string | null; ends_local: string | null;
};

/** Cancels an edit without submitting it. A plain link, so it works with no JS. */
function CancelEdit() {
  return (
    <a href="?" className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600">
      Cancel
    </a>
  );
}

function Feedback({ state }: { state: Result | null }) {
  if (!state) return null;
  return state.ok ? (
    <p className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Saved.</p>
  ) : (
    <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{state.error}</p>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

// ── recurring timetable ─────────────────────────────────────────────────────

export function RuleForm({ cohorts, rule }: { cohorts: CohortOption[]; rule?: RuleValue }) {
  const [state, submit, pending] = useActionState<Result | null, FormData>(
    rule ? updateRule.bind(null, rule.id) : createRule, null,
  );
  return (
    <form action={submit} className="space-y-4">
      <Feedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cohort">
          <select name="cohort_id" required defaultValue={rule?.cohort_id ?? ""} className={input}>
            <option value="" disabled>Choose…</option>
            {cohorts.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </Field>
        <Field label="Weekday">
          <select name="weekday" required defaultValue={String(rule?.weekday ?? 2)} className={input}>
            {WEEKDAY_OPTIONS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </Field>
        <Field label="Starts" hint="24-hour, in the timezone below.">
          <input name="start_time" type="time" required defaultValue={rule?.start_time.slice(0, 5) ?? "19:00"} className={input} />
        </Field>
        <Field label="Ends">
          <input name="end_time" type="time" required defaultValue={rule?.end_time.slice(0, 5) ?? "21:30"} className={input} />
        </Field>
        <Field label="Timezone" hint="The school teaches in Asia/Qatar. Change only for a cohort taught elsewhere.">
          <input name="timezone" defaultValue={rule?.timezone ?? "Asia/Qatar"} className={input} />
        </Field>
        <Field label="Label" hint="Optional. Shown instead of the cohort name.">
          <input name="label" defaultValue={rule?.label ?? ""} placeholder="Teaching session" className={input} />
        </Field>
        <Field label="From">
          <input name="valid_from" type="date" required defaultValue={rule?.valid_from ?? ""} className={input} />
        </Field>
        <Field label="Until" hint="Leave blank for open-ended.">
          <input name="valid_until" type="date" defaultValue={rule?.valid_until ?? ""} className={input} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="is_active" defaultChecked={rule ? rule.is_active : true} className="h-4 w-4" />
        Active
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40">
          {pending ? "Saving…" : rule ? "Save changes" : "Add recurring timetable"}
        </button>
        {rule && <CancelEdit />}
      </div>
      {/* ⚠ WHY EDITING MATTERS, WHERE THE ADMIN IS STANDING. Delete-and-recreate
          looks equivalent and is not: 0044's FK cascades, so it discards every
          individual change made to this series. */}
      {rule && (
        <p className="text-[11px] text-slate-500">
          Editing keeps every individual lesson change attached to this series. Deleting and
          re-adding it would discard them.
        </p>
      )}
    </form>
  );
}

// ── holidays ────────────────────────────────────────────────────────────────

export function PeriodForm({ cohorts, period }: { cohorts: CohortOption[]; period?: PeriodValue }) {
  const [state, submit, pending] = useActionState<Result | null, FormData>(
    period ? updatePeriod.bind(null, period.id) : createPeriod, null,
  );
  return (
    <form action={submit} className="space-y-4">
      <Feedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Applies to" hint="All cohorts is a school closure.">
          <select name="cohort_id" defaultValue={period?.cohort_id ?? ""} className={input}>
            <option value="">All cohorts</option>
            {cohorts.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </Field>
        <Field label="Reason" hint="Shown publicly in place of the lesson.">
          <input name="reason" required defaultValue={period?.reason ?? ""} placeholder="Winter break" className={input} />
        </Field>
        <Field label="From">
          <input name="starts_on" type="date" required defaultValue={period?.starts_on ?? ""} className={input} />
        </Field>
        <Field label="Until" hint="Inclusive.">
          <input name="ends_on" type="date" required defaultValue={period?.ends_on ?? ""} className={input} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40">
          {pending ? "Saving…" : period ? "Save changes" : "Add break"}
        </button>
        {period && <CancelEdit />}
      </div>
    </form>
  );
}

// ── one lesson: move, cancel, or add ────────────────────────────────────────

export function SessionForm({
  cohorts, rules, session,
}: {
  cohorts: CohortOption[]; rules: RuleOption[]; session?: SessionValue;
}) {
  const [state, submit, pending] = useActionState<Result | null, FormData>(
    session ? updateSession.bind(null, session.id) : createSession, null,
  );
  const [scheduleId, setScheduleId] = useState(session?.schedule_id ?? "");
  const [status, setStatus] = useState(session?.status ?? "scheduled");
  // A one-off needs times; an override of an existing rule does not, and a
  // cancellation never does. Mirrors the server rule so the admin is told
  // before they submit rather than after.
  const needsTimes = scheduleId === "" && status === "scheduled";

  return (
    <form action={submit} className="space-y-4">
      <Feedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cohort">
          <select name="cohort_id" required defaultValue={session?.cohort_id ?? ""} className={input}>
            <option value="" disabled>Choose…</option>
            {cohorts.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </Field>
        <Field label="Changes which lesson?" hint="“A new session” adds one that no timetable produces — a clinic, a mock, onboarding.">
          <select name="schedule_id" value={scheduleId} onChange={(e) => setScheduleId(e.target.value)} className={input}>
            <option value="">A new session (one-off)</option>
            {rules.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </Field>
        <Field label="Date">
          <input name="occurs_on" type="date" required defaultValue={session?.occurs_on ?? ""} className={input} />
        </Field>
        <Field label="What is happening">
          <select name="status" value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
            <option value="scheduled">Goes ahead (move / add)</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>
        <Field label="Kind">
          <select name="kind" defaultValue={session?.kind ?? "teaching"} className={input}>
            {SESSION_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </Field>
        <Field label="Timezone">
          <input name="timezone" defaultValue={session?.timezone ?? "Asia/Qatar"} className={input} />
        </Field>
        {/* ⚠ THE TIMES ARE THE STORED INSTANT RENDERED BACK IN THE ROW'S OWN
            ZONE, not in the browser's. Pre-filling a 19:00 Doha lesson as
            "16:00" for a London admin and then saving it would move the lesson
            three hours every time somebody opened the form and pressed Save. */}
        <Field label="Starts" hint={needsTimes ? "Required for a one-off." : "Leave blank to keep the timetable's time."}>
          <input name="starts_at_local" type="time" required={needsTimes} defaultValue={session?.starts_local ?? ""} className={input} />
        </Field>
        <Field label="Ends">
          <input name="ends_at_local" type="time" required={needsTimes} defaultValue={session?.ends_local ?? ""} className={input} />
        </Field>
        <Field label="Title">
          <input name="title" defaultValue={session?.title ?? ""} placeholder="Revision clinic" className={input} />
        </Field>
        <Field label="Note" hint="Shown as the reason when cancelled.">
          <input name="note" defaultValue={session?.note ?? ""} className={input} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40">
          {pending ? "Saving…" : session ? "Save changes" : "Save session change"}
        </button>
        {session && <CancelEdit />}
      </div>
    </form>
  );
}

// ── row actions ─────────────────────────────────────────────────────────────

export function RuleActions({ id, isActive }: { id: string; isActive: boolean }) {
  return (
    <Confirmable
      id={id}
      toggle={{ on: isActive, run: (next) => setRuleActive(id, next) }}
      remove={() => deleteRule(id)}
      removeLabel="Delete series"
      // ⚠ SAID OUT LOUD. 0044's FK cascades, so deleting a rule discards every
      // individual edit made to its lessons.
      removeWarning="Deleting this timetable also deletes every individual change made to its lessons. Continue?"
    />
  );
}

export function PeriodActions({ id }: { id: string }) {
  return <Confirmable id={id} remove={() => deletePeriod(id)} removeLabel="Delete break" removeWarning="Delete this break?" />;
}

export function SessionActions({ id, restores }: { id: string; restores: boolean }) {
  return (
    <Confirmable
      id={id}
      remove={() => deleteSession(id)}
      removeLabel={restores ? "Undo — restore the lesson" : "Delete session"}
      removeWarning={
        restores
          ? "This puts the lesson back on the timetable. Continue?"
          : "Delete this session?"
      }
    />
  );
}

function Confirmable({
  toggle, remove, removeLabel, removeWarning,
}: {
  id: string;
  toggle?: { on: boolean; run: (next: boolean) => Promise<Result> };
  remove: () => Promise<Result>;
  removeLabel: string;
  removeWarning: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error);
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {toggle && (
        <button
          type="button" disabled={pending} onClick={() => run(() => toggle.run(!toggle.on))}
          className={`rounded border px-2.5 py-1 text-xs disabled:opacity-40 ${
            toggle.on ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-slate-700"
          }`}
        >
          {toggle.on ? "Active" : "Paused"}
        </button>
      )}
      {confirming ? (
        <>
          <span className="text-xs text-red-800">{removeWarning}</span>
          <button type="button" disabled={pending} onClick={() => run(remove)}
            className="rounded border border-red-600 bg-red-600 px-2.5 py-1 text-xs text-white disabled:opacity-40">
            Yes
          </button>
          <button type="button" onClick={() => setConfirming(false)}
            className="rounded border border-slate-300 px-2.5 py-1 text-xs">Cancel</button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirming(true)}
          className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600">{removeLabel}</button>
      )}
      {error && <span className="text-xs text-red-800">{error}</span>}
    </div>
  );
}
