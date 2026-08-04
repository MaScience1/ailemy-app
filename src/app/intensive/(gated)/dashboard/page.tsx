import { getIntensiveAccess } from "@/lib/intensive/enrolment";

/**
 * Placeholder cohort home — proves the paid gate end-to-end for B2. The real
 * week list (cohort title, start date, week rows with status chips) is built in
 * B4 and replaces this file.
 */
export default async function IntensiveHomePage() {
  const access = await getIntensiveAccess();
  // The gated layout guarantees `enrolled` here; narrow for the email.
  const email = access.state === "enrolled" ? access.email : "";

  return (
    <div className="mx-auto min-h-screen w-full max-w-[720px] px-6 py-16">
      <p className="ai-spec">Chemistry AS Exam Intensive</p>
      <h1 className="ai-display mt-4 text-4xl md:text-5xl">You&apos;re in.</h1>
      <p className="mt-5 text-sm leading-relaxed text-ink-60">
        Signed in and enrolled as{" "}
        <span className="font-medium text-ink">{email}</span>. The week list
        lands here next (B4).
      </p>
    </div>
  );
}
