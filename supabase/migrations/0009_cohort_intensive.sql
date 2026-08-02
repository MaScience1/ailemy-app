-- ============================================================================
-- 0009_cohort_intensive.sql
-- Ailemy — £249 twelve-week IAL Chemistry AS Exam Intensive (cohort 1)
--
-- Scope: enrol → view week → submit work → receive human feedback → evidence.
-- NOT in scope: AI marking, parent accounts, gamification, in-app checkout.
--
-- STAFF IDENTIFICATION: reuses the app's existing admin mechanism.
--   The app has no profiles.role and no DB admin flag. It identifies the single
--   admin by EMAIL: src/lib/admin/auth.ts compares the session email to the
--   ADMIN_EMAIL env var (server-only). Postgres RLS cannot read a Node env var,
--   so section 1 reuses the SAME signal — the admin's email — sourced from a DB
--   setting rather than adding a divergent profiles.role column.
-- Run against a branch/local first: supabase db reset && supabase db push
-- ============================================================================

-- 1. STAFF ------------------------------------------------------------------
-- No profiles.role column is added: it would become a second, drifting source
-- of truth for "who is admin". Instead is_staff() checks the caller's email
-- against the single admin address, which MUST equal the app's ADMIN_EMAIL
-- (src/lib/admin/auth.ts). Keep the two in sync if the admin email ever changes.
--
-- Hardcoded and lowercased. A caller with no session has auth.uid() = NULL,
-- so the row lookup returns nothing — is_staff() FAILS CLOSED.
create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and lower(u.email) = 'mascience15@gmail.com'
  );
$$;

-- 2. COHORTS ----------------------------------------------------------------
create table if not exists public.cohorts (
  id               uuid primary key default gen_random_uuid(),
  slug             text unique not null,           -- 'ial-chem-as-sep-2026'
  title            text not null,
  price_pence      integer not null,               -- 24900
  currency         text not null default 'GBP',
  starts_on        date not null,
  ends_on          date not null,
  seat_cap         smallint not null default 20,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

-- 3. ENROLMENTS -------------------------------------------------------------
-- Cohort 1 flow: payment lands in Stripe → you insert the row → student signs
-- in with that email. Manual by design; automate only if cohort 2 happens.
create table if not exists public.cohort_enrolments (
  id               uuid primary key default gen_random_uuid(),
  cohort_id        uuid not null references public.cohorts(id) on delete cascade,
  user_id          uuid references auth.users(id) on delete set null,
  email            text not null,
  status           text not null default 'paid'
                   check (status in ('paid','active','refunded','completed')),
  amount_pence     integer,
  stripe_ref       text,                           -- payment link session id
  parent_name      text,
  parent_contact   text,                           -- WhatsApp for the fortnightly note
  source_tag       text,                           -- 'doha-school','referral',...
  enrolled_at      timestamptz not null default now(),
  unique (cohort_id, email)
);
create index if not exists idx_enrol_user on public.cohort_enrolments(user_id);
create index if not exists idx_enrol_email on public.cohort_enrolments(lower(email));

-- Links a signed-in user to a paid row on first login (email must match).
create or replace function public.claim_enrolment()
returns void language sql security definer set search_path = public as $$
  update public.cohort_enrolments
     set user_id = auth.uid()
   where user_id is null
     and lower(email) = lower((select email from auth.users where id = auth.uid()));
$$;

create or replace function public.is_enrolled(p_cohort uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.cohort_enrolments e
    where e.cohort_id = p_cohort
      and e.user_id = auth.uid()
      and e.status in ('paid','active','completed')
  );
$$;

-- 4. WEEKS ------------------------------------------------------------------
create table if not exists public.cohort_weeks (
  id               uuid primary key default gen_random_uuid(),
  cohort_id        uuid not null references public.cohorts(id) on delete cascade,
  week_number      smallint not null,              -- 0 = baseline diagnostic
  title            text not null,
  spec_points      text[] not null default '{}',   -- {'1.3.2','1.3.3'}
  mux_playback_id  text,
  notes_path       text,                           -- storage: cohort-materials/
  worksheet_path   text,
  questions_path   text,
  marks_available  smallint,
  release_at       timestamptz not null,
  is_published     boolean not null default false,
  unique (cohort_id, week_number)
);

-- 5. SUBMISSIONS ------------------------------------------------------------
create table if not exists public.submissions (
  id               uuid primary key default gen_random_uuid(),
  cohort_week_id   uuid not null references public.cohort_weeks(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  kind             text not null default 'photo' check (kind in ('photo','pdf','typed')),
  storage_path     text,                           -- private bucket: submissions/
  body_text        text,
  status           text not null default 'submitted'
                   check (status in ('submitted','marking','marked')),
  submitted_at     timestamptz not null default now()
);
create index if not exists idx_sub_queue on public.submissions(status, submitted_at);
create index if not exists idx_sub_user on public.submissions(user_id, cohort_week_id);

-- 6. FEEDBACK ---------------------------------------------------------------
-- ai_* columns exist so AI marking can run in SHADOW MODE from day one:
-- write the AI mark, never show it, compare against marks_awarded. That is
-- the 200-response audit accumulating for free at zero student risk.
create table if not exists public.submission_feedback (
  id               uuid primary key default gen_random_uuid(),
  submission_id    uuid not null unique references public.submissions(id) on delete cascade,
  marker_id        uuid not null references auth.users(id),
  marks_awarded    smallint not null,
  marks_available  smallint not null,
  comment          text not null,                  -- mark-scheme language
  spec_gaps        text[] not null default '{}',   -- feeds the weakness plan
  marked_file_path text,
  ai_marks         smallint,                       -- shadow only
  ai_comment       text,                           -- shadow only
  ai_agrees        boolean generated always as (
                     ai_marks is not null and abs(ai_marks - marks_awarded) <= 1
                   ) stored,
  marked_at        timestamptz not null default now()
);

-- 7. EVIDENCE: taught vs not-yet-taught -------------------------------------
-- The control design. Without this table the "+10 points" claim cannot
-- survive scrutiny — exam-season students improve anyway.
create table if not exists public.topic_assessments (
  id               uuid primary key default gen_random_uuid(),
  cohort_id        uuid not null references public.cohorts(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  spec_topic       text not null,
  phase            text not null check (phase in ('baseline','midpoint','final')),
  score            smallint not null,
  max_score        smallint not null,
  taught_by_then   boolean not null,               -- THE control flag
  recorded_at      timestamptz not null default now(),
  unique (cohort_id, user_id, spec_topic, phase)
);

-- Read this at week 6 and week 12. Threshold: taught uplift beats untaught
-- uplift by >= 8 percentage points.
create or replace view public.v_uplift_by_exposure as
select
  ta.cohort_id,
  ta.taught_by_then,
  count(distinct ta.user_id)                                    as students,
  round(avg(100.0 * ta.score / nullif(ta.max_score,0))
        filter (where ta.phase = 'baseline'), 1)                as baseline_pct,
  round(avg(100.0 * ta.score / nullif(ta.max_score,0))
        filter (where ta.phase = 'final'), 1)                   as final_pct
from public.topic_assessments ta
group by ta.cohort_id, ta.taught_by_then;

-- 8. RLS --------------------------------------------------------------------
alter table public.cohorts            enable row level security;
alter table public.cohort_enrolments  enable row level security;
alter table public.cohort_weeks       enable row level security;
alter table public.submissions        enable row level security;
alter table public.submission_feedback enable row level security;
alter table public.topic_assessments  enable row level security;

create policy "cohorts readable" on public.cohorts
  for select using (is_active or public.is_staff());

create policy "own enrolment" on public.cohort_enrolments
  for select using (user_id = auth.uid() or public.is_staff());
create policy "staff write enrolment" on public.cohort_enrolments
  for all using (public.is_staff()) with check (public.is_staff());

-- Paid + published + released. Nothing leaks early, nothing leaks free.
create policy "published weeks to enrolled" on public.cohort_weeks
  for select using (
    public.is_staff()
    or (is_published and release_at <= now() and public.is_enrolled(cohort_id))
  );
create policy "staff write weeks" on public.cohort_weeks
  for all using (public.is_staff()) with check (public.is_staff());

create policy "own submissions" on public.submissions
  for select using (user_id = auth.uid() or public.is_staff());
create policy "insert own submission" on public.submissions
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.cohort_weeks w
      where w.id = cohort_week_id and public.is_enrolled(w.cohort_id)
    )
  );
create policy "staff update submissions" on public.submissions
  for update using (public.is_staff()) with check (public.is_staff());

create policy "own feedback" on public.submission_feedback
  for select using (
    public.is_staff()
    or exists (select 1 from public.submissions s
               where s.id = submission_id and s.user_id = auth.uid())
  );
create policy "staff write feedback" on public.submission_feedback
  for all using (public.is_staff()) with check (public.is_staff());

create policy "own assessments" on public.topic_assessments
  for select using (user_id = auth.uid() or public.is_staff());
create policy "staff write assessments" on public.topic_assessments
  for all using (public.is_staff()) with check (public.is_staff());

-- 9. STORAGE ----------------------------------------------------------------
-- Private buckets. `papers` stays public; these must not be.
insert into storage.buckets (id, name, public)
values ('submissions','submissions',false), ('cohort-materials','cohort-materials',false)
on conflict (id) do nothing;

create policy "student uploads own folder" on storage.objects
  for insert with check (
    bucket_id = 'submissions' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "student reads own folder" on storage.objects
  for select using (
    bucket_id = 'submissions'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff())
  );
create policy "enrolled read materials" on storage.objects
  for select using (
    bucket_id = 'cohort-materials'
    and (public.is_staff() or exists (
      select 1 from public.cohort_enrolments e
      where e.user_id = auth.uid() and e.status in ('paid','active','completed')
    ))
  );
create policy "staff writes materials" on storage.objects
  for all using (bucket_id = 'cohort-materials' and public.is_staff())
  with check (bucket_id = 'cohort-materials' and public.is_staff());

-- 10. SEED COHORT 1 ---------------------------------------------------------
insert into public.cohorts (slug, title, price_pence, starts_on, ends_on, seat_cap)
values ('ial-chem-as-sep-2026',
        'Edexcel IAL Chemistry AS — 12-Week Exam Intensive',
        24900, '2026-09-06', '2026-11-29', 20)
on conflict (slug) do nothing;
