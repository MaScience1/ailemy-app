# Enrolling a student who has paid

**Read this when a payment lands and someone needs access.** It is written to be
followed at 11pm by a tired person. Every step says what to expect, and what it
means when you do not get it.

There is **no admin page for this**. All nineteen `/admin` routes were checked;
none of them touch `cohort_enrolments`. The Supabase SQL Editor is the only path.

The paste is **[ENROLMENT_PASTE.sql](ENROLMENT_PASTE.sql)**. Do not retype it.

---

## The two things that will trip you up

Read these before anything else. Both are silent — you get no error, the family
just does not get what they paid for.

### 1. `status` must be `'active'`, not the default

The column defaults to `'paid'`. Access works either way — `is_enrolled()`
accepts `'paid'`, `'active'` and `'completed'`
([0009:86](supabase/migrations/0009_cohort_intensive.sql:86)). But the **public
seat counter counts only `'active'`**, and only with a payment recorded:

```sql
AND e.status = 'active' AND e.amount_pence > 0 AND e.stripe_ref IS NOT NULL
```
[0063:83-88](supabase/migrations/0063_cohort_capacity.sql:83)

So if you take the default, the student gets in and the site still says
**"0 of 20 places taken"** on the tuition page, the homepage hero, the calendar
and the day panel. Use `'active'` and fill in the payment fields.

**`'active'` is the only status that satisfies all three checks.** They disagree:

| Check | Accepts |
|---|---|
| `is_enrolled()` — DB gate ([0009:86](supabase/migrations/0009_cohort_intensive.sql:86)) | `paid`, `active`, `completed` |
| `/profile` — group sessions ([student.ts:75](src/lib/booking/student.ts:75)) | `paid`, `active` |
| `/intensive` ([enrolment.ts:31](src/lib/intensive/enrolment.ts:31)) | `paid`, `active`, `completed` |
| **public seat counter** ([0063:85](supabase/migrations/0063_cohort_capacity.sql:85)) | **`active` only** |

`'active'` is in every row. Nothing else is. (And note `'completed'` passes the
CHECK constraint and the DB gate but drops the family off `/profile` — do not
use it to mark a finished course while they still need the calendar.)

### 2. `user_id` must be set for a **group tuition** student

There is a helper, `claim_enrolment()`, that links an email-only row to a real
account on first login ([0009:72](supabase/migrations/0009_cohort_intensive.sql:72)).
It is idempotent and matches email case-insensitively. It sounds like you can
enrol someone before they have an account.

**You cannot, for group tuition.** `claim_enrolment()` is called from exactly one
place in the whole app — [enrolment.ts:46](src/lib/intensive/enrolment.ts:46),
the `/intensive` exam-intensive area. The group-tuition surface reads
`.eq("user_id", user.id)` and never calls it
([booking/student.ts:72](src/lib/booking/student.ts:72)).

So an email-only row for a group family **never links itself**. The student
signs up, sees nothing, and nothing you can see is wrong.

**Therefore: the student signs up first, then you enrol them.** The paste fails
closed if the account does not exist — it will tell you rather than insert a row
that grants nothing.

---

## The steps

### 1 · A parent pays. What you see, and where.

Payment happens on a **Stripe Payment Link** held in `cohorts.enrolment_url`,
outside the app. Confirmed from source: the webhook receives the event, finds
none of the app's own metadata, and returns
`{status:"ignored"}` without writing anything
([webhook-grant.ts:51-57](src/lib/tuition/webhook-grant.ts:51)). The comment
there names Payment Links explicitly as "something this app did not sell".

**So Ailemy's database does not know a sale happened.** Nothing appears in any
admin page. Your only notification is Stripe itself — dashboard, email, or the
Stripe app.

> ⚠ **Not verified from source, check your own dashboard:** exactly which fields
> your Payment Link collects. The runbook assumes you can read the payer's name,
> the amount, and a payment/session reference. If your link does not collect the
> **student's** email, see step 2 — the payer is usually the parent.

From Stripe you need three things:

| What | Used for | Notes |
|---|---|---|
| **Student email** | finding the account | *not* necessarily the payer's email |
| **Amount paid, minor units** | `amount_pence` | see the open question below |
| **Payment reference** | `stripe_ref` | the audit link back to Stripe |

### 2 · The student needs an Ailemy account

Accounts are `auth.users` rows, created by normal signup at `/signup`. The
identifier is **email**, matched case-insensitively everywhere that matters
(`claim_enrolment` lowercases both sides; there is a
`lower(email)` index at [0009:69](supabase/migrations/0009_cohort_intensive.sql:69)).

**There is no link between the Stripe payer and the student account.** The
parent pays with their own email and phone; the student signs up with theirs.
Matching is entirely manual, on whatever you can tell from the name. This is the
weakest joint in the whole process.

**If the parent paid but the student has not signed up yet:** send them to
`/signup` first. Do not insert an email-only row hoping it will link later — for
group tuition it will not (see trap 2).

### 3 · What must exist in `cohort_enrolments`

Full shape, from [0009:53-67](supabase/migrations/0009_cohort_intensive.sql:53).
**No later migration alters this table** — every one of the other fourteen files
that mentions it only reads, deletes or comments.

| Column | Null? | Default | You set it? |
|---|---|---|---|
| `id` | NOT NULL | `gen_random_uuid()` | no |
| `cohort_id` | **NOT NULL** | — | **yes** — from the slug |
| `user_id` | nullable | — | **yes** — see trap 2 |
| `email` | **NOT NULL** | — | **yes** |
| `status` | NOT NULL | `'paid'` | **yes — `'active'`**, see trap 1 |
| `amount_pence` | nullable | — | **yes**, see trap 1 |
| `stripe_ref` | nullable | — | **yes**, see trap 1 |
| `parent_name` | nullable | — | optional |
| `parent_contact` | nullable | — | optional (WhatsApp) |
| `source_tag` | nullable | — | optional |
| `enrolled_at` | NOT NULL | `now()` | no |

`UNIQUE (cohort_id, email)` — re-running the paste for the same person is caught
by the constraint rather than silently duplicating.

**The trap this table sets:** `email` is NOT NULL but `is_enrolled()` matches on
`user_id`. A perfectly valid row with `user_id NULL` inserts cleanly and grants
nothing. That is why the paste fails closed.

The three cohort slugs:

| Cohort | Slug |
|---|---|
| Edexcel IAL Chemistry AS | `ial-chemistry-as-sep-2026` |
| Year 11 GCSE / IGCSE Chemistry | `igcse-chemistry-y11` |
| Year 10 GCSE / IGCSE Chemistry | `igcse-chemistry-y10` |

### 4 · What the student sees BEFORE the row exists

On `/profile` (which is where `/my-tuition` redirects): the group-sessions list
is simply empty. There is no explanatory screen — `loadMyTuition` reads their
enrolments, gets none, and renders nothing for group tuition.

The explicit "not on the roll" screen exists only in the `/intensive` area
([PendingAccess.tsx](src/app/intensive/_components/PendingAccess.tsx)), and reads:

> **Access opens once your enrolment is confirmed.**
> You're signed in as *(their email)*, but this email isn't on the cohort roll
> yet. Once your place is confirmed, you'll be able to open week 1 here.
> If you've already paid and think this is a mistake, send us the email address
> you paid with and we'll sort it out.

with an **Email about my enrolment** button to `mascience15@gmail.com`.

> ⚠ That copy says *"this email isn't on the roll"*, but the gate actually
> matches on `user_id`. A student whose row exists with a NULL `user_id` reads a
> message telling them their email is the problem when it is not.

If they are not signed in at all, they get the sign-in screen instead.

### The join link — deferred, by decision

**There is no join/meeting URL column anywhere in the schema**, and none is
being built. `tuition_sessions`, `cohort_schedules` and `cohorts` all lack one,
and the day panel shows an enrolled student the words "You're enrolled" and no
control.

**The link travels by WhatsApp.** That is a decision, not a gap. The obvious
in-app alternative — publishing it as an announcement — was considered and
rejected: `announcements` has no cohort or audience column
([0022](supabase/migrations/0022_announcements.sql)), so a join link posted
there is visible to every signed-in user, and it would leak across cohorts the
moment a second one runs.

Revisit only if announcements gain an audience column.

### 5 · What the student sees AFTER

Immediately on their next page load. **No re-login, no cache clear** — every
check is a live server-side query per request. Tell the family "refresh the
page", not "sign out and back in".

- **`/profile`** — their group sessions appear on the calendar. This is the one
  that matters for group tuition.
- **`/intensive/dashboard`** — unlocks if they are on an intensive cohort.
- At the database level `is_enrolled()` opens `cohort_weeks` SELECT
  ([0009:193](supabase/migrations/0009_cohort_intensive.sql:193)) and
  `submissions` INSERT ([0009:205](supabase/migrations/0009_cohort_intensive.sql:205)).
- The **public seat counter** increments — but only if you followed trap 1.

---

---

## ⚠ Never set a live cohort `is_public = false`

**It blanks the calendar for every student already enrolled on it.**

An enrolled student's own sessions are not resolved from their enrolment. They
are resolved through the *public* cohort list, which filters
`.eq("is_public", true)` ([readers.ts:96](src/lib/public/readers.ts:96)). Turn
the flag off and `loadMyTuition` finds no cohort for them, so `/profile` shows
an empty calendar and "Next lesson —", while their `cohort_enrolments` row sits
there perfectly valid.

**This becomes tempting at exactly the wrong moment.** The obvious reason to
un-publish a cohort is that all 20 seats are gone and you no longer want it
advertised. That is precisely when twenty families are relying on it to tell
them when their next lesson is.

If you need to stop advertising a full cohort, change what the *catalogue* shows
— not `is_public`. Leave the flag alone until the cohort has actually finished.

---

## Other ways this goes wrong

**There are TWO AS slugs, five characters apart.** `ial-chemistry-as-sep-2026`
is the public group cohort — the one your families are paying for.
`ial-chem-as-sep-2026` is the old 12-week exam intensive from
[0009:254](supabase/migrations/0009_cohort_intensive.sql:254), with
`is_public = false`; [0054:101](supabase/migrations/0054_cohort_year_group.sql:101)
records both side by side. Enrol someone onto the wrong one and they get access
to a different product and never appear in the seat count. **Always paste the
slug, never type it.**

**Two enrolment rows for one student breaks `/intensive` entirely.** The read at
[enrolment.ts:53](src/lib/intensive/enrolment.ts:53) uses `.maybeSingle()` with
**no cohort filter**, so a second row makes it error, and
[enrolment.ts:55](src/lib/intensive/enrolment.ts:55) turns any error into
`pending`. A student on two cohorts looks unenrolled. The unique constraint is
on `(cohort_id, email)` and is **case-sensitive**, so `Bob@x.com` and
`bob@x.com` both insert — which is exactly how you would manufacture this. The
paste lowercases the email to make it impossible.

**If the parent signs in first, the binding is permanent.** `claim_enrolment()`
only touches rows where `user_id IS NULL`
([0009:76](supabase/migrations/0009_cohort_intensive.sql:76)). Once the wrong
account claims the seat, re-running it changes nothing — it needs a manual
`UPDATE`, which is deliberately not in the paste.

**A typo'd magic-link address silently creates a new empty account.**
`/intensive/sign-in` uses `signInWithOtp`, whose `shouldCreateUser` defaults to
true ([sign-in-form.tsx:31](src/app/intensive/sign-in/sign-in-form.tsx:31)). No
error. You then have two accounts and one seat.

**`public.profiles` has no email column.** Searching profiles by email returns
nothing, and that is *not* evidence the account is missing. Look in `auth.users`
— Dashboard → Authentication → Users, or the SQL Editor.

**`PendingAccess` promises something that does not exist.** It says "you'll be
able to open week 1 here", but there is no week page: `cohort_weeks` and
`submissions` have **zero references anywhere in `src/`**. The `is_enrolled()`
grants on those tables are real at the database level with nothing built on top.
For group tuition that does not matter — `/profile` is the surface — but do not
promise a family week-1 material on the strength of that screen.

---

## Open question for planning — needs your ruling

**What unit goes in `amount_pence` for a QAR payment?** The column is named for
GBP pence and the existing probe scripts use `16900` (£169.00). Your families pay
in QAR. Nothing in the code converts, and this repo forbids FX arithmetic in
application code.

Only `> 0` is ever tested, so either choice works mechanically — but the column
is your payment record, and the erasure tests deliberately preserve it so that
"a payment stays provable". Pick one and stay consistent:

- **(a)** QAR minor units — `850 QAR` → `85000`. Matches what Stripe charged.
- **(b)** GBP pence at the rate on the day — matches the column name, needs a
  rate you would have to record somewhere.

I have not chosen. The paste takes the amount as an input either way.
