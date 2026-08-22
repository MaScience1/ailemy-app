# `[TO CONFIRM]` — the public placeholder checklist (§84)

**Generated 2026-08-23 by an audit of `src/` and `content/`. Nothing here is invented: every value below is missing and must be supplied by the founder.** This is a report, not a change — no placeholder was filled with a guess.

## The one constant, and everywhere it surfaces

There is exactly **one** placeholder token in the codebase, and it is deliberate and centralised — [`src/lib/legal/company.ts:15`](../src/lib/legal/company.ts). Its own header says it is designed to be visible rather than silently absent, which is the right call. It is bound to three fields:

| Field | Line | What it needs |
|---|---|---|
| `companyNumber` | `company.ts:22` | The registered company number, or a decision that the business is not incorporated |
| `registeredOffice` | `company.ts:24` | The registered office address as it should appear publicly |
| `supportEmail` | `company.ts:33` | The support address that receives customer mail |

### Where those three render today

| Surface | File | Tokens visible |
|---|---|---|
| Site footer disclosure | `src/components/site/SiteFooter.tsx:107` | 2 |
| Privacy policy | `src/app/privacy/page.tsx:66`, `:216` + `LegalPage.tsx:33` + footer | 4 |
| Terms | `src/app/terms/page.tsx:160` + footer | 3 |

Because the disclosure lives in the footer, **two `[TO CONFIRM]` tokens render on every footer-bearing route**: `/`, `/chemistry`, `/biology`, `/physics`, `/past-papers`, `/tuition`, `/tuition/one-to-one`, `/tuition/interest`, `/calendar`, `/resources`, `/welcome`, `/profile`, `/intensive`, `/learn` and all 13 `/learn/*` routes — including every redesigned lesson page — plus any admin-authored page slug.

**This is the cheapest honesty fix available: three real values in one file clears every surface above at once.**

## What is NOT placeholder debt

Two things look like placeholders and are not; leave them alone.

- **"Coming soon" is a first-class catalogue status**, defined at `src/lib/catalogue/status.ts:68` and rendered from database state. On `/learn/*` it is DB-derived and honest — an accurate label for a pathway with no lessons, not a stub. (The `/chemistry` "Resources available" caption was a different matter: hardcoded and overstating. That section has been removed in this branch.)
- **`you@example.com`** in `sign-in-form.tsx:95` and `WaitlistForm.tsx:51` are input placeholders — the HTML attribute, doing its job.

## ⚠ Scope limit — two surfaces a repo grep cannot see

Two live copy surfaces are stored in Postgres, not in this repository:

1. **`pages.body_md`** — admin-authored standalone pages, rendered by `src/app/(site)/[...slug]/page.tsx`.
2. **`site_copy`** — key/value overrides loaded by `src/lib/copy/site-copy.ts:20-36`, which override the hardcoded defaults in `<Editable>` components.

Placeholder text or stale claims in either are **invisible to this audit**. Per `AGENTS.md`, querying production for them is the owner's job, not a subagent's. Two queries would settle it:

```sql
SELECT slug, title FROM public.pages
 WHERE body_md ILIKE '%TO CONFIRM%' OR body_md ILIKE '%lorem%';
```

```sql
SELECT key, value FROM public.site_copy
 WHERE value ILIKE '%TO CONFIRM%' OR value ILIKE '%lorem%';
```

## Terminology drift found in the same sweep (§85)

Reported, not silently "corrected" — several are deliberate register choices and the call is the founder's.

| Axis | The drift |
|---|---|
| **IAL** | Three spellings live: `IAL` (most pages), `International A-Level` (`pathways.ts:44`, the canonical), `International A Level` unhyphenated (`Faq.tsx:45`). The homepage alone renders the qualification three ways. |
| **GCSE / IGCSE** | `pathways.ts:111` documents that hub labels avoid jargon, while `:120-121` maps `igcse → "IGCSE"` and `uk-gcse → "GCSE"` — the jargon short names, and the second drops the "UK" qualifier the pathway card carries. |
| **AS / A2** | Four orderings, two of them **inside one form**: `InterestForm.tsx:22` ("IAL AS" / "IAL A2") and `:28` ("Year 12 / AS" / "Year 13 / A2"). |
| **Tuition** | Five labels for the group product (live group tuition, small-group, small groups, group cohort, live class) and four for the individual one (`1-to-1`, `One-to-one`, `one to one`, `Private tuition`) — while the data model calls them `group` / `private`, matching neither. Nav says "Live Tuition"; the `/tuition` H1 says "Learn live with Ailemy", using neither word. |

The `/tuition/one-to-one` self-contradiction (eyebrow "Private tuition" directly above H1 "1-to-1 Chemistry tuition") **has been fixed** in this branch. The rest await a naming ruling.
