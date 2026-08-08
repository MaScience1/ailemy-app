import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Something on our side broke. Shown INSTEAD of a 404, and instead of an
 * empty screen.
 *
 * ============================================================================
 * WHY THIS COMPONENT HAD TO EXIST
 * ============================================================================
 * Every exam route used to collapse a database error into the same value it
 * uses for "there is nothing here": null, an empty array, a zero count. The
 * student then saw a coherent, wrong screen — a paper with no questions, an
 * attempt with no answers, a 404 for work they had just submitted. None of
 * those said "try again", because none of them knew anything had failed.
 *
 * A 404 is a claim about the data: it says this does not exist. An outage is
 * a claim about us. Telling a student their submitted paper cannot be found
 * is a lie about their work, and the one thing they cannot verify.
 *
 * So: failures render as failures. This is what that looks like.
 */
export function ExamUnavailable({
  title,
  message,
  backHref,
  backLabel = "Back to the paper",
}: {
  title: string;
  /** One sentence, no Postgres, no error codes. Those go to the server log. */
  message: string;
  backHref: string;
  backLabel?: string;
}) {
  return (
    <main className="min-h-screen bg-parchment text-ink">
      <div className="mx-auto w-full max-w-2xl px-6 py-10 sm:px-10 sm:py-16">
        <Link
          href={backHref}
          className="font-mono inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-ink/55 transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3 w-3" aria-hidden="true" />
          {backLabel}
        </Link>
        <h1 className="font-display mt-8 text-3xl font-medium leading-[1.1] tracking-tight md:text-4xl">
          {title}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink/70">{message}</p>
        <p className="mt-4 text-sm leading-relaxed text-ink/55">
          Nothing you have done has been lost. Reloading this page will try
          again.
        </p>
      </div>
    </main>
  );
}
