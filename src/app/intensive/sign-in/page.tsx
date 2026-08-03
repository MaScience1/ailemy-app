import { redirect } from "next/navigation";
import Link from "next/link";

import { getIntensiveAccess } from "@/lib/intensive/enrolment";
import { SignInForm } from "./sign-in-form";

/**
 * Public (un-gated) sign-in for the intensive. Lives OUTSIDE the (gated) route
 * group so an unauthenticated student can reach it. An already-enrolled user is
 * sent straight to the cohort home.
 */
export default async function IntensiveSignInPage() {
  const access = await getIntensiveAccess();
  if (access.state === "enrolled") redirect("/intensive");

  return (
    <div className="grid min-h-screen bg-parchment md:grid-cols-2">
      <aside className="relative hidden flex-col justify-between bg-ink p-10 text-snow md:flex lg:p-14">
        <Link
          href="/"
          className="ai-signature font-display text-xl font-medium tracking-tight text-snow"
        >
          Ailemy
        </Link>

        <p className="ai-display max-w-md text-3xl leading-[1.15] lg:text-4xl">
          Twelve weeks.
          <br />
          Every answer marked by hand.
        </p>

        <p className="ai-spec text-parchment/40">Edexcel IAL · AS Chemistry</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12 sm:px-10 sm:py-16">
        <div className="w-full max-w-md">
          <SignInForm />
        </div>
      </main>
    </div>
  );
}
