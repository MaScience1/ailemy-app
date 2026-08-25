"use client";

import { useActionState, useEffect, useRef } from "react";

import { registerInterest, type InterestState } from "./actions";

/**
 * The register-interest form.
 *
 * ⚠ THE ONLY CLIENT COMPONENT ON THE PUBLIC SITE, AND IT EARNS IT: a form with
 * a pending state and a result needs one. Everything else here is server-
 * rendered markup.
 *
 * ⚠ FAILURE KEEPS THE ANSWERS AND OFFERS THE EMAIL ROUTE. `fields` comes back
 * on every error and refills the inputs, and the mailto the page has always
 * carried stays visible underneath. A parent who reaches an error must never
 * be left with an empty form and no other way through.
 */

const SUBJECTS = ["Chemistry", "Biology", "Physics"];
const QUALIFICATIONS = [
  "GCSE", "International GCSE", "IAL AS", "IAL A2", "Not sure yet",
];
const BOARDS = ["Pearson Edexcel", "AQA", "OCR", "Cambridge (CAIE)", "Other", "Not sure"];

const initial: InterestState = { status: "idle" };

const YEAR_GROUPS = ["Year 10", "Year 11", "Year 12 / AS", "Year 13 / A2", "Other"];

export function InterestForm({
  defaultSubject,
  cohort,
  mode,
  mailto,
  /**
   * ⚠ §51/0043. False until the migration is applied, and then these three
   * inputs simply are not rendered. Asking a family for a year group and
   * throwing the answer away would be worse than not asking.
   */
  hasDemandFields,
}: {
  defaultSubject: string;
  cohort: string | null;
  mode: string | null;
  mailto: string;
  hasDemandFields: boolean;
}) {
  const [state, action, pending] = useActionState(registerInterest, initial);
  const tz = useRef<HTMLInputElement>(null);

  // Their timezone, so "7:00 PM Doha" can be answered in their own hours. Set
  // from the browser because the server cannot know it; absent is fine.
  useEffect(() => {
    if (tz.current && !tz.current.value) {
      try {
        tz.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
      } catch {
        /* older browser — the column is nullable */
      }
    }
  }, []);

  if (state.status === "ok") {
    return (
      <div className="mt-8 rounded-lg border border-ink/15 bg-snow p-6">
        <h2 className="font-display text-xl font-medium">Thank you — we have your details.</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink/70">
          We will contact you by email when a cohort opens for your subject and qualification.
          Nothing is charged and nothing is committed.
        </p>
      </div>
    );
  }

  const v = state.status === "error" ? state.fields : {};
  const get = (k: string) => (v as Record<string, string>)[k] ?? "";

  return (
    <>
      {state.status === "error" && (
        <p
          role="alert"
          className="mt-8 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          {state.error}
        </p>
      )}

      <form action={action} className="mt-8 space-y-6">
        {/* honeypot — hidden from people, tempting to bots */}
        <div aria-hidden className="absolute start-[-9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <input ref={tz} type="hidden" name="timezone" defaultValue={get("timezone")} />
        {cohort && <input type="hidden" name="exam_session" defaultValue={cohort} />}
        {mode === "one-to-one" && (
          <input type="hidden" name="preferred_times" defaultValue="one-to-one enquiry" />
        )}

        <Group title="What you need">
          <Select name="subject" label="Subject" required options={SUBJECTS}
            defaultValue={get("subject") || defaultSubject} />
          <Select name="qualification" label="Qualification" required options={QUALIFICATIONS}
            defaultValue={get("qualification")} />
          <Select name="exam_board" label="Exam board" options={BOARDS}
            defaultValue={get("exam_board")} />
          {!cohort && (
            <Field name="exam_session" label="Exam session" placeholder="e.g. June 2027"
              defaultValue={get("exam_session")} />
          )}
        </Group>

        <Group title="Who you are">
          <Field name="student_name" label="Student name" required defaultValue={get("student_name")} />
          <Field name="parent_name" label="Parent / guardian name" defaultValue={get("parent_name")} />
          <Field name="email" label="Email" type="email" required autoComplete="email"
            defaultValue={get("email")} />
          <Field name="phone" label="Phone (with country code)" type="tel" autoComplete="tel"
            defaultValue={get("phone")} />
          <Field name="country" label="Country" autoComplete="country-name" defaultValue={get("country")} />
        </Group>

        <Group title="Where you are, and when you can study">
          {hasDemandFields && (
            <>
              <Select name="year_group" label="Year group" options={YEAR_GROUPS}
                defaultValue={get("year_group")} />
              <Field name="exam_year" label="Exam year" type="number" placeholder="e.g. 2027"
                defaultValue={get("exam_year")} />
            </>
          )}
          <Field name="current_grade" label="Current grade" defaultValue={get("current_grade")} />
          <Field name="target_grade" label="Target grade" defaultValue={get("target_grade")} />
          <Field name="preferred_days" label="Preferred days" defaultValue={get("preferred_days")} />
          <Field name="preferred_times" label="Preferred times" defaultValue={get("preferred_times")} />
        </Group>

        {hasDemandFields && (
          <label className="block text-sm">
            <span className="text-ink/75">Anything else we should know?</span>
            <textarea
              name="student_notes" rows={3} defaultValue={get("student_notes")}
              placeholder="Topics you find hardest, timing constraints, anything at all."
              className={inputClass}
            />
          </label>
        )}

        <label className="flex items-start gap-3 text-sm text-ink/75">
          <input type="checkbox" name="ready_to_start" defaultChecked={get("ready_to_start") === "on"}
            className="mt-1 h-4 w-4 shrink-0 accent-ink" />
          <span>We are ready to start as soon as a cohort opens.</span>
        </label>

        {/* ⚠ NOT PRE-TICKED, AND NOT OPTIONAL. 0040 refuses a row without it and
            records when it was given. A pre-ticked box is not consent. */}
        <label className="flex items-start gap-3 text-sm text-ink/75">
          <input type="checkbox" name="consent" required className="mt-1 h-4 w-4 shrink-0 accent-ink" />
          <span>
            I agree that Ailemy may contact me about tuition using the details above. We store
            them only for that purpose and you may ask us to delete them at any time.
          </span>
        </label>

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-parchment hover:bg-ink/90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {pending ? "Sending…" : "Register interest →"}
        </button>
      </form>

      <p className="mt-8 border-t border-ink/10 pt-6 text-sm text-ink/60">
        Prefer email?{" "}
        <a href={mailto} className="underline underline-offset-2 hover:text-ink">
          Open a pre-filled message instead
        </a>
        .
      </p>
    </>
  );
}

// ── small form primitives ───────────────────────────────────────────────────

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/50">{title}</legend>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

const inputClass =
  "mt-1 w-full rounded-md border border-ink/20 bg-snow px-3 py-2 text-base md:text-base md:text-sm text-ink " +
  "focus:border-ink/50 focus:outline-none focus:ring-1 focus:ring-ink/30";

function Field({
  name, label, required, type = "text", placeholder, defaultValue, autoComplete,
}: {
  name: string; label: string; required?: boolean; type?: string;
  placeholder?: string; defaultValue?: string; autoComplete?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-ink/75">
        {label}
        {required && <span className="text-ink/40"> *</span>}
      </span>
      <input
        name={name} type={type} required={required} placeholder={placeholder}
        defaultValue={defaultValue} autoComplete={autoComplete} className={inputClass}
      />
    </label>
  );
}

function Select({
  name, label, required, options, defaultValue,
}: {
  name: string; label: string; required?: boolean; options: string[]; defaultValue?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-ink/75">
        {label}
        {required && <span className="text-ink/40"> *</span>}
      </span>
      <select name={name} required={required} defaultValue={defaultValue ?? ""} className={inputClass}>
        <option value="">Please choose…</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
