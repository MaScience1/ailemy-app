# HANDOVER — Arabic localisation, Phase 1

Branch `feat/i18n-arabic-phase-1`. **Not merged, no PR.**

**The merge gate is the review table in §2.** Every Arabic string below is a
draft written by Claude and marked `UNREVIEWED` in `messages/ar.json`. None of
it has been read by a native speaker. Nothing here should reach a paying parent
until you have gone through that table.

---

## 1. What shipped

| Area | State |
|---|---|
| next-intl 4.13.7, `app/[locale]/`, `localePrefix: "as-needed"` | done |
| English at existing unprefixed URLs (`/`, `/tuition`) | done, verified |
| Arabic at `/ar`, `/ar/tuition` — `lang="ar" dir="rtl"` | done, verified |
| IBM Plex Sans Arabic, self-hosted, `subsets:["arabic"]`, loaded only when `locale==="ar"` | done |
| Language toggle — same page, both directions, query string preserved | done, verified |
| `messages/en.json` / `messages/ar.json` (47 keys, parity enforced by test) | done |
| Global nav wired to the catalogue | done |
| Physical → logical CSS across all in-scope trees (19 swaps) | done |
| Two new guards (`i18n-rtl.test.ts`) | done |

### Two things about this Next version that cost real time

**Middleware is `proxy.ts` in Next 16.** `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md:15` — *"Starting with Next.js 16, Middleware is now called Proxy"*. next-intl's own documentation still tells you to create `middleware.ts`, which in this version simply never runs: every Arabic URL would 404 with nothing in the logs.

**`src/proxy.ts` already existed and I overwrote it.** It ran Supabase's `updateSession` on nearly every request. My first check looked for `middleware.ts` and reported "none", which was wrong. It is restored and the two concerns are now composed in one file — Next permits only one. The auth refresh runs first, an auth redirect wins outright, and the refreshed cookies are copied onto the locale response. `i18n-rtl.test.ts` asserts all three, because losing that refresh expires sessions silently, mid-lesson.

---

## 2. Review table — every Arabic string

Modern Standard Arabic, Gulf register, addressed to a parent. Western numerals
throughout. Tick the box or write the correction.

| Key | English | Arabic (UNREVIEWED) | OK? |
|---|---|---|---|
| `nav.resources` | Resources | المصادر | ☐ |
| `nav.pastPapers` | Past Papers | الامتحانات السابقة | ☐ |
| `nav.examBuilder` | Exam Builder | منشئ الامتحانات | ☐ |
| `nav.onlineTuition` | Online Tuition | الدروس عبر الإنترنت | ☐ |
| `nav.login` | Login | تسجيل الدخول | ☐ |
| `nav.startFree` | Start free | ابدأ مجانًا | ☐ |
| `nav.openMenu` | Open menu | فتح القائمة | ☐ |
| `nav.closeMenu` | Close menu | إغلاق القائمة | ☐ |
| `nav.subjects` | Subjects | المواد | ☐ |
| `language.label` | Language | اللغة | ☐ |
| `language.english` | English | English | ☐ |
| `language.arabic` | العربية | العربية | ☐ |
| `language.switchTo` | Switch to {language} | التبديل إلى {language} | ☐ |
| `tuition.eyebrow` | Online Tuition | الدروس عبر الإنترنت | ☐ |
| `tuition.modeOneToOne` | 1-to-1 | فردي | ☐ |
| `tuition.modeGroup` | Group | مجموعات | ☐ |
| `tuition.oneToOneSub` | Private lessons, your pace | دروس خاصة وفق وتيرة الطالب | ☐ |
| `tuition.groupSub` | Small classes, fixed timetable | مجموعات صغيرة بجدول ثابت | ☐ |
| `tuition.singleLesson` | Single lesson | درس واحد | ☐ |
| `tuition.fiveHourPackage` | 5-hour package | باقة 5 ساعات | ☐ |
| `tuition.oneHour` | One hour | ساعة واحدة | ☐ |
| `tuition.perHour` | {amount} per hour | {amount} للساعة | ☐ |
| `tuition.save` | save {amount} | توفير {amount} | ☐ |
| `tuition.pricingUnavailable` | Pricing unavailable | السعر غير متاح | ☐ |
| `tuition.pricingTemporarilyUnavailable` | Pricing temporarily unavailable — please try again shortly. | السعر غير متاح مؤقتًا — يرجى المحاولة بعد قليل. | ☐ |
| `tuition.groupTuition` | Group tuition | دروس جماعية | ☐ |
| `tuition.perMonth` | per month | شهريًا | ☐ |
| `tuition.monthsUpfront` | {months} months upfront | {months} أشهر مقدمًا | ☐ |
| `tuition.aMonthForMonths` | {amount} a month · {months} months | {amount} شهريًا · {months} أشهر | ☐ |
| `tuition.bestValueOver` | Best value over {months} months | أفضل قيمة على مدى {months} أشهر | ☐ |
| `tuition.saveAmount` | Save {amount} | توفير {amount} | ☐ |
| `tuition.datesNotPublished` | The academic programme dates for this cohort are not published yet. | لم تُنشر مواعيد البرنامج الدراسي لهذه المجموعة بعد. | ☐ |
| `tuition.teachingHoursAWeek` | {hours} teaching hours a week | {hours} ساعات تدريس أسبوعيًا | ☐ |
| `tuition.placesTaken` | {taken} of {cap} places taken | {taken} من {cap} مقعدًا محجوز | ☐ |
| `tuition.maximumStudents` | Maximum {cap} students | بحد أقصى {cap} طالبًا | ☐ |
| `tuition.registerInterest` | Register interest | سجّل اهتمامك | ☐ |
| `tuition.reserveYourPlace` | Reserve your place | احجز مقعدك | ☐ |
| `tuition.seeCourseRoadmap` | See course roadmap | اطّلع على خطة المقرر | ☐ |
| `tuition.coversTeaching` | Covers teaching from {from} to {to}. | يغطي التدريس من {from} إلى {to}. | ☐ |
| `commitment.monthly` | 1 month | شهر واحد | ☐ |
| `commitment.three_month` | 3 months | 3 أشهر | ☐ |
| `commitment.academic_year` | Academic year | العام الدراسي | ☐ |
| `currency.label` | Currency | العملة | ☐ |
| `currency.qar` | QAR | QAR | ☐ |
| `currency.gbp` | GBP | GBP | ☐ |
| `common.loading` | Loading… | جارٍ التحميل… | ☐ |
| `common.somethingWentWrong` | Something went wrong. Please try again. | حدث خطأ ما. يرجى المحاولة مرة أخرى. | ☐ |
**Deliberately not translated**, per the brief: `Ailemy`, `Edexcel`, `IAL`,
`GCSE`, `IGCSE`, `QAR`, `GBP`, and `Chemistry` / `Biology` / `Physics` where
they name a qualification or subject. A test fails if any of them disappears
from the Arabic catalogue.

**Two I am least sure of and would look at first:**

- `tuition.placesTaken` — "{taken} من {cap} مقعدًا محجوز". Arabic number
  agreement changes the noun form depending on the count; this reads correctly
  for most values but not all. It may need ICU plural rules rather than one
  string.
- `tuition.bestValueOver` — "أفضل قيمة على مدى {months} أشهر". Same problem:
  أشهر is the 3–10 form. At 1 or 11+ months it is wrong.

Both need a plural-aware form. I did not guess at one.

---

## 3. Fixed/sticky elements at 375px in RTL

**The brief says 19. I found 22.** Enumerated from source, then filtered to
those that render on an in-scope page.

| # | Element | In scope? | Anchoring | RTL at 375 |
|---|---|---|---|---|
| 1 | `home/StickyCta.tsx:105` | yes (homepage) | `inset-x-0 bottom-0`, `sm:end-6` | **PASS** — measured left 0 / right 0, width 375, no overflow |
| 2 | `tuition/TuitionCta.tsx:322` | yes (/tuition) | `inset-x-0 bottom-0` | **PASS** — symmetric, no overflow at 375 |
| 3 | `home/QuickSignup.tsx:135` backdrop | yes (homepage) | `fixed inset-0` | **PASS** — symmetric by construction |
| 4 | `home/QuickSignup.tsx:136` panel | yes (homepage) | `left-1/2 -translate-x-1/2` | **PASS after a fix I caused** — see below |
| 5 | `site/SiteNav.tsx:372` mobile drawer | yes (global nav) | `absolute inset-x-0 top-full` | **FAIL — NOT VERIFIED AT RUNTIME.** Anchoring is symmetric and should be safe, but the browser pane stopped responding before I could open it. The brief says an unchecked sticky element is a fail, not an unknown, so it is recorded as a fail. |
| 6 | `site/AccountMenu.tsx:332` dropdown | yes (signed in) | `absolute end-0` (was `right-0`) | **NOT VERIFIED** — needs a signed-in session. Now logical, so it should follow direction. |
| 7 | `admin-inline/AdminOverlay.tsx:42` | admin only | `bottom-5 end-5` | not checked — admin surface, out of scope |
| 8–22 | calendar, exam player, lesson, past-papers, flashcards, admin panels | no | — | out of scope, untouched |

### The regression I introduced and caught

QuickSignup's modal was `left-1/2 … -translate-x-1/2` — symmetric centring,
correct in both directions. My bulk physical→logical swap turned it into
`start-1/2`, which in RTL positions from the right edge and *then* shifts left
by half the width, landing the modal off-centre. Reverted, and the guard now
exempts that exact pair with the reason written into it, because Tailwind has no
logical translate to pair with `start-`.

---

## 4. The two guards

`scripts/exam-seed/__tests__/i18n-rtl.test.ts`.

**Guard 1 — physical CSS.** Fails on `ml- mr- pl- pr- left- right- text-left
text-right` anywhere in the i18n'd trees. Comments are stripped first:
`CapabilityStrip.tsx` contains the prose "left-aligned", and a raw scan fails a
file that is already correct. `border-l`/`border-r` are **reported, not
enforced** — this Tailwind version has no logical border-side utility, so
banning them would be a rule with no compliant alternative. The count prints on
every run.

**Guard 2 — hardcoded strings.** Strict over enrolled files (`SiteNav`,
`LanguageToggle`): they must call `useTranslations`, and no JSX text node may be
a capitalised English phrase outside the allowed proper-noun list. **The backlog
of 18 in-scope files that still hold English literals is PRINTED on every run**
rather than hidden by scoping the guard to nothing.

---

## 5. Assumptions I made

1. **`__status` is per namespace, not per string.** "Every string carries
   `__status`" would require each value to become an object, which next-intl
   cannot render. There is a top-level marker plus one per namespace, and this
   table is the real gate.
2. **`next/font/google` counts as self-hosted.** It downloads at build time and
   serves from our origin — no runtime request to Google. If you want the
   `.woff2` committed to the repo, say so and it becomes `next/font/local`.
3. **The catch-all moved.** `app/(site)/[...slug]` is now
   `app/[locale]/(site)/[...slug]`. A root `[locale]` outranks a catch-all, so
   admin-authored pages like `/about` would have been captured as
   `locale="about"` and rendered the homepage. Verified: `/some-unknown-admin-page`
   returns 404 via the catch-all, not the homepage.
4. **Locale detection is OFF.** next-intl's default reads `Accept-Language` and
   redirects. A Qatari parent's iPhone commonly reports `ar-QA`, so detection
   would silently move existing visitors onto UNREVIEWED Arabic. Language is an
   explicit choice until you sign off the strings.

---

## 6. Questions that need your ruling

0. **A pre-existing failure I did not cause, and did not touch.**
   `tuition-booking.test.ts` fails one assertion: *"⚠ it is PARKED — a plain
   number would be replayed by a rebuild"*.

   `supabase/migrations/0069_PROPOSED_fix_book_slot_with_credit.sql` is renamed
   to `0069_fix_book_slot_with_credit.sql` in your working tree — staged,
   uncommitted, and present before this branch was created (HEAD still carries
   the `_PROPOSED_` name). **The file's header still says `NOT APPLIED`.**

   That is the exact drift 0063 exists to memorialise: renaming off `_PROPOSED_`
   and re-heading the file are one step, not two. The guard is doing its job.

   I have not touched the file or staged the rename — it is your change and only
   you know whether 0069 was actually applied. Two ways out:
   - if it IS applied: update the header to `⚠ APPLIED <date>` with the step
     counts, as 0068 does, and the assertion passes;
   - if it is NOT: `git mv` it back to `0069_PROPOSED_…`.

   **This is the one failing assertion in the suite. Everything else is green.**


1. **Cookie persistence on a bare URL.** The toggle persists via the URL, and
   every internal link carries the locale. Remembering the choice when somebody
   returns to a bare `/tuition` needs `localeDetection: true`, which also turns
   on `Accept-Language` redirects — and that is the thing I deliberately did not
   do (assumption 4). Do you want cookie-only persistence? It needs custom
   handling in `proxy.ts`.
2. **The toggle's English href is `/en/tuition`.** It redirects to `/tuition`,
   so it works and the canonical URL is unprefixed — but it costs one hop. Worth
   removing?
3. **Out-of-scope pages have no Arabic version.** The toggle is in the global
   nav, so it appears on `/calendar` too and would offer a switch to a page that
   does not exist. Hide it there, or point it at the English page?
4. **Plurals** — see §2.

---

## 7. What was skipped, and why

- **Homepage and tuition-card body copy are still English literals.** 18 files.
  The mechanism is in place and the nav proves it end to end; extracting ~200
  more strings is phase 2 and the guard prints the backlog so it cannot be
  forgotten.
- **Internal links inside localised pages still use `next/link`.** Confirmed
  defect: on `/ar/tuition` the 1-to-1 / Group tabs point at
  `/tuition?mode=…` and drop the reader into English. They need
  `@/i18n/navigation`'s `Link`. Not fixed — it touches every link on the page
  and I would rather do it with the string extraction.
- **SEO hreflang, sitemap, PDFs, lesson content, `/calendar`, `/admin`, auth,
  dashboards, database content** — all out of scope, untouched.
- **No migrations, no SQL, no Stripe, no env vars, no `viewport-fit`.**
  `availabilityFor` untouched. Prices still read live from Stripe: the Arabic
  page shows the same numbers as the English page.

---
---

# HANDOVER — Multi-subject tuition + Register Interest, Phase 1

Branch `feat/tuition-multi-subject`, off `feat/i18n-arabic-phase-1`. **Not merged, no PR.**
This section is appended; the Arabic phase-1 handover above is unchanged.

**Status: partial. The subject selector, status model, coming-soon funnel and
proposed schema are built and green. The interest FORM, admin demand dashboard,
"My interests" area and CSV export are NOT built.** Details in §14 below.

## 1. Files changed

`src/lib/tuition/subjects.ts` (new) · `src/lib/tuition/interest-capability.ts` (new) ·
`src/components/tuition/SubjectSelector.tsx` (new) ·
`src/components/tuition/SubjectComingSoon.tsx` (new) ·
`src/app/[locale]/tuition/page.tsx` · `src/lib/analytics/events.ts` ·
`messages/en.json` · `messages/ar.json` ·
`scripts/exam-seed/__tests__/tuition-subjects.test.ts` (new) ·
`supabase/migrations/_PROPOSED_tuition_subject_interest.sql` (new, unnumbered, unapplied)

## 2–3. Subject selector and status model

Five subjects: chemistry, biology, physics, maths, english. **Status is derived,
not declared.** `subjectState()` counts real cohort rows for the subject and calls
`availabilityFor` — which is read, never modified. A subject with cohorts is
ACTIVE; one without is INTEREST. Seed a Biology cohort and the badge changes on
the next read, with no code edit. A test asserts exactly that.

`SubjectKey` in the design system stays `chemistry | biology | physics`. Widening
it would push two contentless subjects into Resources, Past Papers and the lesson
trees (§36), so maths and english live in the tuition list and render on the
neutral card treatment rather than getting invented brand colours.

**ACTIVE is not the same as purchasable.** Chemistry is ACTIVE and its CTAs still
read "Register interest", because `availabilityFor` separately requires an
`enrolment_url`. The two ideas are deliberately distinct.

## 4. URL state

`?subject=` on `/tuition`, defaulting to chemistry. `/tuition?mode=group` and
`/tuition?mode=one-to-one` are unchanged and still land on the live Chemistry
experience. An unknown value (`?subject=astrology`) falls back to chemistry
rather than 404ing or rendering an empty picker.

## 6. Questions captured — NOT YET, see §14

## 7–8. Storage approach, and the proposed SQL

**Planning override 3 assumed a new table is needed. Inspection says otherwise,
and this is the main finding of the job.**

`public.interest_registrations` (0040, extended by 0043) already holds **24 data
columns**, including subject, qualification, exam_board, student_name,
parent_name, email, phone, country, timezone, current_grade, target_grade,
preferred_days, preferred_times, year_group, exam_year, student_notes,
consent_to_contact and consent_at. It is **live** — the existing
`/tuition/interest` page inserts into it under the anon key today.

A second table would be the "unnecessary parallel lead database" §20 forbids and
would split real leads across two stores with no key to join them. So the
proposed file is an **ALTER**, adding the 11 columns that genuinely do not
exist: `user_id`, `tuition_mode`, `mode_preference`, `registrant_role`, `goals`,
`start_timeframe`, `contact_preference`, `consent_to_marketing`,
`marketing_consent_at`, `phone_e164`, `withdrawn_at` — plus the partial unique
upsert key and the erasure.

**Founder ruling wanted:** if you would rather have a separate table, say so and
the file becomes a `CREATE TABLE`. Nothing depends on the choice — nothing is
applied.

Three things the inspection turned up that would have bitten later:

- `status` is CHECK-pinned to `('new','contacted','converted','declined','duplicate')`,
  so §13's **withdraw would violate the constraint**. The vocabulary is extended,
  not replaced.
- 0040 grants **table-wide UPDATE** to `authenticated`. RLS filters rows but never
  columns, so a student could rewrite `status` or the staff `notes` on their own
  row. The proposal narrows it to a column-level grant.
- The upsert key is **partial on `user_id`**. A plain UNIQUE would collapse every
  existing anonymous lead into one row.

### erase_user (planning override 4)

Mandatory and included in the same file. The table names real people including
minors. `ON DELETE CASCADE` is **not sufficient** — 0067 v5 erases in place on
the retained-account path, so the cascade never fires. Two deletes are proposed:
by `user_id`, and by lowercased email for the anonymous rows the existing funnel
writes.

**`email_columns_scanned` will still read 8 after this applies.**
`interest_registrations.email` already exists and is already counted by 0067's
gate; this file adds no new email column. If it reads anything other than 8,
something else moved and the erasure must not be trusted until it is explained.

## 5 + 9–10. Auth flow, admin dashboard, analytics

Auth return-to-form: **not built** (§14). Admin dashboard: **not built** (§14).
Analytics: `tuition_subject_selected` and `tuition_interest_started` are declared
in `CTA_SOURCES` and emitted from the selector and the coming-soon CTA. They
carry subject and mode only — no free text, no contact detail. The remaining §26
events belong with the form.

## 11–13. Verification

Rendered, by request against the dev server:

| URL | prices | calendar | coming-soon |
|---|---|---|---|
| `/tuition?mode=group` (legacy) | £170.90 / £140.74 | yes | no |
| `?subject=chemistry&mode=one-to-one` | 16 amounts | yes | no |
| `?subject=biology&mode=group` | none | none | yes |
| `?subject=maths&mode=one-to-one` | none | none | yes |
| `?subject=astrology` | falls back to chemistry | | |

**A defect this caught:** the "Choose your time" calendar section sits outside the
mode component and was rendering on the maths and biology pages — real Chemistry
slots under a heading implying they were maths slots. Real data, false claim,
exactly what §6 forbids. Now gated, with an assertion.

Gate: typecheck clean **both** configs, build exit 0, **66 suites**.
`tuition-subjects.test.ts` adds 42 assertions; four sabotage runs, each made red
and restored (hardcoded chemistry check; `head:true` probe that swallows 42703;
a price on the coming-soon panel; the calendar gate removed).

**One failing assertion, pre-existing and not from this branch** — the 0069
`_PROPOSED_` rename described in the i18n handover §6.0 above. Untouched.

## Arabic review table — new strings (all UNREVIEWED)

| Key | English | Arabic | OK? |
|---|---|---|---|
| `subjects.chemistry` | Chemistry | الكيمياء | ☐ |
| `subjects.biology` | Biology | الأحياء | ☐ |
| `subjects.physics` | Physics | الفيزياء | ☐ |
| `subjects.maths` | Maths | الرياضيات | ☐ |
| `subjects.english` | English | اللغة الإنجليزية | ☐ |
| `subjects.chooseSubject` | Choose a subject | اختر المادة | ☐ |
| `subjects.statusActive` | Active | متاحة | ☐ |
| `subjects.statusComingSoon` | Coming soon | قريبًا | ☐ |
| `subjects.liveTuitionAvailable` | Live tuition available | دروس مباشرة متاحة | ☐ |
| `subjects.registerInterest` | Register interest | سجّل اهتمامك | ☐ |
| `subjects.comingSoonTitle` | {subject} tuition | دروس {subject} | ☐ |
| `subjects.comingSoonBadge` | Coming soon | قريبًا | ☐ |
| `subjects.comingSoonBlurbOneToOne` | Tell us what you're studying and we'll let you know when Ailemy {subject} 1-to-1 tuition opens. | أخبرنا بما يدرسه ابنك وسنُعلمك عند افتتاح دروس {subject} الفردية في Ailemy. | ☐ |
| `subjects.comingSoonBlurbGroup` | We'll form cohorts around qualification, exam board and compatible schedules. | سنُشكّل المجموعات وفق المؤهل ومجلس الامتحان والجداول المتوافقة. | ☐ |
| `subjects.helpUsDecide` | Register your interest and help us decide which classes open first. | سجّل اهتمامك وساعدنا في تحديد الصفوف التي تُفتتح أولًا. | ☐ |
| `subjects.registerYourInterest` | Register your interest | سجّل اهتمامك | ☐ |
| `subjects.exploreResources` | Explore {subject} resources | استعرض مصادر {subject} | ☐ |
| `subjects.interestUnavailable` | Interest registration is not open yet. Please check back shortly. | تسجيل الاهتمام غير متاح بعد. يرجى المحاولة لاحقًا. | ☐ |
Least sure: `subjects.english` — "اللغة الإنجليزية" is the language; if the subject
is English Literature rather than Language the term should differ.

## 14. Not built — and why

- **The interest form itself** (§9, §10) — 13 questions across 4 steps.
- **Auth return-to-context** (§8) — recon found the login/signup redirect
  handling; whether it allowlists the redirect target is an **open security
  question** I have not resolved. Not built rather than built unsafely.
- **Admin demand dashboard, lead detail, CSV export** (§14–§17).
- **"My tuition interests"** (§13).
- **§39 repo-wide audit, §38 multi-width visual review.**

All of it depends on the schema being applied. Override 5 says the feature will
not work tonight and that is correct: `interestCapability()` probes for the
`tuition_mode` column with `select(col).limit(1)` — a shape that surfaces a
missing column as 42703, where `head:true` would report success against a schema
that cannot hold the data. Today it returns false, so the coming-soon panel
renders "Interest registration is not open yet" instead of a button. **No stubbed
success, no localStorage, no JSON fallback.**

## 15. NO Chemistry Stripe Products or Prices were modified.

Read-only throughout. No product, price, Payment Link, webhook or env var was
created, changed or archived. The 13 live prices and 3 cohort links are untouched,
and Chemistry pricing renders from the same Stripe Price objects as before.

## 16. NO Biology, Physics, Maths or English Stripe Products/Prices were created.

There is no Stripe identifier anywhere in the new code — a test asserts the
absence of `prod_`/`price_` in the subject model and the coming-soon panel.
