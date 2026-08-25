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

## Arabic review table — phase 1b, 348 NEW strings (all UNREVIEWED)

**Every row below needs your eyes before this branch merges.** They were
extracted from the eighteen in-scope files by a per-file pass and translated
into Arabic; `messages/ar.json` carries `"__status": "UNREVIEWED"` at the top
level and on every namespace, and the i18n guard fails if either marker is
removed. Numerals are Western throughout, and the brand and qualification
vocabulary — Ailemy, Edexcel, IAL, GCSE, IGCSE, QAR, Chemistry, Biology,
Physics — is left in Latin script per the brief.

⚠ **The catalogue is ahead of the code.** These keys exist and are translated,
but only `ExplorePanel.tsx` currently reads from them — see the note in §14 on
why the remaining seventeen files were not converted in this pass. Reviewing
these strings is still worth doing now: the translations are the slow part, and
the JSX conversion cannot start until they are trusted.

| key | English | Arabic (UNREVIEWED) |
|---|---|---|
| `common.draftPreviewNotice` | This page is a <strong>draft</strong> — visitors get a 404 until you publish it. | هذه الصفحة <strong>مسودة</strong> — سيظهر للزوار خطأ 404 حتى تنشرها. |
| `common.hideThis` | Hide this | إخفاء هذا الشريط |
| `common.monthApril` | April | أبريل |
| `common.monthAugust` | August | أغسطس |
| `common.monthDecember` | December | ديسمبر |
| `common.monthFebruary` | February | فبراير |
| `common.monthJanuary` | January | يناير |
| `common.monthJuly` | July | يوليو |
| `common.monthJune` | June | يونيو |
| `common.monthMarch` | March | مارس |
| `common.monthMay` | May | مايو |
| `common.monthNovember` | November | نوفمبر |
| `common.monthOctober` | October | أكتوبر |
| `common.monthSeptember` | September | سبتمبر |
| `common.notFoundTitle` | Not found · Ailemy | الصفحة غير موجودة · Ailemy |
| `common.tryAgain` | Try again | حاول مرة أخرى |
| `footer.headingAccount` | Account | الحساب |
| `footer.headingLegal` | Legal | معلومات قانونية |
| `footer.headingStudy` | Study | الدراسة |
| `footer.navLabel` | Footer | تذييل الصفحة |
| `footer.tagline` | Ailemy · Pearson Edexcel GCSE, International GCSE and IAL science. | Ailemy · علوم Pearson Edexcel لشهادات GCSE وInternational GCSE وIAL. |
| `heroAvailability.noOneToOneTimesPublished` | No 1-to-1 times are published yet. | لم تُنشر مواعيد الدروس الفردية بعد. |
| `home.audienceHeading` | Using Ailemy as a… | استخدام Ailemy بصفتك… |
| `home.audienceParent` | Parent | ولي أمر |
| `home.audienceParentAction` | See how tuition works | اعرف كيف تسير الدروس |
| `home.audienceParentBody` | Qualified teaching to a published timetable, with the specification, the marking and the progres | تدريس على يد معلّمين مؤهلين وفق جدول معلن، مع وضوح المنهج والتصحيح والتقدّم أمامك. |
| `home.audienceStudent` | Student | طالب |
| `home.audienceStudentBody` | Learn a topic, revise it with notes and flashcards, practise it, and get every answer marked. | تعلّم الموضوع، وراجعه بالملخّصات وبطاقات التذكّر، وتدرّب عليه، واحصل على تصحيح لكل إجابة. |
| `home.audienceTeacher` | Teacher | معلّم |
| `home.audienceTeacherAction` | Browse the resources | تصفّح المصادر |
| `home.audienceTeacherBody` | Specification-mapped lessons, real past papers and mark-scheme-informed marking you can point a  | دروس مرتبطة بالمنهج المقرر، وامتحانات سابقة حقيقية، وتصحيح مبني على نموذج الإجابة يمكنك توجيه صف |
| `home.browsePastPapers` | Browse past papers | تصفّح الامتحانات السابقة |
| `home.continueShort` | Continue | متابعة |
| `home.continueStudying` | Continue studying | تابع الدراسة |
| `home.everyProgrammeIncludes` | Every programme includes | كل برنامج يشمل |
| `home.examBoardDisclaimer` | Chemistry teaching and mark-scheme rulings are prepared by a specialist chemistry teacher workin | يُعدّ تدريسَ الكيمياء وقراراتِ التصحيح معلّمُ كيمياء متخصص، اعتمادًا على نماذج إجابة Edexcel الم |
| `home.exploreDefaultBlurb` | Choose a feature to explore Ailemy. | اختر ميزة لتستكشف Ailemy. |
| `home.exploreEyebrow` | Explore Ailemy | استكشف Ailemy |
| `home.exploreHeading` | Everything you need to learn, practise and improve. | كل ما تحتاجه للتعلّم والتدرّب والتقدّم. |
| `home.faqTitle` | Questions people ask before they start. | أسئلة يطرحها الناس قبل أن يبدأوا. |
| `home.finalCtaTitle` | Ready to improve your grade? | جاهز لرفع درجتك؟ |
| `home.findSomethingToStudy` | Find something to study | ابحث عن شيء لتدرسه |
| `home.freeAccountNoCard` | Free account · no card | حساب مجاني · بدون بطاقة |
| `home.heroHeadlineLine1` | Learn it. Practise it. | تعلّمه. تدرّب عليه. |
| `home.heroHeadlineLine2` | Get it marked. Master the exam. | احصل على التصحيح. أتقن الامتحان. |
| `home.heroLede` | Specification-mapped lessons, revision resources, past papers, exam practice, intelligent markin | دروس مرتبطة بالمنهج المقرر، ومواد مراجعة، وامتحانات سابقة، وتدريب على الامتحان، وتصحيح ذكي، ومتا |
| `home.howLede` | Ailemy knows what you have studied, what you attempted, where you lost marks and what to do next | يعرف Ailemy ما درسته، وما حاولت حلّه، وأين فقدت درجات، وما الخطوة التالية. |
| `home.howTitle` | Everything between learning the topic and sitting the exam. | كل ما بين تعلّم الموضوع ودخول الامتحان. |
| `home.includesExamPractice` | Exam practice | تدريب على الامتحان |
| `home.includesHomework` | Homework | واجبات منزلية |
| `home.includesLiveTeaching` | Live teaching | تدريس مباشر |
| `home.includesMarkingFeedback` | Marking and feedback | تصحيح وملاحظات |
| `home.includesPlatformAccess` | Ailemy platform access | الوصول إلى منصّة Ailemy |
| `home.includesProgressTracking` | Progress tracking | متابعة التقدّم |
| `home.lookingForSomethingElse` | Looking for something else? | تبحث عن شيء آخر؟ |
| `home.markStepCriterion` | The criterion it satisfied — or did not. | المعيار الذي حقّقته — أو لم تحقّقه. |
| `home.markStepPhraseHighlighted` | The phrase that earned the mark, highlighted. | العبارة التي استحقت الدرجة، مميّزة بلون. |
| `home.markStepWhatWouldHaveEarned` | What would have earned the mark you missed. | ما الذي كان سيمنحك الدرجة التي فاتتك. |
| `home.markStepYourAnswer` | Your answer, as you wrote it. | إجابتك كما كتبتها. |
| `home.metaDescription` | Live small-group science tuition, specification-mapped learning, past-paper practice with mark-s | دروس علوم مباشرة في مجموعات صغيرة، وتعلّم مرتبط بالمنهج المقرر، وتدريب على الامتحانات السابقة مع |
| `home.metaTitle` | Ailemy — online science school and exam practice | Ailemy — مدرسة العلوم عبر الإنترنت والتدريب على الامتحانات |
| `home.nextStepContinueLearning` | Continue learning | متابعة التعلّم |
| `home.nextStepEyebrow` | Your next step | خطوتك التالية |
| `home.nextStepSeeProgress` | See your progress | عرض تقدّمك |
| `home.nextStepStudying` | You’re studying | أنت تدرس |
| `home.nextStepTryExamQuestion` | Try an exam question | حلّ سؤال امتحان |
| `home.oneToOneChemistryLimitedBlocks` | One-to-one Chemistry is available in limited blocks | دروس الكيمياء الفردية متاحة بعدد محدود من الحصص |
| `home.pillarExamBuilderAction` | In development | قيد التطوير |
| `home.pillarExamBuilderBody` | Choose topics, difficulty, question styles, maths demand and paper length. | اختر الموضوعات، ومستوى الصعوبة، وأنماط الأسئلة، ومستوى المهارات الرياضية، وطول الامتحان. |
| `home.pillarExamBuilderEyebrow` | Practise exactly what you need | تدرّب على ما تحتاجه بالضبط |
| `home.pillarPastPapersAction` | Explore Past Papers | استعرض الامتحانات السابقة |
| `home.pillarPastPapersBody` | Work through real papers, practise exam technique, and have your answers marked against the mark | حُلّ امتحانات حقيقية، وتدرّب على أسلوب الإجابة، واحصل على تصحيح لإجاباتك وفق نموذج الإجابة. |
| `home.pillarPastPapersEyebrow` | Prepare with real exams | استعدّ بامتحانات حقيقية |
| `home.pillarResourcesAction` | Explore Resources | استعرض المصادر |
| `home.pillarResourcesBody` | Lessons, revision notes, flashcards, definitions, formulae and worked examples. | دروس، وملخّصات مراجعة، وبطاقات تذكّر، وتعريفات، وقوانين، وأمثلة محلولة. |
| `home.pillarResourcesEyebrow` | Learn and revise | تعلّم وراجع |
| `home.pillarTuitionAction` | View Online Tuition | اطّلع على الدروس عبر الإنترنت |
| `home.pillarTuitionBody` | Small-group lessons and 1-to-1 teaching, with real times you can see before you commit. | دروس في مجموعات صغيرة ودروس فردية، بمواعيد حقيقية تطّلع عليها قبل أن تلتزم. |
| `home.pillarTuitionBodyBookable` | Join a group lesson or book available 1-to-1 tuition. | انضم إلى درس جماعي أو احجز درسًا فرديًا متاحًا. |
| `home.pillarTuitionEyebrow` | Learn live | تعلّم مباشرة |
| `home.productsTitle` | Four ways to use Ailemy | أربع طرق للاستفادة من Ailemy |
| `home.progressLede` | Ailemy does not just return a score. It shows the marks you earned, the ones you missed, and wha | لا يعطيك Ailemy درجة فحسب. يوضّح لك الدرجات التي حصلت عليها، والتي فاتتك، وما تفعله حيالها. |
| `home.progressTitle` | Know exactly where you stand. | اعرف موقعك بالضبط. |
| `home.proofAnswersMarked` | Answers marked | إجابات مُصحَّحة |
| `home.proofMarksEyebrow` | See the marks | اطّلع على الدرجات |
| `home.proofMarksTitle` | The mark scheme, not just the topic. | نموذج الإجابة، لا الموضوع فقط. |
| `home.proofNextBody` | Every marked answer is recorded against the specification point it tested, so your topic strengt | كل إجابة مُصحَّحة تُسجَّل مقابل نقطة المنهج التي اختبرتها، فيُبنى مستواك في الموضوع من أسئلة حلل |
| `home.proofNextEyebrow` | Know what is next | اعرف الخطوة التالية |
| `home.proofNextTitle` | Progress at specification level. | تقدّم على مستوى نقاط المنهج. |
| `home.proofPapersCompleted` | Papers completed | امتحانات مكتملة |
| `home.proofSitBody` | Answer question by question and have it marked against the mark scheme — or open the original qu | أجب سؤالًا سؤالًا واحصل على تصحيح وفق نموذج الإجابة — أو افتح ورقة الأسئلة الأصلية ونموذج الإجاب |
| `home.proofSitEyebrow` | Sit the paper | أدِّ الامتحان |
| `home.proofSitTitle` | Don’t just download it. | لا تكتفِ بتنزيله. |
| `home.proofUnitAnswers` | answers | إجابة |
| `home.proofUnitPapers` | papers | امتحان |
| `home.seeItMarkAnAnswer` | See it mark an answer | شاهده يصحّح إجابة |
| `home.smallGroupsCappedAt20` | Small groups · capped at 20 | مجموعات صغيرة · بحد أقصى 20 طالبًا |
| `home.startLearningFree` | Start learning free | ابدأ التعلّم مجانًا |
| `home.startPractisingFree` | Start practising free | ابدأ التدرّب مجانًا |
| `home.stepGetMarked` | Get marked | احصل على التصحيح |
| `home.stepGetMarkedBody` | Marked against the points a real mark scheme awards, with the reason for each. | تصحيح وفق النقاط التي يمنحها نموذج الإجابة الحقيقي، مع سبب كل نقطة. |
| `home.stepImprove` | Improve | تحسّن |
| `home.stepImproveBody` | See exactly what cost you marks, not just what you scored. | اعرف بالضبط ما الذي كلّفك درجات، لا مجرد الدرجة التي حصلت عليها. |
| `home.stepLearn` | Learn | تعلّم |
| `home.stepLearnBody` | Specification-mapped lessons and expert live teaching. | دروس مرتبطة بالمنهج المقرر وتدريس مباشر مع متخصصين. |
| `home.stepMaster` | Master | أتقن |
| `home.stepMasterBody` | Track a topic until the evidence says you are exam-ready. | تابع الموضوع حتى تؤكد النتائج أنك جاهز للامتحان. |
| `home.stepPractise` | Practise | تدرّب |
| `home.stepPractiseBody` | Topic questions, worksheets and full past papers. | أسئلة على الموضوعات، وأوراق عمل، وامتحانات سابقة كاملة. |
| `home.stepSubmit` | Submit | أرسل إجابتك |
| `home.stepSubmitBody` | Answer inside Ailemy — no scanning, no uploading, no waiting. | أجب داخل Ailemy — بلا مسح ضوئي، ولا رفع ملفات، ولا انتظار. |
| `home.subjectsTitle` | Three sciences, one platform | ثلاثة علوم، منصّة واحدة |
| `home.teacherCardDesignedBody` | Lessons, questions and feedback follow the specification students are actually assessed on. | الدروس والأسئلة والملاحظات تتبع المنهج المقرر الذي يُقيَّم عليه الطلاب فعلًا. |
| `home.teacherCardDesignedTitle` | Designed around the exam | مصمَّم حول الامتحان |
| `home.teacherCardMarkSchemesBody` | Ailemy's marking rules are derived from published examination mark schemes — not from a general  | قواعد التصحيح في Ailemy مستخلصة من نماذج الإجابة الرسمية المنشورة — لا من رأي نموذج ذكاء اصطناعي |
| `home.teacherCardMarkSchemesTitle` | Built from real mark schemes | مبني على نماذج إجابة حقيقية |
| `home.teacherCardReviewedBody` | Automated marking rules are human-reviewed before they are used to mark anyone's work. | تُراجَع قواعد التصحيح الآلي بشريًا قبل استخدامها في تصحيح عمل أي طالب. |
| `home.teacherCardReviewedTitle` | Reviewed by subject specialists | مراجَعة من متخصصين في المادة |
| `home.teachersTitle` | Built by teachers who understand the exam. | من إعداد معلّمين يفهمون الامتحان. |
| `home.trustBuiltBySpecialists` | Built by subject specialists | من إعداد متخصصين في المادة |
| `home.trustEveryAnswerMarked` | Every answer marked | تصحيح كل إجابة |
| `home.trustMarkSchemeInformed` | Mark-scheme-informed | مبني على نموذج الإجابة |
| `home.trustProgressTracked` | Progress tracked | تتبُّع التقدّم |
| `home.trustSpecificationMapped` | Specification-mapped | مرتبط بالمنهج المقرر |
| `home.trustStripLabel` | What Ailemy is | ما هو Ailemy |
| `home.tryLede` | This is how Ailemy marks — against the points a real mark scheme awards, with the reason for eac | هكذا يصحّح Ailemy — وفق النقاط التي يمنحها نموذج الإجابة الحقيقي، مع سبب كل نقطة. |
| `home.tryTitle` | Try it. Write an answer and see it marked. | جرّبها. اكتب إجابة وشاهد تصحيحها. |
| `home.tuitionSectionLede` | Small-group science tuition built around the exact specification and exam requirements. | دروس علوم في مجموعات صغيرة مبنية على المنهج المقرر ومتطلبات الامتحان بالتحديد. |
| `home.tuitionSectionTitle` | Learn live with Ailemy | تعلّم مباشرة مع Ailemy |
| `home.tuitionShort` | Tuition | الدروس |
| `home.viewLiveTuition` | View live tuition | اطّلع على الدروس المباشرة |
| `home.yourProgressIsSaved` | Your progress is saved | تقدّمك محفوظ |
| `nav.account` | Account | الحساب |
| `nav.accountMenuLabel` | Account: {name} | الحساب: {name} |
| `nav.calendar` | Calendar | التقويم |
| `nav.calendarHint` | Everything Ailemy has scheduled | كل المواعيد المجدولة لدى Ailemy |
| `nav.createAnAccount` | Create an account | إنشاء حساب |
| `nav.intensiveCourses` | Intensive courses | دورات مكثفة |
| `nav.myAccount` | My Account | حسابي |
| `nav.myProfile` | My profile | ملفي الشخصي |
| `nav.myProfileHint` | Courses, calendar, credits and lessons | الدورات والتقويم والرصيد والدروس |
| `nav.myTuition` | My tuition | دروسي |
| `nav.oneToOneTuition` | 1-to-1 Tuition | دروس فردية |
| `nav.overview` | Overview | نظرة عامة |
| `nav.privacyPolicy` | Privacy Policy | سياسة الخصوصية |
| `nav.signOut` | Sign out | تسجيل الخروج |
| `nav.termsOfService` | Terms of Service | شروط الخدمة |
| `nav.timetableAndCalendar` | Timetable & Calendar | الجدول والتقويم |
| `quickSignup.benefitAnswersMarked` | Get answers marked | احصل على تصحيح إجاباتك |
| `quickSignup.benefitJoinLiveTuition` | Join live tuition | انضم إلى الدروس المباشرة |
| `quickSignup.benefitPastPapers` | Practise past papers | تدرّب على الامتحانات السابقة |
| `quickSignup.benefitSaveProgress` | Save your progress | احفظ تقدّمك |
| `quickSignup.benefitTrackRevision` | Track your revision | تابع مراجعتك |
| `quickSignup.benefitWeakTopics` | See weak topics | اعرف نقاط ضعفك |
| `quickSignup.boardNotSure` | Not sure | لست متأكدًا |
| `quickSignup.boardOther` | Other | أخرى |
| `quickSignup.choosePlaceholder` | Choose… | اختر… |
| `quickSignup.continueFree` | Continue free → | تابع مجانًا ← |
| `quickSignup.country` | Country | الدولة |
| `quickSignup.email` | Email | البريد الإلكتروني |
| `quickSignup.errorEmailLooksWrong` | That email address does not look right. | يبدو أن البريد الإلكتروني غير صحيح. |
| `quickSignup.errorFirstNameRequired` | Please tell us your first name. | من فضلك اكتب اسمك الأول. |
| `quickSignup.examBoard` | Exam board | هيئة الامتحان |
| `quickSignup.firstName` | First name | الاسم الأول |
| `quickSignup.freeAccountNoCard` | Free account · no card required | حساب مجاني · لا حاجة إلى بطاقة |
| `quickSignup.lastName` | Last name | اسم العائلة |
| `quickSignup.notNow` | Not now | ليس الآن |
| `quickSignup.optional` | (optional) | (اختياري) |
| `quickSignup.subjectsInterestedIn` | Subjects you are interested in | المواد التي تهمك |
| `quickSignup.title` | Create your free Ailemy account | أنشئ حسابك المجاني في Ailemy |
| `quickSignup.yearGcseY10` | Year 10 (GCSE / IGCSE) | السنة 10 (GCSE / IGCSE) |
| `quickSignup.yearGcseY11` | Year 11 (GCSE / IGCSE) | السنة 11 (GCSE / IGCSE) |
| `quickSignup.yearGroupOrQualification` | Year group or qualification | السنة الدراسية أو المؤهل |
| `quickSignup.yearIalA2` | IAL A2 / Year 13 | IAL A2 / السنة 13 |
| `quickSignup.yearIalAs` | IAL AS / Year 12 | IAL AS / السنة 12 |
| `quickSignup.yearOther` | Something else | غير ذلك |
| `tryAilemy.answerPlaceholder` | Write your answer as you would in the exam… | اكتب إجابتك كما تكتبها في الامتحان… |
| `tryAilemy.answerTooShort` | Write a little more and press mark — there is not enough here to award a point yet. | اكتب المزيد ثم اضغط زر التصحيح — ما كتبته حتى الآن لا يكفي لمنح أي نقطة. |
| `tryAilemy.createFreeAccount` | Create a free account to save your work | أنشئ حسابًا مجانيًا لحفظ عملك |
| `tryAilemy.howAilemyMarks` | How Ailemy marks | كيف تصحّح Ailemy |
| `tryAilemy.howAilemyMarksBody` | Ailemy marks against the points a real mark scheme awards — not a percentage guess. Write an ans | تصحّح Ailemy وفق النقاط التي يمنحها نموذج التصحيح الفعلي — لا وفق تخمين نسبة مئوية. اكتب إجابة و |
| `tryAilemy.markMyAnswer` | Mark my answer | صحّح إجابتي |
| `tryAilemy.matchedEvidence` | matched “{evidence}” | تطابق مع “{evidence}” |
| `tryAilemy.sampleMarkingDisclaimer` | Sample marking — a fixed mark scheme, shown to demonstrate how Ailemy marks. Marking inside your | تصحيح تجريبي — نموذج تصحيح ثابت، معروض لتوضيح كيف تصحّح Ailemy. أما التصحيح داخل حسابك فيجري وفق |
| `tryAilemy.srAwarded` | Awarded:  | مُنحت النقطة:  |
| `tryAilemy.srNotAwarded` | Not awarded:  | لم تُمنح النقطة:  |
| `tryAilemy.yourAnswerLabel` | Your answer | إجابتك |
| `tuition.aMonth` | a month | شهريًا |
| `tuition.approxSaving` | ~{pct}% saving | توفير نحو {pct}% |
| `tuition.askAboutAvailability` | Ask about availability → | اسأل عن المواعيد المتاحة ← |
| `tuition.askAboutOneToOneTimes` | Ask about 1-to-1 times | استفسر عن مواعيد الدروس الفردية |
| `tuition.availabilityRecheckedOnBooking` | Availability is re-checked the moment you book, so a time can be taken while this list is open. | يُعاد التحقق من المواعيد المتاحة لحظة الحجز، لذا قد يُحجز موعد بينما هذه القائمة مفتوحة أمامك. |
| `tuition.bestValue` | Best value | أفضل قيمة |
| `tuition.bySubjectHeading` | Tuition by subject | الدروس حسب المادة |
| `tuition.calendarBlurbGroup` | Every scheduled session across the live cohorts. Times in Doha, and in your own timezone where w | كل الحصص المجدولة في المجموعات المتاحة حالياً. التوقيت بتوقيت Doha، وبتوقيتك المحلي متى عرفناه. |
| `tuition.calendarBlurbOneToOne` | Published 1-to-1 availability. Times in Doha, and in your own timezone where we know it. | الأوقات المنشورة للدروس الفردية. التوقيت بتوقيت Doha، وبتوقيتك المحلي متى عرفناه. |
| `tuition.calendarEmptyGroup` | No timetable has been published for this period. The programmes above show what is opening; regi | لم يُنشر جدول لهذه الفترة بعد. البرامج أعلاه توضّح ما سيُفتح قريباً؛ سجّل اهتمامك وسنخبرك بالموا |
| `tuition.calendarEmptyOneToOne` | No 1-to-1 times are published for this period yet. Register for the next available slot and we w | لا توجد أوقات منشورة للدروس الفردية في هذه الفترة بعد. سجّل للحصول على أقرب موعد متاح وسنتواصل م |
| `tuition.chooseALessonTime` | Choose a lesson time | اختر موعد الدرس |
| `tuition.chooseKindOfTuition` | Choose a kind of tuition | اختر نوع الدروس |
| `tuition.chooseYourTime` | Choose your time | اختر وقتك |
| `tuition.cohortMeta` | {hours} live hrs/week · {sessions} sessions · cap {cap} | {hours} ساعة مباشرة أسبوعيًا · {sessions} حصص · بحد أقصى {cap} |
| `tuition.cohortsListed` | {count} cohort listed / {count} cohorts listed | {count, plural, one {مجموعة واحدة معروضة} two {مجموعتان معروضتان} few {{count} مجموعات معروضة} m |
| `tuition.courseRoadmap` | Course roadmap | خطة المقرر |
| `tuition.coversCalculations` | Calculations worked properly, not memorised | حل المسائل الحسابية بفهم، لا بالحفظ |
| `tuition.coversExamTechnique` | Exam-question technique and structure | أسلوب الإجابة على أسئلة الامتحان وطريقة ترتيبها |
| `tuition.coversLosingMarks` | The topics you are actually losing marks on | الموضوعات التي تفقد فيها الدرجات فعليًا |
| `tuition.coversMarkSchemeFeedback` | Mark-scheme-informed feedback on your writing | ملاحظات على إجاباتك المكتوبة وفق معايير التصحيح |
| `tuition.coversPastPapers` | Past papers, walked through together | الامتحانات السابقة، نحلّها معًا خطوة بخطوة |
| `tuition.coversSpecification` | Your exact specification, unit by unit | منهجك الدراسي بالتفصيل، وحدة تلو الأخرى |
| `tuition.creditBalanceNotice` | You have {count} lesson credits. Pick a time below and it is booked straight away — nothing to p | لديك رصيد {count} درس. اختر موعدًا من الأسفل وسيُحجز مباشرة — دون أي مبلغ يُدفع. |
| `tuition.creditsTimesMinutes` | {credits} × {minutes} minutes | {credits} × {minutes} دقيقة |
| `tuition.ctaCollapseAria` | Collapse the live tuition link | تصغير رابط الدروس المباشرة |
| `tuition.ctaCollapsedLabel` | Tuition | الدروس |
| `tuition.ctaInterestShort` | Interest | سجّل |
| `tuition.ctaLeadBiology` | Biology tuition is expanding | نوسّع دروس Biology |
| `tuition.ctaLeadChemistry` | Need help with Chemistry? | هل تحتاج مساعدة في Chemistry؟ |
| `tuition.ctaLeadNeutral` | Small-group science tuition | دروس علوم في مجموعات صغيرة |
| `tuition.ctaLeadPhysics` | Physics tuition is expanding | نوسّع دروس Physics |
| `tuition.ctaNoteCohortsOnDemand` | We open cohorts on demand | نفتح المجموعات حسب الطلب |
| `tuition.ctaNoteCohortsPricesTimetable` | Cohorts, prices and the timetable | المجموعات والأسعار والجدول |
| `tuition.ctaShortLeadBiology` | Biology tuition | دروس Biology |
| `tuition.ctaShortLeadChemistry` | Chemistry tuition | دروس Chemistry |
| `tuition.ctaShortLeadNeutral` | Live tuition | دروس مباشرة |
| `tuition.ctaShortLeadPhysics` | Physics tuition | دروس Physics |
| `tuition.ctaViewLiveTuition` | View live tuition | استعرض الدروس المباشرة |
| `tuition.ctaViewShort` | View | استعرض |
| `tuition.examBoardNotSure` | Not sure | لست متأكدًا |
| `tuition.examBoardOther` | Other | أخرى |
| `tuition.fieldCountry` | Country | الدولة |
| `tuition.fieldCurrentGrade` | Current grade | التقدير الحالي |
| `tuition.fieldEmail` | Email | البريد الإلكتروني |
| `tuition.fieldExamBoard` | Exam board | مجلس الامتحان |
| `tuition.fieldExamSession` | Exam session | دورة الامتحان |
| `tuition.fieldExamYear` | Exam year | سنة الامتحان |
| `tuition.fieldParentName` | Parent / guardian name | اسم ولي الأمر |
| `tuition.fieldPhone` | Phone (with country code) | رقم الهاتف (مع رمز الدولة) |
| `tuition.fieldPreferredDays` | Preferred days | الأيام المفضلة |
| `tuition.fieldPreferredTimes` | Preferred times | الأوقات المفضلة |
| `tuition.fieldQualification` | Qualification | المؤهل |
| `tuition.fieldStudentName` | Student name | اسم الطالب |
| `tuition.fieldStudentNotes` | Anything else we should know? | هل هناك شيء آخر تودّ إخبارنا به؟ |
| `tuition.fieldSubject` | Subject | المادة |
| `tuition.fieldTargetGrade` | Target grade | التقدير المستهدف |
| `tuition.fieldYearGroup` | Year group | الصف الدراسي |
| `tuition.fullCalendarLink` | Full calendar → | التقويم الكامل ← |
| `tuition.groupBlurb` | A whole programme to the specification, with the Ailemy platform, marked practice and progress t | برنامج كامل وفق المنهج المقرر، ويشمل منصة Ailemy والتدريبات المصححة ومتابعة التقدّم. |
| `tuition.groupHeading` | Structured weekly teaching, in a small group. | تدريس أسبوعي منظّم ضمن مجموعة صغيرة. |
| `tuition.heroHeading` | Learn live with an expert. | تعلّم مباشرة مع معلّم خبير. |
| `tuition.heroSubheading` | Choose personalised 1-to-1 tuition, or join a structured group lesson. | اختر دروسًا فردية مخصّصة، أو انضم إلى درس جماعي منظّم. |
| `tuition.intensiveBlurb` | Short, high-intensity courses run ahead of an exam series, separately from the termly cohorts ab | دورات قصيرة ومكثّفة تُقام قبل موسم الامتحانات، بشكل منفصل عن المجموعات الفصلية أعلاه. |
| `tuition.intensiveHeading` | Intensive programmes | البرامج المكثّفة |
| `tuition.interestConsent` | I agree that Ailemy may contact me about tuition using the details above. We store them only for | أوافق على أن تتواصل معي Ailemy بشأن الدروس باستخدام البيانات أعلاه. نحتفظ بها لهذا الغرض فقط، وي |
| `tuition.interestEmailLabelCohort` | Cohort: | المجموعة: |
| `tuition.interestEmailLabelCountryTimezone` | Country / timezone: | الدولة / المنطقة الزمنية: |
| `tuition.interestEmailLabelCurrentGrade` | Current grade: | الدرجة الحالية: |
| `tuition.interestEmailLabelParentName` | Parent/guardian name: | اسم ولي الأمر: |
| `tuition.interestEmailLabelPreferredTimes` | Preferred days / times: | الأيام / الأوقات المفضّلة: |
| `tuition.interestEmailLabelQualification` | Qualification (GCSE / International GCSE / IAL AS / IAL A2): | المؤهل (GCSE / International GCSE / IAL AS / IAL A2): |
| `tuition.interestEmailLabelReadyToStart` | Ready to start soon (yes/no): | الاستعداد للبدء قريبًا (نعم/لا): |
| `tuition.interestEmailLabelStudentName` | Student name: | اسم الطالب: |
| `tuition.interestEmailLabelSubject` | Subject: | المادة: |
| `tuition.interestEmailLabelTargetGrade` | Target grade: | الدرجة المستهدفة: |
| `tuition.interestEmailOneToOneEnquiry` | Enquiry: one-to-one availability | الاستفسار: توفّر الدروس الفردية |
| `tuition.interestEmailSubject` | Register interest{forSubject} | تسجيل الاهتمام{forSubject} |
| `tuition.interestGroupWhatYouNeed` | What you need | ما الذي تحتاجه |
| `tuition.interestGroupWhereAndWhen` | Where you are, and when you can study | أين أنت، ومتى يمكنك الدراسة |
| `tuition.interestGroupWhoYouAre` | Who you are | بياناتك |
| `tuition.interestIntro` | We open new cohorts based on genuine demand. Tell us what you need and we will contact you when  | نفتتح مجموعات جديدة بناءً على الطلب الحقيقي. أخبرنا بما تحتاجه وسنتواصل معك عند افتتاح مجموعة{fo |
| `tuition.interestIntroForSubject` |  for {subject} |  لمادة {subject} |
| `tuition.interestOpenPrefilledMessage` | Open a pre-filled message instead | افتح رسالة جاهزة بدلًا من ذلك |
| `tuition.interestPageDescription` | Tell us which science and qualification you need, and we will contact you when a cohort opens. | أخبرنا بالمادة العلمية والمؤهل الذي تحتاجه، وسنتواصل معك عند افتتاح مجموعة جديدة. |
| `tuition.interestPageTitle` | Register interest — Ailemy | تسجيل الاهتمام — Ailemy |
| `tuition.interestPreferEmail` | Prefer email? | تفضّل البريد الإلكتروني؟ |
| `tuition.interestReadyToStart` | We are ready to start as soon as a cohort opens. | نحن مستعدون للبدء فور افتتاح مجموعة جديدة. |
| `tuition.interestSending` | Sending… | جارٍ الإرسال… |
| `tuition.interestThankYouBody` | We will contact you by email when a cohort opens for your subject and qualification. Nothing is  | سنتواصل معك عبر البريد الإلكتروني عند افتتاح مجموعة لمادتك ومؤهلك. لا توجد أي رسوم ولا أي التزام |
| `tuition.interestThankYouHeading` | Thank you — we have your details. | شكرًا لك — وصلتنا بياناتك. |
| `tuition.kindOfTuition` | Kind of tuition | نوع الدروس |
| `tuition.lessonsAndBundles` | Lessons and bundles | الدروس والباقات |
| `tuition.lessonsWritten` | The course itself is mapped — {count} lessons are written for it. | المقرر نفسه مُخطَّط بالكامل — وقد كُتب له {count} درسًا. |
| `tuition.lookingForSomethingElse` | Looking for something else? | تبحث عن شيء آخر؟ |
| `tuition.metaDescription` | Small-group science tuition built around the exact specification and exam requirements. Edexcel  | دروس علوم في مجموعات صغيرة، مبنية على المنهج المقرر ومتطلبات الامتحان بالضبط. Edexcel IAL Chemis |
| `tuition.metaNotFound` | Not found · Ailemy | غير موجود · Ailemy |
| `tuition.metaTitle` | Live tuition — Ailemy | دروس مباشرة — Ailemy |
| `tuition.nextAvailable` | Next available | أقرب موعد متاح |
| `tuition.nextGroupLesson` | Next group lesson | الدرس الجماعي القادم |
| `tuition.noCohortListed` | no cohort listed | لا توجد مجموعات معروضة |
| `tuition.noGroupLessonsScheduled` | No group lessons are scheduled in this period. | لا توجد دروس جماعية مجدولة في هذه الفترة. |
| `tuition.noOneToOneTimesPublished` | No 1-to-1 times have been published yet. | لم تُنشر مواعيد الدروس الفردية بعد. |
| `tuition.onboardingFirstClass` | Onboarding {onboarding} · first class {firstClass} | التهيئة {onboarding} · أول حصة {firstClass} |
| `tuition.oneToOneAvailability` | 1-to-1 availability | مواعيد الدروس الفردية |
| `tuition.oneToOneBlurb` | One-to-one Chemistry is available in limited monthly blocks. Availability is deliberately small  | دروس Chemistry الفردية متاحة ضمن باقات شهرية محدودة. نُبقي الأماكن قليلة عن قصد ليبقى التركيز عل |
| `tuition.oneToOneBookingOpensSoon` | 1-to-1 booking opens soon | يُفتح حجز الدروس الفردية قريبًا |
| `tuition.oneToOneEyebrow` | 1-to-1 tuition | دروس فردية |
| `tuition.oneToOneGroupFirstLead` | Most students are best served by a group cohort — it is the scalable core of what Ailemy does, a | معظم الطلاب يستفيدون أكثر من المجموعات الدراسية — فهي أساس ما تقدمه Ailemy، وتكلفتها أقل بكثير ف |
| `tuition.oneToOneGroupFirstTrail` | . 1-to-1 is for targeted work on top of that. | . الدروس الفردية مخصّصة للعمل المركّز إلى جانب ذلك. |
| `tuition.oneToOneHeading` | 1-to-1 Chemistry tuition | دروس الكيمياء الفردية |
| `tuition.oneToOneIntro` | Personalised support built around one student: their specification, their weakest topics, the qu | دعم فردي مبني حول طالب واحد: منهجه الدراسي، وأصعب الموضوعات عليه، والأسئلة التي يفقد فيها الدرجا |
| `tuition.oneToOneMetaDescription` | Personalised Chemistry support built around your specification, your weak areas and the exam you | دعم فردي في الكيمياء مبني على منهجك الدراسي، ونقاط ضعفك، والامتحان الذي ستؤديه. |
| `tuition.oneToOneMetaTitle` | 1-to-1 Chemistry tuition — Ailemy | دروس الكيمياء الفردية — Ailemy |
| `tuition.openTheTimetable` | Open the timetable | افتح الجدول الدراسي |
| `tuition.pageHeading` | Learn live with Ailemy | تعلّم مباشرة مع Ailemy |
| `tuition.pageIntro` | Small-group science tuition built around the exact specification and exam requirements — with th | دروس علوم في مجموعات صغيرة، مبنية على المنهج المقرر ومتطلبات الامتحان بالضبط — مع منصة Ailemy، و |
| `tuition.paymentNotSwitchedOn` | Online payment is not switched on yet. | الدفع الإلكتروني غير مُفعّل بعد. |
| `tuition.paymentOffNoCredits` | Online payment is not switched on yet, and you have no lesson credits to spend. | الدفع الإلكتروني غير مُفعّل بعد، ولا يوجد لديك رصيد دروس لاستخدامه. |
| `tuition.placeholderExamSession` | e.g. June 2027 | مثال: يونيو 2027 |
| `tuition.placeholderExamYear` | e.g. 2027 | مثال: 2027 |
| `tuition.placeholderStudentNotes` | Topics you find hardest, timing constraints, anything at all. | المواضيع الأصعب عليك، أي قيود في المواعيد، أي شيء على الإطلاق. |
| `tuition.pleaseChoose` | Please choose… | الرجاء الاختيار… |
| `tuition.qualificationNotSureYet` | Not sure yet | لست متأكدًا بعد |
| `tuition.registerInterestInOneToOne` | Register interest in 1-to-1 → | سجّل اهتمامك بالدروس الفردية ← |
| `tuition.registerInterestWeWillContact` | Register your interest and we will contact you with times directly — you will be first to know w | سجّل اهتمامك وسنتواصل معك بالمواعيد مباشرة — وستكون أول من يعلم عند فتح الحجز الذاتي. |
| `tuition.roadmapIntro` | What is taught, in the order it is taught, on the dates it runs. | ما يُدرَّس، بالترتيب الذي يُدرَّس به، وفي التواريخ التي يُقام فيها. |
| `tuition.roadmapLoadFailed` | The roadmap could not be loaded — {error} | تعذّر تحميل خطة المقرر — {error} |
| `tuition.roadmapMetaDescription` | The teaching plan for {title}: weekly topics, the order they are taught in, and the schedule the | خطة التدريس لمقرر {title}: المواضيع الأسبوعية، وترتيب تدريسها، والجدول الذي تسير عليه. دروس جماع |
| `tuition.roadmapMetaTitle` | {title} — course roadmap · Ailemy | {title} — خطة المقرر · Ailemy |
| `tuition.seeCurrentIntensive` | See the current intensive → | اطّلع على الدورة المكثّفة الحالية ← |
| `tuition.seeGroupTimetable` | See group timetable | اطّلع على جدول الدروس الجماعية |
| `tuition.seeLiveGroupTuition` | See live group tuition | اطّلع على الدروس الجماعية المباشرة |
| `tuition.seeUpcomingLessons` | See upcoming lessons | شاهد الحصص القادمة |
| `tuition.seeWhatCourseCovers` | See what the course covers | اطّلع على ما يغطيه المقرر |
| `tuition.slotDayAtTime` | {day} at {time} | {day} الساعة {time} |
| `tuition.smallGroup` | Small group | مجموعة صغيرة |
| `tuition.teachingBeginsInDays` | Teaching begins in {days} days. | يبدأ التدريس بعد {days} يومًا. |
| `tuition.timesInZone` | Times in {zone} | المواعيد بتوقيت {zone} |
| `tuition.validForMonths` |  · valid {months} months |  · صالحة لمدة {months} شهرًا |
| `tuition.waitlistAdding` | Adding… | جارٍ الإضافة… |
| `tuition.waitlistConfirmation` | You’re on the list. We’ll email you if a place opens — this does not reserve a place. | أنت الآن على قائمة الانتظار. سنرسل لك بريدًا إلكترونيًا إذا توفر مقعد — هذا لا يحجز لك مقعدًا. |
| `tuition.waitlistEmailPlaceholder` | you@example.com | you@example.com |
| `tuition.waitlistJoin` | Join → | انضم ← |
| `tuition.waitlistLabel` | Join the waiting list | انضم إلى قائمة الانتظار |
| `tuition.waitlistPrivacyNote` | We’ll only use this to tell you about a place on this course. | لن نستخدم بريدك إلا لإبلاغك بتوفر مقعد في هذه الدورة. |
| `tuition.weeklyPlanNotPublished` | The weekly plan is not published yet. | لم تُنشر الخطة الأسبوعية بعد. |
| `tuition.weeklyTeachingPlan` | Weekly teaching plan | خطة التدريس الأسبوعية |
| `tuition.whatASessionCovers` | What a session covers | ماذا تشمل الحصة |
| `tuition.withYourOwnBesideThem` | , with your own beside them | ، مع توقيتك المحلي بجانبها |
| `tuition.yearGroup10` | Year 10 | السنة 10 |
| `tuition.yearGroup11` | Year 11 | السنة 11 |
| `tuition.yearGroup12As` | Year 12 / AS | السنة 12 / AS |
| `tuition.yearGroup13A2` | Year 13 / A2 | السنة 13 / A2 |
| `tuition.yearGroupOther` | Other | غير ذلك |
| `tuitionModes.groupSub` | Structured weekly teaching, with the platform included. | تدريس أسبوعي منظّم، والمنصة مشمولة. |
| `tuitionModes.modeGroup` | Group Tuition | دروس جماعية |
| `tuitionModes.modeOneToOne` | 1-to-1 Tuition | دروس فردية |
| `tuitionModes.oneToOneBlurb` | Teaching built around one student’s specification, their gaps and the exam they are sitting — wi | تدريس مبني على المنهج المقرر للطالب، ونقاط ضعفه، والامتحان الذي سيؤديه — مع المصادر والتصحيح وال |
| `tuitionModes.oneToOneHeading` | Personal lessons, on your course. | دروس خاصة وفق مقرر الطالب. |
| `tuitionModes.oneToOneSub` | Personal lessons, booked around published times. | دروس خاصة تُحجز ضمن المواعيد المعلنة. |

### Phase 1b — why seventeen files still hold English literals

The link half of phase 1b is done and proved: internal links now follow the
locale, decided per href at runtime by `SmartLink`, with rendered-HTML guards in
both directions and a sabotage proof. That was the defect the handover flagged.

The string half is **catalogue-complete and code-incomplete**, deliberately.

All 394 user-facing literals across the eighteen in-scope files were extracted
and translated — that is the 348 new keys in the table above. Applying them to
the JSX was then attempted as a scripted pass over the 382 replacements that
occur exactly once in their file, which is the only form that is unambiguous.
**It produced eleven TypeScript syntax errors across five files** — unbalanced
JSX, `</` expected, elements with no closing tag — because a string that is
unique in a file is still not necessarily a standalone text node. It was
reverted in full.

Two structural facts make this work per-file rather than mechanical:

- **Module-scope constants cannot call a hook.** `ExplorePanel`'s
  `const DEFAULT_BLURB = "Choose a feature…"` sits at import time, where there is
  no request and no locale. Localising it means moving the declaration inside the
  component — a real edit, made correctly in that one file as the template.
  `SiteFooter` (18 of 19 strings), `InterestForm` (22 of 39) and `TuitionModes`
  are the same shape: their strings live in module-level data structures.
- **`metadata` exports cannot be translated as they stand.** `export const
  metadata` is static; localising a page title means converting it to
  `export async function generateMetadata()` and threading the locale in. The
  `[...slug]` route additionally types its params without `locale`, so the type
  has to widen before the call compiles.

`ExplorePanel.tsx` is converted end to end — including moving the module-scope
constant — and stands as the worked pattern for the rest.

⚠ **One thing the founder should know that is not an i18n problem.** The
admin-authored pages under `/[locale]/(site)/[...slug]` render `title` and
`body_md` straight from the `pages` table, which has one row per slug and no
locale dimension. An Arabic visitor gets fully Arabic chrome wrapped around an
English body, and no amount of catalogue work changes that. Fixing it is a
schema question — per-locale rows, or a `locale` column with a compound unique
key on `(slug, locale)` — and therefore a migration, which is out of scope here
and needs a number from planning.

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
