/**
 * The conversion-objection FAQ (§30).
 *
 * ============================================================================
 * ⚠ EVERY ANSWER IS TRUE OF THE PRODUCT AS IT STANDS TODAY
 * ============================================================================
 * §30 says "only answer according to genuine functionality". That constrains
 * three answers in particular, and each is easy to overstate:
 *
 *   Biology / Physics — past papers ARE available; lessons and tuition are not.
 *     "Coming soon" would be a promise with no date behind it.
 *   Marking — mark-scheme-derived rules, human-reviewed. NOT "AI marks your
 *     work", which the published privacy policy and the marking audit gate both
 *     forbid claiming.
 *   1-to-1 — bookable slots appear in the calendar; in-app checkout is not
 *     live. Saying "book online now" would be a dead promise.
 *
 * ⚠ NO <details> WITHOUT A REASON. Native disclosure gives keyboard, Escape and
 * screen-reader semantics for free and needs no JavaScript, which keeps this a
 * server component on the heaviest page of the site. An accordion library here
 * would buy an animation and cost the server/client boundary.
 *
 * ⚠ AND THE ANSWERS ARE IN THE HTML, COLLAPSED — not fetched on expand. §36
 * requires marketing content to be crawlable without hydration, and a <details>
 * body is in the document whether or not it is open.
 */

type Faq = { q: string; a: React.ReactNode };

const FAQS: Faq[] = [
  {
    q: "Is Ailemy free?",
    a: (
      <>
        Creating an account, browsing past papers and practising questions are free. Live
        tuition is paid — Chemistry AS is £169 a month. There is no card required to start
        practising.
      </>
    ),
  },
  {
    q: "Which exam boards does Ailemy support?",
    a: (
      <>
        Pearson Edexcel, across GCSE, International GCSE and International A Level. Ailemy is
        not affiliated with or endorsed by any examination board.
      </>
    ),
  },
  {
    q: "Can I use Ailemy without joining tuition?",
    a: (
      <>
        Yes. Lessons, past papers, exam questions, marking and progress tracking work on their
        own — live tuition is a separate thing you can add, not a gate in front of the rest.
      </>
    ),
  },
  {
    q: "How does Ailemy mark my answers?",
    a: (
      <>
        Against the points a published mark scheme awards, with the reason for each one. The
        marking rules are derived from those schemes and human-reviewed by a subject specialist
        before they are used on anyone&rsquo;s work — so feedback tells you which marking point
        you missed, not just a score.
      </>
    ),
  },
  {
    q: "Is live tuition online?",
    a: (
      <>
        Yes — small groups, taught live, capped at 20. Chemistry AS runs Tuesday and Saturday,
        7:00–9:30 PM Doha time, from 15 September 2026.
      </>
    ),
  },
  {
    q: "What timezone are lessons shown in?",
    a: (
      <>
        Doha, with your own local time shown alongside wherever a lesson time appears. Ailemy
        teaches from Doha and students join from anywhere, so both are always visible rather
        than one being assumed.
      </>
    ),
  },
  {
    q: "What happens after I join a course?",
    a: (
      <>
        You get the timetable in your own calendar, the lessons and resources for the course,
        homework and exam practice that is marked, and progress tracking that shows which
        topics still need work.
      </>
    ),
  },
  {
    q: "Can I book 1-to-1 tuition?",
    a: (
      <>
        One-to-one Chemistry runs in limited blocks and available times appear in the
        timetable. Booking is arranged directly at the moment — online booking is being built.
      </>
    ),
  },
  {
    q: "Is Biology available?",
    a: (
      <>
        Biology past papers are available now. Structured Biology lessons and live tuition are
        expanding — you can register interest for priority access when they open.
      </>
    ),
  },
  {
    q: "Is Physics available?",
    a: (
      <>
        The same as Biology: past papers now, with structured lessons and tuition expanding.
        Register interest and you will hear first.
      </>
    ),
  },
];

export function HomeFaq() {
  return (
    <div className="divide-y divide-ink/10 border-y border-ink/10">
      {FAQS.map((f) => (
        <details key={f.q} className="group py-1">
          <summary
            className="flex cursor-pointer list-none items-center justify-between gap-4 py-3.5 text-sm font-medium transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink [&::-webkit-details-marker]:hidden"
          >
            {f.q}
            {/* ⚠ aria-hidden. The open/closed state is already announced by the
                native disclosure; a screen reader reading "plus" as well is
                noise. Rotates rather than swapping glyph, so there is one
                element and no layout shift. */}
            <span
              aria-hidden
              className="shrink-0 text-lg leading-none text-ink/35 transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
            >
              +
            </span>
          </summary>
          <p className="max-w-3xl pb-4 text-sm leading-relaxed text-ink/70">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
