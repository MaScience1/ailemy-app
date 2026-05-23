"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function LearnError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[/learn] route error", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-parchment px-6 text-ink">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-flask">
          Something went wrong
        </p>
        <h1 className="font-display mt-4 text-3xl font-medium tracking-tight md:text-4xl">
          We couldn&apos;t load the subject catalogue.
        </h1>
        <p className="mt-4 text-sm text-ink/65">
          Try again, or head back to the homepage.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-flask px-5 py-2.5 font-medium text-snow transition-colors hover:bg-flask/90"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-md border border-ink/15 px-5 py-2.5 font-medium text-ink transition-colors hover:border-ink/30 hover:bg-ink/[0.04]"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
