"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleAlert, Loader2 } from "lucide-react";

/**
 * Starts a sitting.
 *
 * ATTEMPT CREATION IS A BUTTON, NOT A PAGE LOAD. Creating the attempt as a
 * side effect of rendering /interactive/sit/exam would mean every refresh, every
 * back-button press and every link preflight created another sitting. So the
 * GET is inert and the write happens on an explicit click.
 */
export function StartExamButton({
  paperId,
  attemptHrefBase,
  onCreate,
  label = "Start the paper",
}: {
  paperId: string;
  /** Where the player lives; the new attempt id is appended. */
  attemptHrefBase: string;
  onCreate: (
    paperId: string,
    mode: "exam" | "practice",
  ) => Promise<{ ok: true; attemptId: string } | { ok: false; error: string }>;
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    const result = await onCreate(paperId, "exam");
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }
    // Stay busy through the navigation: re-enabling here would let a second
    // click create a second attempt while the first route is still resolving.
    startTransition(() => {
      router.push(`${attemptHrefBase}/${result.attemptId}`);
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={busy || pending}
        className="font-mono inline-flex items-center gap-2 rounded-md border border-ink/15 bg-signal px-5 py-3 text-[11px] uppercase tracking-[0.2em] text-ink transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy || pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : null}
        {busy || pending ? "Starting" : label}
        {!busy && !pending && (
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>

      {error && (
        <p className="mt-3 inline-flex items-start gap-2 text-sm text-[var(--color-danger,#B3261E)]">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
