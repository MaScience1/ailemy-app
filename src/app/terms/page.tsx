import type { Metadata } from "next";
import Link from "next/link";

import { Bullets, Clause, LegalPage } from "@/components/legal/LegalPage";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { getNavSession } from "@/lib/auth/nav-session";
import { COMPANY } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Terms of Service — Ailemy",
  description:
    "The terms on which Rentic Ltd, trading as Ailemy, provides online tuition and exam practice.",
};

/**
 * ⚠ NO GRADE PROMISE APPEARS ANYWHERE ON THIS PAGE, and the clause saying so is
 * deliberately plain rather than buried. A tuition service that implies an
 * outcome it cannot control is making a claim it will be held to.
 *
 * ⚠ PEARSON EDEXCEL MATERIAL IS THEIRS. Past papers and mark schemes are
 * reproduced for study; the clause says who owns them rather than implying we
 * do. Ailemy's own lessons and written material remain Ailemy's.
 *
 * Billing is described conditionally because Stripe is not yet installed —
 * see the note in the privacy page. Nothing here says payments are live.
 */
export default async function TermsPage() {
  const session = await getNavSession();

  return (
    <>
      <SiteNav session={session} />

      <LegalPage
        title="Terms of Service"
        intro={`These are the terms on which you use Ailemy. They form an agreement between you and ${COMPANY.legalName}, which trades as ${COMPANY.tradingName}. By creating an account or booking tuition you accept them.`}
      >
        <Clause heading="Your account">
          <Bullets
            items={[
              "You need an account to study with us. Keep your sign-in details to yourself — anything done through your account is treated as done by you.",
              "Give us accurate details when you sign up, and keep them current.",
              "If you are under 18, a parent or guardian should set the account up with you and is responsible for any fees.",
              "You can close your account at any time. We may suspend or close an account that breaks these terms.",
            ]}
          />
        </Clause>

        <Clause heading="Using Ailemy properly">
          <p>The service is for your own study. Please do not:</p>
          <Bullets
            items={[
              "share your account, or let anyone else use it",
              "copy, download in bulk, resell or republish our lessons, questions, mark schemes or video",
              "use automated tools to scrape the site",
              "attempt to break, overload or gain unauthorised access to any part of the platform",
              "upload anything unlawful, or abusive towards our staff or other students",
            ]}
          />
          <p>
            We may withdraw access if any of this happens, and we will tell you why unless we are
            prevented from doing so.
          </p>
        </Clause>

        <Clause heading="Tuition, fees and billing">
          <Bullets
            items={[
              "Some material is free. Live tuition and certain courses are paid, and the price is shown before you commit.",
              <>
                Payments are taken through <strong>Stripe</strong>. You give your card details to
                Stripe, not to us — we never see or store your card number.
              </>,
              "Where tuition is sold as a block of sessions, the fee covers that block. If we cancel a session we will reschedule it or refund that part of the fee.",
              "You have the cancellation rights the law gives you as a consumer. If you want to start a course immediately you may be asked to agree that the cancellation period does not apply to material already delivered.",
              "We may change our prices, but never for tuition you have already paid for.",
            ]}
          />
          <p className="text-ink/55 text-sm">
            Paid tuition is not yet live on this site. When it launches, this section applies from
            that date.
          </p>
        </Clause>

        <Clause heading="Who owns what">
          <Bullets
            items={[
              <>
                <strong>Past papers and mark schemes are the property of Pearson Edexcel.</strong>{" "}
                They are examination materials published by Pearson, reproduced here for study.
                They remain Pearson&apos;s, we make no claim to them, and Ailemy is not endorsed
                by or affiliated with Pearson.
              </>,
              <>
                <strong>Everything else on Ailemy is ours.</strong> Our lessons, explanations,
                written questions, video, specification mapping, marking and the site itself
                belong to {COMPANY.legalName}.
              </>,
              <>
                <strong>Your work stays yours.</strong> Answers you write remain your own. You
                allow us to store and process them so we can mark them and show you your
                progress.
              </>,
            ]}
          />
        </Clause>

        <Clause heading="What we do not promise">
          <p>
            <strong>We cannot and do not guarantee any grade or exam result.</strong> Ailemy is a
            study tool. What you achieve depends on your own work, your school, your exam board
            and the day itself. Any marks, predictions or progress figures we show are an
            indication of how you are doing with us, not a forecast of your result.
          </p>
          <p>
            We aim to keep the service available and accurate, but we do not promise it will be
            uninterrupted or free of errors, and we may change or withdraw parts of it.
          </p>
        </Clause>

        <Clause heading="Our liability">
          <p>
            If we fail to meet these terms we are responsible for loss you suffer that is a
            foreseeable result of that failure.{" "}
            <strong>
              Our total liability to you is limited to the fees you have paid us in the twelve
              months before the problem arose.
            </strong>
          </p>
          <p>
            We do not exclude liability for death or personal injury caused by our negligence, for
            fraud, or for anything else that cannot be excluded by law. Nothing here affects your
            statutory rights as a consumer.
          </p>
        </Clause>

        <Clause heading="Privacy">
          <p>
            How we handle your personal information is set out in our{" "}
            <Link href="/privacy" className="underline underline-offset-4">
              Privacy Policy
            </Link>
            .
          </p>
        </Clause>

        <Clause heading="Changes, and the law that applies">
          <p>
            We may update these terms. If a change materially affects you we will tell you before
            it takes effect, and the date at the top of this page will change.
          </p>
          <p>
            These terms are governed by the law of <strong>England and Wales</strong>, and the
            courts of England and Wales have jurisdiction over any dispute. If you live elsewhere
            in the UK you may also bring proceedings in your own country.
          </p>
          <p>
            Questions about these terms:{" "}
            <span className="font-mono text-sm">{COMPANY.supportEmail}</span>.
          </p>
        </Clause>
      </LegalPage>

      <SiteFooter />
    </>
  );
}
