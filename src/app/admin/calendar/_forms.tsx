"use client";

import { useActionState } from "react";
import { useState, useTransition } from "react";

import { SESSION_KINDS, WEEKDAY_OPTIONS } from "@/lib/admin/schedule-form";

import {
  createPeriod, createRule, createSession,
  deletePeriod, deleteRule, deleteSession, setRuleActive,
} from "./actions";

type Result = { ok: true } | { ok: false; error: string };

const input =
  "mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none";

export type CohortOption = { id: string; slug: string; title: string };
export type RuleOption = { id: string; label: string };

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

export function RuleForm({ cohorts }: { cohorts: CohortOption[] }) {
  const [state, submit, pending] = useActionState<Result | null, FormData>(createRule, null);
  return (
    <form action={submit} className="space-y-4">
      <Feedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cohort">
          <select name="cohort_id" required defaultValue="" className={input}>
            <option value="" disabled>Choose…</option>
            {cohorts.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </Field>
        <Field label="Weekday">
          <select name="weekday" required defaultValue="2" className={input}>
            {WEEKDAY_OPTIONS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </Field>
        <Field label="Starts" hint="24-hour, in the timezone below.">
          <input name="start_time" type="time" required defaultValue="19:00" className={input} />
        </Field>
        <Field label="Ends">
          <input name="end_time" type="time" required defaultValue="21:30" className={input} />
        </Field>
        <Field label="Timezone" hint="The school teaches in Asia/Qatar. Change only for a cohort taught elsewhere.">
          <input name="timezone" defaultValue="Asia/Qatar" className={input} />
        </Field>
        <Field label="Label" hint="Optional. Shown instead of the cohort name.">
          <input name="label" placeholder="Teaching session" className={input} />
        </Field>
        <Field label="From">
          <input name="valid_from" type="date" required className={input} />
        </Field>
        <Field label="Until" hint="Leave blank for open-ended.">
          <input name="valid_until" type="date" className={input} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="is_active" defaultChecked className="h-4 w-4" />
        Active
      </label>
      <button type="submit" disabled={pending} className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40">
        {pending ? "Saving…" : "Add recurring timetable"}
      </button>
    </form>
  );
}

// ── holidays ────────────────────────────────────────────────────────────────

export function PeriodForm({ cohorts }: { cohorts: CohortOption[] }) {
  const [state, submit, pending] = useActionState<Result | null, FormData>(createPeriod, null);
  return (
    <form action={submit} className="space-y-4">
      <Feedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Applies to" hint="All cohorts is a school closure.">
          <select name="cohort_id" defaultValue="" className={input}>
            <option value="">All cohorts</option>
            {cohorts.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </Field>
        <Field label="Reason" hint="Shown publicly in place of the lesson.">
          <input name="reason" required placeholder="Winter break" className={input} />
        </Field>
        <Field label="From"><input name="starts_on" type="date" required className={input} /></Field>
        <Field label="Until" hint="Inclusive.">
          <input name="ends_on" type="date" required className={input} />
        </Field>
      </div>
      <button type="submit" disabled={pending} className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40">
        {pending ? "Saving…" : "Add break"}
      </button>
    </form>
  );
}

// ── one lesson: move, cancel, or add ────────────────────────────────────────

export function SessionForm({ cohorts, rules }: { cohorts: CohortOption[]; rules: RuleOption[] }) {
  const [state, submit, pending] = useActionState<Result | null, FormData>(createSession, null);
  const [scheduleId, setScheduleId] = useState("");
  const [status, setStatus] = useState("scheduled");
  // A one-off needs times; an override of an existing rule does not, and a
  // cancellation never does. Mirrors the server rule so the admin is told
  // before they submit rather than after.
  const needsTimes = scheduleId === "" && status === "scheduled";

  return (
    <form action={submit} className="space-y-4">
      <Feedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cohort">
          <select name="cohort_id" required defaultValue="" className={input}>
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
          <input name="occurs_on" type="date" required className={input} />
        </Field>
        <Field label="What is happening">
          <select name="status" value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
            <option value="scheduled">Goes ahead (move / add)</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>
        <Field label="Kind">
          <select name="kind" defaultValue="teaching" className={input}>
            {SESSION_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </Field>
        <Field label="Timezone"><input name="timezone" defaultValue="Asia/Qatar" className={input} /></Field>
        <Field label="Starts" hint={needsTimes ? "Required for a one-off." : "Leave blank to keep the timetable's time."}>
          <input name="starts_at_local" type="time" required={needsTimes} className={input} />
        </Field>
        <Field label="Ends">
          <input name="ends_at_local" type="time" required={needsTimes} className={input} />
        </Field>
        <Field label="Title"><input name="title" placeholder="Revision clinic" className={input} /></Field>
        <Field label="Note" hint="Shown as the reason when cancelled.">
          <input name="note" className={input} />
        </Field>
      </div>
      <button type="submit" disabled={pending} className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40">
        {pending ? "Saving…" : "Save session change"}
      </button>
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
