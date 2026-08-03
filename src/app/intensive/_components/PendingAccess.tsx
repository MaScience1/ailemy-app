import Link from "next/link";

/**
 * Shown to a signed-in user who has no active cohort_enrolments row. Plain by
 * design — no upsell, no pricing, no "buy now" (payment happens on a Stripe
 * Payment Link outside the app, and enrolment rows are inserted by hand). Just
 * tells them access opens once enrolment is confirmed, with a way to reach us.
 */
export function PendingAccess({ email }: { email: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-parchment px-6 py-16">
      <div className="w-full max-w-[520px]">
        <p className="ai-spec">Chemistry AS Exam Intensive</p>
        <h1 className="ai-display mt-4 text-3xl md:text-4xl">
          Access opens once your enrolment is confirmed.
        </h1>
        <p className="mt-5 text-sm leading-relaxed text-ink-60">
          You&apos;re signed in as{" "}
          <span className="font-medium text-ink">{email}</span>, but this email
          isn&apos;t on the cohort roll yet. Once your place is confirmed,
          you&apos;ll be able to open week&nbsp;1 here.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-ink-60">
          If you&apos;ve already paid and think this is a mistake, send us the
          email address you paid with and we&apos;ll sort it out.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a
            href="mailto:mascience15@gmail.com?subject=Intensive%20enrolment"
            className="inline-flex h-11 items-center justify-center rounded-md bg-flask px-5 text-sm font-medium text-snow transition-colors hover:bg-flask/90"
          >
            Email about my enrolment
          </a>
          <Link
            href="/"
            className="text-sm text-ink-60 underline-offset-4 hover:underline"
          >
            Back to ailemy.com
          </Link>
        </div>
      </div>
    </div>
  );
}
