"use client";

import { useActionState, useState, useTransition } from "react";

import { WEEKDAY_OPTIONS } from "@/lib/admin/schedule-form";

import {
  createAvailability, createBlock, deleteAvailability, deleteBlock,
  setAvailabilityActive, updateAvailability,
} from "./actions";

type Result = { ok: true } | { ok: false; error: string };

const input =
  "mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none";

export type TeacherOption = { id: string; email: string; roles: string };

export type AvailabilityValue = {
  id: string; teacher_id: string; subject: string | null;
  weekday: number | null; specific_date: string | null;
  start_time: string; end_time: string; timezone: string;
  slot_minutes: number; buffer_minutes: number;
  valid_from: string | null; valid_until: string | null;
  booking_horizon_days: number; booking_cutoff_hours: number;
  is_active: boolean;
};

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

// ── availability window ─────────────────────────────────────────────────────

export function AvailabilityForm({
  teachers, subjects, value,
}: {
  teachers: TeacherOption[]; subjects: string[]; value?: AvailabilityValue;
}) {
  const [state, submit, pending] = useActionState<Result | null, FormData>(
    value ? updateAvailability.bind(null, value.id) : createAvailability, null,
  );

  /**
   * ⚠ RECURRING XOR ONE-OFF, ENFORCED IN THE UI AS A CHOICE RATHER THAN AS TWO
   * FIELDS THE ADMIN MIGHT BOTH FILL. 0045's CHECK refuses a row with both, and
   * a form that lets you type both and then reports a constraint violation has
   * made the database do the explaining.
   */
  const [mode, setMode] = useState<"weekly" | "once">(
    value?.specific_date ? "once" : "weekly",
  );

  return (
    <form action={submit} className="space-y-4">
      <Feedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Teacher" hint="Accounts holding the teacher or admin role.">
          <select name="teacher_id" required defaultValue={value?.teacher_id ?? ""} className={input}>
            <option value="" disabled>Choose…</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.email} ({t.roles})</option>
            ))}
          </select>
        </Field>
        <Field label="Subject" hint="Blank means any subject this teacher teaches.">
          <select name="subject" defaultValue={value?.subject ?? ""} className={input}>
            <option value="">Any subject</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>

        <Field label="Repeats?">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "weekly" | "once")}
            className={input}
          >
            <option value="weekly">Every week</option>
            <option value="once">One date only</option>
          </select>
        </Field>
        {mode === "weekly" ? (
          <Field label="Weekday">
            <select name="weekday" required defaultValue={String(value?.weekday ?? 2)} className={input}>
              {WEEKDAY_OPTIONS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </Field>
        ) : (
          <Field label="Date">
            <input name="specific_date" type="date" required defaultValue={value?.specific_date ?? ""} className={input} />
          </Field>
        )}

        <Field label="Window opens" hint="24-hour, in the timezone below.">
          <input name="start_time" type="time" required defaultValue={value?.start_time.slice(0, 5) ?? "16:00"} className={input} />
        </Field>
        <Field label="Window closes">
          <input name="end_time" type="time" required defaultValue={value?.end_time.slice(0, 5) ?? "19:00"} className={input} />
        </Field>
        <Field label="Timezone">
          <input name="timezone" defaultValue={value?.timezone ?? "Asia/Qatar"} className={input} />
        </Field>

        <Field label="Lesson length (minutes)" hint="Must fit inside the window, or nothing is published.">
          <input name="slot_minutes" type="number" min={1} max={480} defaultValue={value?.slot_minutes ?? 60} className={input} />
        </Field>
        <Field label="Gap between lessons (minutes)" hint="Sits between slots, not after the last one.">
          <input name="buffer_minutes" type="number" min={0} max={240} defaultValue={value?.buffer_minutes ?? 15} className={input} />
        </Field>
        <Field label="Book up to (days ahead)" hint="How far into the future slots are offered.">
          <input name="booking_horizon_days" type="number" min={1} max={365} defaultValue={value?.booking_horizon_days ?? 42} className={input} />
        </Field>
        <Field label="Stop booking (hours before)" hint="Stops a student booking something starting in ten minutes.">
          <input name="booking_cutoff_hours" type="number" min={0} max={720} defaultValue={value?.booking_cutoff_hours ?? 12} className={input} />
        </Field>

        <Field label="Runs from" hint="Optional.">
          <input name="valid_from" type="date" defaultValue={value?.valid_from ?? ""} className={input} />
        </Field>
        <Field label="Runs until" hint="Optional. Blank is open-ended.">
          <input name="valid_until" type="date" defaultValue={value?.valid_until ?? ""} className={input} />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="is_active" defaultChecked={value ? value.is_active : true} className="h-4 w-4" />
        Published — visible to students
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40">
          {pending ? "Saving…" : value ? "Save changes" : "Publish availability"}
        </button>
        {value && (
          <a href="?" className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600">Cancel</a>
        )}
      </div>
      {value && (
        <p className="text-[11px] text-slate-500">
          Changing this window does not move a lesson already booked inside it — a booking keeps
          its own time. Narrowing the window stops new bookings; it does not cancel old ones.
        </p>
      )}
    </form>
  );
}

// ── block ───────────────────────────────────────────────────────────────────

export function BlockForm({ teachers }: { teachers: TeacherOption[] }) {
  const [state, submit, pending] = useActionState<Result | null, FormData>(createBlock, null);
  return (
    <form action={submit} className="space-y-4">
      <Feedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Teacher">
          <select name="teacher_id" required defaultValue="" className={input}>
            <option value="" disabled>Choose…</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.email}</option>)}
          </select>
        </Field>
        <Field label="Timezone"><input name="timezone" defaultValue="Asia/Qatar" className={input} /></Field>
        <Field label="From date"><input name="starts_on" type="date" required className={input} /></Field>
        <Field label="To date" hint="Blank means the same day.">
          <input name="ends_on" type="date" className={input} />
        </Field>
        <Field label="From time" hint="Blank means 00:00 — the whole day.">
          <input name="start_time" type="time" className={input} />
        </Field>
        <Field label="To time" hint="Blank means 23:59.">
          <input name="end_time" type="time" className={input} />
        </Field>
        {/* ⚠ SAID PLAINLY, BECAUSE 0045 MADE IT TRUE BY COLUMN GRANT. anon can
            read a block's times but NOT its reason, so "hospital appointment"
            never reaches a visitor. An admin should know that before typing. */}
        <div className="sm:col-span-2">
          <Field label="Reason" hint="Private. Students see only that the time is unavailable — never this text.">
            <input name="reason" placeholder="Travelling" className={input} />
          </Field>
        </div>
      </div>
      <button type="submit" disabled={pending} className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40">
        {pending ? "Saving…" : "Block this time"}
      </button>
    </form>
  );
}

// ── row actions ─────────────────────────────────────────────────────────────

export function AvailabilityActions({ id, isActive }: { id: string; isActive: boolean }) {
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
      <button
        type="button" disabled={pending}
        onClick={() => run(() => setAvailabilityActive(id, !isActive))}
        className={`rounded border px-2.5 py-1 text-xs disabled:opacity-40 ${
          isActive ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-slate-700"
        }`}
      >
        {isActive ? "Published" : "Paused"}
      </button>
      {confirming ? (
        <>
          <span className="text-xs text-red-800">
            Delete this window? Pausing hides it from students and keeps its settings.
          </span>
          <button type="button" disabled={pending} onClick={() => run(() => deleteAvailability(id))}
            className="rounded border border-red-600 bg-red-600 px-2.5 py-1 text-xs text-white disabled:opacity-40">Yes</button>
          <button type="button" onClick={() => setConfirming(false)}
            className="rounded border border-slate-300 px-2.5 py-1 text-xs">Cancel</button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirming(true)}
          className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600">Delete</button>
      )}
      {error && <span className="text-xs text-red-800">{error}</span>}
    </div>
  );
}

export function BlockActions({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button" disabled={pending}
        onClick={() => start(async () => {
          const r = await deleteBlock(id);
          if (!r.ok) setError(r.error);
        })}
        className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600 disabled:opacity-40"
      >
        Remove block
      </button>
      {error && <span className="text-xs text-red-800">{error}</span>}
    </div>
  );
}
