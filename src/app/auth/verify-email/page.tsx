import Link from "next/link";

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-parchment px-6 py-16 text-ink">
      <div className="w-full max-w-xl text-center">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-signal/80">
          Step 1 of 2
        </p>

        <h1 className="font-display mt-6 text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
          Check your inbox.
        </h1>

        <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-ink/70">
          We&apos;ve sent you a confirmation link. Open it from the same browser
          to verify your email and complete your account.
        </p>

        <div className="mt-12 inline-flex items-center gap-3 border-t border-ink/10 pt-6">
          <p className="text-xs text-ink/55">Wrong email?</p>
          <Link
            href="/signup"
            className="text-xs font-medium text-ink underline-offset-4 hover:underline"
          >
            Sign up again
          </Link>
        </div>
      </div>
    </main>
  );
}
