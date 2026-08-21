import type { Metadata } from "next";
import Link from "next/link";

import { Bullets, Clause, LegalPage } from "@/components/legal/LegalPage";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { getNavSession } from "@/lib/auth/nav-session";
import { COMPANY } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Privacy Policy — Ailemy",
  description:
    "How Rentic Ltd, trading as Ailemy, collects and uses personal data under UK GDPR.",
};

/**
 * ⚠ THIS DESCRIBES PROCESSING THAT ACTUALLY HAPPENS, and it was written from
 * the codebase rather than from a template.
 *
 * VERIFIED PRESENT: Supabase (@supabase/ssr — auth, profiles, learning records,
 * interest_registrations), Anthropic (@anthropic-ai/sdk, src/lib/exam/ai-marker.ts
 * — student written answers are sent for marking), Mux (@mux/mux-node,
 * @mux/mux-player-react — lesson and paper video).
 *
 * ⚠ POSTHOG IS NOW INSTALLED, AND THIS TEXT CHANGED IN THE SAME BRANCH.
 * The rule this file set — "if any of them goes live this page must be updated
 * BEFORE it does; that is a release step, not a follow-up" — is what is being
 * honoured here. posthog-js is a dependency and src/lib/analytics/ exists, so
 * the clause below describes it.
 *
 * ⚠ AND IT IS DESCRIBED AS CONDITIONAL, BECAUSE IT IS. Nothing loads and
 * nothing is sent without NEXT_PUBLIC_POSTHOG_KEY, which is unset. The text
 * says "when analytics is switched on" rather than claiming current
 * processing — and it remains accurate on the day the key is added, which is
 * the point of writing it now rather than after.
 *
 * ⚠ THE COOKIE SENTENCE IS LOAD-BEARING. persistence is "memory" in
 * lib/analytics/posthog.ts, so no analytics cookie is set and no consent
 * banner is owed. If anyone ever changes that line, this paragraph becomes
 * false and a banner becomes a legal requirement.
 *
 * VERIFIED ABSENT at the time of writing, and therefore NOT described as
 * current processing: Stripe and Resend are not installed and appear nowhere
 * in src/. Stripe is described conditionally because payments are planned;
 * Resend is simply not mentioned. The same release rule applies to both.
 *
 * Nothing here claims a certification, a DPO, or an ICO registration number.
 * None was supplied and none is invented.
 */
export default async function PrivacyPage() {
  const session = await getNavSession();

  return (
    <>
      <SiteNav session={session} />

      <LegalPage
        title="Privacy Policy"
        intro={`This explains what personal information Ailemy collects, why we hold it, and what you can ask us to do with it. We have tried to write it in plain English rather than legal language. ${COMPANY.legalName}, trading as ${COMPANY.tradingName}, is the data controller for the information described here.`}
      >
        <Clause heading="Who we are">
          <p>
            Ailemy is an online science tuition and exam-practice platform operated by{" "}
            {COMPANY.legalName}. For anything in this policy — including a request to see, correct
            or delete your data — contact us at{" "}
            <span className="font-mono text-sm">{COMPANY.supportEmail}</span>.
          </p>
        </Clause>

        <Clause heading="What we collect, and why">
          <p>We hold four kinds of information, and no more than that.</p>
          <Bullets
            items={[
              <>
                <strong>Your account.</strong> Your email address, your name if you give it, and
                the course and qualification you are studying. We need this to sign you in and
                show you the right material.
              </>,
              <>
                <strong>Your learning records.</strong> Lessons you open, answers you write,
                papers you attempt, marks awarded and feedback returned. This is the substance of
                the service — without it there is no progress to show you.
              </>,
              <>
                <strong>Enquiry forms.</strong> If you register interest in tuition we record the
                student&apos;s name, an email address, and optionally a parent or guardian&apos;s
                name, phone number, country and time zone. We also record the moment you ticked
                the consent box, so we can show when permission was given.
              </>,
              <>
                <strong>Basic technical data.</strong> The ordinary information any website
                receives — such as your IP address and browser — used to keep the service running
                and secure.
              </>,
            ]}
          />
        </Clause>

        <Clause heading="Our lawful bases, in plain terms">
          <Bullets
            items={[
              <>
                <strong>To provide what you signed up for.</strong> Running your account,
                delivering lessons, marking your work and keeping your progress. In legal terms
                this is performance of a contract.
              </>,
              <>
                <strong>Because you agreed.</strong> Enquiry forms and any marketing email rest on
                your consent, and you can withdraw it at any time.
              </>,
              <>
                <strong>To run the service responsibly.</strong> Keeping the platform secure,
                preventing abuse and fixing faults. In legal terms, our legitimate interests.
              </>,
              <>
                <strong>Because the law requires it.</strong> Keeping financial records once we
                take payments.
              </>,
            ]}
          />
        </Clause>

        <Clause heading="Who else handles your data">
          <p>
            We use a small number of established suppliers to run Ailemy. They process data on our
            instructions and may not use it for their own purposes.
          </p>
          <Bullets
            items={[
              <>
                <strong>Supabase</strong> — hosts our database and handles sign-in. Your account
                and learning records are stored there.
              </>,
              <>
                <strong>Anthropic</strong> — when your written exam answers are marked, the answer
                text and the relevant mark scheme are sent to Anthropic&apos;s Claude models to
                produce the marking. Your name and email are not sent with it.
              </>,
              <>
                <strong>Mux</strong> — delivers lesson and past-paper video.
              </>,
              <>
                <strong>Stripe</strong> — will handle card payments when paid tuition goes live.
                Card details are entered with Stripe and never reach our servers. This does not
                apply yet.
              </>,
              <>
                <strong>PostHog</strong> — product analytics, hosted in the EU. When analytics is
                switched on, we record which pages are opened and which buttons are pressed, so we
                can see where the site is confusing. We send a fixed list of events and nothing
                else: no names, no email addresses, no answers you write, and no recordings of
                your screen or your typing. Analytics is currently switched off.
              </>,
            ]}
          />
          <p>
            <strong>We do not use analytics cookies.</strong> Our analytics is configured to keep
            nothing on your device between visits, which is why you are not asked to accept
            cookies to use Ailemy.
          </p>
          <p>
            <strong>We do not sell your personal data, and we never will.</strong> We do not share
            it with advertisers.
          </p>
        </Clause>

        <Clause heading="Students under 18">
          <p>
            Ailemy is used by school-age students, and much of our tuition is arranged by a parent
            or guardian. Where a student is under 18 we expect a parent or guardian to be involved
            in signing up, and our enquiry form is built to capture their details and their
            consent.
          </p>
          <p>
            A parent or guardian may ask to see, correct or delete their child&apos;s information
            using the contact address above, and we will treat that request as if it came from the
            student.
          </p>
        </Clause>

        <Clause heading="How long we keep it">
          <Bullets
            items={[
              <>
                <strong>Account and learning records</strong> — for as long as your account is
                open. Your progress history is only useful if it persists across a course.
              </>,
              <>
                <strong>After you close your account</strong> — we delete or anonymise your
                records, other than anything we must keep by law.
              </>,
              <>
                <strong>Enquiry forms</strong> — kept while we are in touch about tuition, then
                removed if it does not go ahead.
              </>,
              <>
                <strong>Financial records</strong> — kept for the period UK tax law requires,
                currently six years, once payments begin.
              </>,
            ]}
          />
        </Clause>

        <Clause heading="Your rights">
          <p>Under UK GDPR you can ask us to:</p>
          <Bullets
            items={[
              "give you a copy of the personal data we hold about you",
              "correct anything that is wrong",
              "delete your data, where we are not required to keep it",
              "stop or limit certain uses, including withdrawing consent",
              "provide your data in a portable form",
            ]}
          />
          <p>
            Write to <span className="font-mono text-sm">{COMPANY.supportEmail}</span> and we will
            respond within one month.
          </p>
          <p>
            If you are unhappy with how we have handled your information you can complain to the
            Information Commissioner&apos;s Office, the UK&apos;s data protection regulator, at{" "}
            <Link
              href="https://ico.org.uk/make-a-complaint/"
              className="underline underline-offset-4"
            >
              ico.org.uk
            </Link>
            . We would rather you told us first so we can put it right.
          </p>
        </Clause>

        <Clause heading="Where your data is held">
          <p>
            Our suppliers may process data outside the UK. Where they do, they are covered by
            safeguards recognised under UK data protection law, such as the UK addendum to the
            standard contractual clauses.
          </p>
        </Clause>

        <Clause heading="Changes to this policy">
          <p>
            If we change how we use your data we will update this page and change the date at the
            top. Where a change matters to you, we will tell you directly.
          </p>
        </Clause>
      </LegalPage>

      <SiteFooter />
    </>
  );
}
