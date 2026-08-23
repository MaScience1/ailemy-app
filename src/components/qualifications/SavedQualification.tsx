"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  LEVEL_COPY,
  qualificationName,
  SCOPE_PATHWAY,
} from "@/lib/qualifications/model.ts";
import {
  clearPreference,
  readPreference,
  type QualificationPreference,
} from "@/lib/qualifications/preference.ts";

/**
 * "Your Chemistry" — the remembered choice, and the way out of it (§17, §24).
 *
 * ⚠ IT RENDERS NOTHING UNTIL IT HAS READ THE BROWSER. localStorage is not
 * available during the server render, so the first paint must not include a
 * personalised card the server could not have produced — that is a hydration
 * mismatch, and the fix is to show it only once mounted.
 *
 * ⚠ AND IT IS ALWAYS REVERSIBLE. A remembered qualification that cannot be
 * changed is worse than being asked: a student who picked wrong, or who
 * changed school, must be one click from correcting it (§24).
 */
export function SavedQualification({
  subjectSlug,
  subjectName,
}: {
  subjectSlug: string;
  subjectName: string;
}) {
  const [pref, setPref] = useState<QualificationPreference | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPref(readPreference(subjectSlug));
    setMounted(true);
  }, [subjectSlug]);

  if (!mounted || !pref) return null;

  const levelName = LEVEL_COPY[pref.level].name;
  const qualName = qualificationName(pref.level, pref.scope);
  const pathway = SCOPE_PATHWAY[pref.level][pref.scope];

  return (
    <section
      aria-label={`Your saved ${subjectName} qualification`}
      className="mt-8 rounded-xl border border-ink/10 bg-snow p-5 sm:p-6"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
        Your {subjectName}
      </p>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
        <p className="font-display text-xl font-medium tracking-tight">
          {qualName}
          {/* ⚠ "I'm not sure" IS SHOWN AS ITSELF, NOT QUIETLY UPGRADED to a
              board the student never picked (§19). */}
          {pref.curriculum ? null : (
            <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
              board not chosen yet
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <Link
            href={`/learn/${subjectSlug}/${pathway}`}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 font-medium text-parchment transition-colors hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Continue {levelName} →
          </Link>
          <button
            type="button"
            onClick={() => {
              clearPreference(subjectSlug);
              setPref(null);
            }}
            className="text-ink/60 underline underline-offset-4 transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Change
          </button>
        </div>
      </div>
    </section>
  );
}
