"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { SUBJECT_COLOURS, SUBJECT_ORDER } from "@/lib/design/subject-colours";

/**
 * The quick-signup drawer (§21, §22, §24).
 *
 * ============================================================================
 * ⚠ A FRONT DOOR, NOT A SECOND SIGNUP PATH
 * ============================================================================
 * Auth internals are untouchable, and duplicating supabase.auth.signUp here
 * would mean two places that create accounts, drifting apart on the first
 * change to email confirmation or the callback URL. So this collects §21's
 * fields and hands them to the EXISTING /signup flow as prefill; the account
 * is created by the one path that has always created accounts.
 *
 * ⚠ NOTHING IS WRITTEN ANYWHERE UNTIL THE REAL FORM SUBMITS. This dialog
 * performs no insert. §39 requires no parallel lead database, and a modal that
 * quietly created a lead row on "Continue" would be exactly that — plus a row
 * for every visitor who changed their mind at the password field.
 *
 * ⚠ SO WHY COLLECT AT ALL? Because §22 is about FRICTION, not about fields:
 * asking name, year and subject here means /signup asks for an email and a
 * password and nothing else, which is the short form §22 wants. The
 * personalisation happens before the password rather than after it.
 *
 * ⚠ EXAM BOARD IS OFFERED, NEVER REQUIRED (§21). "Not sure" is a real and
 * common answer from a fourteen-year-old, and a required board field turns a
 * 30-second form into a research task.
 *
 * @base-ui's Dialog is the existing pattern (past-papers/_start-test-modal),
 * and it brings the focus trap, Escape, backdrop and scroll lock §34 requires
 * rather than four hand-rolled effects.
 */

/**
 * ⚠ labelKey, NOT label. `value` is the WIRE FORMAT — it is written into the
 * /signup query string by onContinue — so it stays an English slug in every
 * locale. Only the label is translated, and it is translated at the render
 * site: a module constant is evaluated once at import, where no hook and no
 * request locale exist.
 */
const YEARS = [
  { value: "gcse-y10", labelKey: "quickSignup.yearGcseY10" },
  { value: "gcse-y11", labelKey: "quickSignup.yearGcseY11" },
  { value: "ial-as", labelKey: "quickSignup.yearIalAs" },
  { value: "ial-a2", labelKey: "quickSignup.yearIalA2" },
  { value: "other", labelKey: "quickSignup.yearOther" },
];

const BOARDS = ["Pearson Edexcel", "AQA", "OCR", "Cambridge", "Other", "Not sure"];

const FIELD =
  /* ⚠ text-base BELOW md, NOT text-sm. Safari zooms the page when a focused
     control is under 16px and never zooms back, leaving somebody panned
     sideways in the middle of signing up. ui/input.tsx and login-form.tsx
     both already use `md:text-sm` for exactly this; this field constant was
     the one that did not. */
  "mt-1.5 h-10 w-full rounded-md border border-ink/15 bg-snow px-3 text-base md:text-sm text-ink " +
  "placeholder:text-ink/35 focus-visible:border-ink/40 focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-1 focus-visible:outline-ink";

const LABEL = "block font-mono text-[10px] uppercase tracking-[0.16em] text-ink/50";

export function QuickSignup({ trigger }: {
  /**
   * ⚠ A SINGLE ELEMENT, NOT ReactNode. `render` needs one element to clone; a
   * fragment, a string or an array cannot receive the trigger's props and ref.
   * Typing it as ReactElement is what stops the previous bug being reintroduced
   * by passing loose children.
   */
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [year, setYear] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [country, setCountry] = useState("");
  const [board, setBoard] = useState("");
  const [error, setError] = useState<string | null>(null);

  const toggleSubject = (k: string) =>
    setSubjects((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  function onContinue() {
    setError(null);
    if (!firstName.trim()) return setError(t("quickSignup.errorFirstNameRequired"));
    /**
     * ⚠ VALIDATED HERE ONLY TO SAVE A ROUND TRIP, NEVER AS THE REAL CHECK.
     * The server and Supabase both validate again; a client check that the
     * server trusts is not a check. A bare shape test — nothing clever, because
     * clever email regexes reject real addresses.
     */
    if (!email.includes("@") || email.trim().length < 5) {
      return setError(t("quickSignup.errorEmailLooksWrong"));
    }

    /**
     * ⚠ PREFILL ONLY, AND NO PASSWORD EVER TOUCHES THIS URL. The query string
     * lands in browser history and in any proxy log; a name and a year group
     * are fine there and a credential is not. /signup asks for the password
     * itself, over its own form.
     */
    const q = new URLSearchParams();
    q.set("name", `${firstName.trim()} ${lastName.trim()}`.trim());
    q.set("email", email.trim());
    if (year) q.set("year", year);
    if (subjects.length) q.set("subjects", subjects.join(","));
    if (country.trim()) q.set("country", country.trim());
    if (board) q.set("board", board);
    router.push(`/signup?${q.toString()}`);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {/**
        * ⚠ THE TRIGGER ELEMENT IS PASSED TO `render`, NOT NESTED AS CHILDREN.
        *
        * This was `render={<span />}>{trigger}`, which wrapped a real <button>
        * inside a <span> that Base UI had already given button semantics and
        * handlers to. Two defects in one line: an interactive control nested
        * inside another, and a span standing in for a button — so keyboard
        * activation and form semantics came from the wrong element.
        *
        * Base UI says so out loud at runtime ("expected a native <button>
        * because the `nativeButton` prop is true"), which is what put a "1
        * Issue" badge on the Next dev overlay. It was a genuine accessibility
        * fault reported as a warning, not a dev-tools artefact.
        *
        * `render` REPLACES the trigger element, so the caller's <button> IS the
        * trigger — one element, real button semantics, nothing nested.
        */}
      <Dialog.Trigger render={trigger} />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[9998] bg-ink/50 backdrop-blur-[2px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-[9999] max-h-[92vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-ink/10 bg-parchment p-6 shadow-[0_24px_64px_-24px_rgba(15,20,25,0.45)] transition-all duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 sm:p-8">
          <Dialog.Title className="font-display text-2xl font-medium tracking-tight">
            {t("quickSignup.title")}
          </Dialog.Title>

          {/* ⚠ THE BENEFITS ARE THE REASON, AND EVERY ONE IS REAL (§24). No
              "AI tutor", no "guaranteed grade" — each line below maps to
              something a student can do the day they sign in. */}
          <ul className="mt-4 grid gap-1.5 text-[13px] text-ink/70 sm:grid-cols-2">
            {[
              "quickSignup.benefitSaveProgress",
              "quickSignup.benefitAnswersMarked",
              "quickSignup.benefitWeakTopics",
              "quickSignup.benefitPastPapers",
              "quickSignup.benefitTrackRevision",
              "quickSignup.benefitJoinLiveTuition",
            ].map((b) => (
              <li key={b} className="flex items-start gap-1.5">
                <span aria-hidden className="mt-px text-ink/35">✓</span>
                {t(b)}
              </li>
            ))}
          </ul>

          <div className="mt-6 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="qs-first">{t("quickSignup.firstName")}</label>
                <input id="qs-first" dir="auto" className={FIELD} value={firstName}
                  onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
              </div>
              <div>
                <label className={LABEL} htmlFor="qs-last">{t("quickSignup.lastName")}</label>
                <input id="qs-last" dir="auto" className={FIELD} value={lastName}
                  onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
              </div>
            </div>

            <div>
              <label className={LABEL} htmlFor="qs-email">{t("quickSignup.email")}</label>
              <input id="qs-email" dir="ltr" type="email" className={FIELD} value={email}
                onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>

            <div>
              <label className={LABEL} htmlFor="qs-year">{t("quickSignup.yearGroupOrQualification")}</label>
              <select id="qs-year" className={FIELD} value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="">{t("quickSignup.choosePlaceholder")}</option>
                {YEARS.map((y) => (
                  <option key={y.value} dir="auto" value={y.value}>
                    {t(y.labelKey)}
                  </option>
                ))}
              </select>
            </div>

            <fieldset>
              <legend className={LABEL}>{t("quickSignup.subjectsInterestedIn")}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {SUBJECT_ORDER.map((k) => {
                  const c = SUBJECT_COLOURS[k];
                  const on = subjects.includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleSubject(k)}
                      className="rounded-full border px-3 py-1.5 text-sm transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                      style={
                        on
                          ? { background: c.tint, borderColor: c.border, color: c.text }
                          : { borderColor: "rgba(15,20,25,0.15)" }
                      }
                    >
                      {/* ⚠ THE TICK, NOT ONLY THE COLOUR (§34). A selected chip
                          must be distinguishable without seeing the tint. */}
                      {on && <span aria-hidden className="me-1">✓</span>}
                      {t(`subjects.${k}`)}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="qs-country">{t("quickSignup.country")}</label>
                <input id="qs-country" dir="auto" className={FIELD} value={country}
                  onChange={(e) => setCountry(e.target.value)} autoComplete="country-name" />
              </div>
              <div>
                <label className={LABEL} htmlFor="qs-board">
                  {t("quickSignup.examBoard")} <span className="normal-case tracking-normal text-ink/35">{t("quickSignup.optional")}</span>
                </label>
                <select id="qs-board" className={FIELD} value={board} onChange={(e) => setBoard(e.target.value)}>
                  <option value="">Choose…</option>
                  {BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onContinue}
              data-cta="quick_signup_continue"
              className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-parchment transition-colors duration-200 hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {t("quickSignup.continueFree")}
            </button>
            <Dialog.Close className="text-sm text-ink/55 underline underline-offset-2 transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
              {t("quickSignup.notNow")}
            </Dialog.Close>
          </div>

          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
            {t("quickSignup.freeAccountNoCard")}
          </p>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
