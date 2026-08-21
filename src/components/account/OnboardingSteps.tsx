"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * The onboarding questions (§23).
 *
 * ============================================================================
 * ⚠ NOTHING IS SAVED YET, AND THE UI SAYS SO RATHER THAN PRETENDING
 * ============================================================================
 * §23's answers should "improve the student's dashboard and recommendations".
 * Two of the four have a column to live in — student_courses.target_grade and
 * current_working_grade — and two do not: there is no exam-date column and no
 * weak-topics store anywhere in the schema, and adding them is schema, which is
 * parked.
 *
 * Writing the two that fit while silently discarding the other two would be
 * worse than not writing any: a student would answer four questions, see a
 * confirmation, and have two of their answers vanish. So this collects all four
 * and states plainly that it is not saved yet.
 *
 * ⚠ THAT IS A DELIBERATE, VISIBLE LIMITATION RATHER THAN A HIDDEN ONE. The
 * alternative — a spinner and a "saved!" toast — is the fake functionality the
 * standing rules forbid, and a student would only discover it much later.
 *
 * ============================================================================
 * ⚠ AND THIS FILE USED TO GIVE A FALSE REMEDY, WHICH IS THE SUBTLER FAULT
 * ============================================================================
 * It said — here in the header, and twice on screen — that a target grade "can
 * be set today, on your profile". It cannot. There is no profile editor, no
 * /settings route, and nothing anywhere in the application writes
 * student_courses; the only reads are at profile-reader.ts:99.
 *
 * That is a worse failure than the one this component was so careful about. It
 * told the student the truth in one sentence ("nothing you typed has been sent
 * anywhere") and then handed them a remedy that does not exist in the next —
 * so the student goes to /profile, cannot find the control, and concludes they
 * are the one who is lost. An honest limitation followed by a false workaround
 * reads as a working product with a confusing UI.
 *
 * ⚠ AND WIRING IT INSTEAD OF CORRECTING IT WOULD NOT HAVE WORKED. target_grade
 * lives on student_courses (0017 §3b), one row per course a student studies.
 * A student arriving at /welcome has just signed up and has no such row, and
 * no enrolment flow exists to create one — so the write would fail for exactly
 * the audience this page serves. The editor is Phase 3 work and needs the
 * enrolment path underneath it.
 *
 * ⚠ WHEN THAT EDITOR LANDS, THIS COPY IS PART OF THE SAME CHANGE, and
 * no-false-remedies.test.ts goes red to say so rather than leaving it to
 * memory.
 *
 * ⚠ ONE QUESTION AT A TIME, EACH SKIPPABLE, PROGRESS VISIBLE. A student who
 * stops halfway has lost nothing, because nothing was ever a requirement.
 */

const GRADES = ["A*", "A", "B", "C", "D", "E", "9", "8", "7", "6", "5", "4"];

type Step = {
  id: string;
  question: string;
  kind: "grade" | "text";
  hint?: string;
};

const STEPS: Step[] = [
  { id: "current", question: "What grade are you working at now?", kind: "grade",
    hint: "A rough idea is fine — it is a starting point, not a judgement." },
  { id: "target", question: "What grade are you aiming for?", kind: "grade",
    hint: "This is the one Ailemy measures progress against." },
  { id: "exam", question: "When is your exam?", kind: "text",
    hint: "A month and year is enough, like “May 2027”." },
  { id: "weak", question: "Which topics do you find hardest?", kind: "text",
    hint: "Anything at all — “moles”, “organic mechanisms”." },
];

export function OnboardingSteps() {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const step = STEPS[i];
  const next = () => (i + 1 < STEPS.length ? setI(i + 1) : setDone(true));
  const set = (v: string) => setAnswers((a) => ({ ...a, [step.id]: v }));

  if (done) {
    const given = Object.entries(answers).filter(([, v]) => v.trim().length > 0);
    return (
      <div className="rounded-lg border border-ink/10 bg-snow p-6">
        <h2 className="font-display text-xl font-medium tracking-tight">Thanks — that&rsquo;s everything.</h2>

        {given.length > 0 ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-ink/70">
              {/* ⚠ THE HONEST SENTENCE. Nothing was saved, and saying "saved"
                  would be the fake functionality the rules forbid. */}
              Ailemy cannot store these yet — the questions are ready before the place to keep
              them is. Nothing you typed has been sent anywhere.
            </p>
            {/* ⚠ NO REMEDY IS OFFERED, BECAUSE THERE IS NOT ONE YET. This
                sentence used to send the student to a profile editor that does
                not exist. Saying what will happen to the answer — nothing, for
                now — is the only claim this page can currently keep. */}
            <p className="mt-3 text-sm leading-relaxed text-ink/70">
              Nothing is lost by that: none of it is needed to start. Ailemy learns what you
              are strong and weak at from the questions you actually answer, not from what you
              told it at signup.
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-ink/70">
            No problem — none of it is needed to start. Ailemy learns what you are strong and
            weak at from the questions you actually answer.
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          {/* ⚠ PRACTISING IS THE PRIMARY ACTION NOW. It was second to a profile
              link that promised a control the profile does not have; the button
              that leads somewhere the student can actually do something should
              be the loud one. /profile stays, described as what it is — a place
              to look, not a place to set this. */}
          <Link
            href="/past-papers"
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-parchment transition-colors hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Start practising →
          </Link>
          <Link
            href="/profile"
            className="rounded-full border border-ink/20 px-5 py-2.5 text-sm font-medium transition-colors hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            See my profile →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-ink/10 bg-snow p-6 sm:p-8">
      {/* ⚠ PROGRESS IS TEXT AS WELL AS A BAR, so it survives greyscale and is
          announced rather than merely seen. */}
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
        Question {i + 1} of {STEPS.length}
      </p>
      <div aria-hidden className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-ink/10">
        <div
          className="h-full rounded-full bg-ink/50 transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${((i + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      <h2 className="font-display mt-5 text-2xl font-medium tracking-tight">{step.question}</h2>
      {step.hint && <p className="mt-2 text-sm leading-relaxed text-ink/60">{step.hint}</p>}

      <div className="mt-5">
        {step.kind === "grade" ? (
          <div className="flex flex-wrap gap-2">
            {GRADES.map((g) => {
              const on = answers[step.id] === g;
              return (
                <button
                  key={g}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set(g)}
                  className={`min-w-[3rem] rounded-full border px-3 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                    on ? "border-ink bg-ink text-parchment" : "border-ink/15 hover:border-ink/35"
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>
        ) : (
          <input
            value={answers[step.id] ?? ""}
            onChange={(e) => set(e.target.value)}
            aria-label={step.question}
            className="h-11 w-full rounded-md border border-ink/15 bg-parchment px-3 text-sm focus-visible:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink"
          />
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={next}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-parchment transition-colors hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {i + 1 === STEPS.length ? "Finish" : "Next"} →
        </button>
        {/* ⚠ SKIP IS AS PROMINENT AS NEXT, not hidden in small grey text. §23
            says allow skipping; a skip nobody can find is not one. */}
        <button
          type="button"
          onClick={next}
          className="text-sm text-ink/55 underline underline-offset-2 transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Skip this
        </button>
      </div>
    </div>
  );
}
