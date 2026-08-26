# §5 — the ten-section mobile reorder is NOT DONE

**Branch:** `feat/mobile-home-refine-2`
**Recorded:** 25 August 2026
**Status:** stopped deliberately, by founder ruling. Not blocked, not in progress.

This branch carries **§4 only** — the compact tuition section and governing
constraint 3, the derived next-class teaser. §5 was attempted and abandoned
twice on purpose. This note exists so the next session does not read a clean
tree as "nothing was tried here" and reach for the same method a third time.

---

## What was attempted, and how it failed

Two attempts to move the tuition `<Section>` below Subjects, both by extracting
a line range and re-inserting it elsewhere in `src/app/[locale]/page.tsx`.

| | method | result |
|---|---|---|
| 1 | line-arithmetic block extraction | `TS1381: Unexpected token` |
| 2 | line-arithmetic block extraction, adjusted bounds | `TS1381: Unexpected token` |

**The cause, both times:** the computed block boundary cut through a multi-line
JSX comment. `page.tsx` is ~1,300 lines and its `{/* … */}` blocks routinely run
to eight or ten lines, so a boundary chosen by counting lines lands inside one
far more often than it looks like it should. The extracted block then opened a
comment it never closed, and the re-inserted remainder closed one it never
opened.

**Both attempts were reverted in full**, immediately, with no hand-repair. That
is the correct outcome and is recorded here as such — not as a failure. A page
that takes money, half-restructured by a machine rewrite nobody has read, is
worse than the same page unchanged. This is the identical failure shape to the
scripted i18n batch that produced eleven syntax errors across five files and was
also reverted whole.

---

## What that costs, measured

Measured on a production build at 375×812:

```
TUITION_SECTION_TOP = 2416
```

**Why 2416 and not just-below-the-hero:** the hero's calendar column stacks
*above* the compact section on mobile. §4's own placement therefore depends on
the calendar move, which belongs to §5.

So §4 is **built and correct, but sitting in the wrong place on a phone**. Its
content, its three CTAs and its derived teaser are all verified — the teaser
resolves to `Tue 15 Sept · 7:00 PM · Edexcel IAL Chemistry AS`, correctly
skipping the Sun 13 Sep onboarding entry. Only its position is outstanding, and
it will not be right until the calendar moves out of the hero.

---

## How §5 gets done

**Hand-editing, with the file open and read.** Anchors located by reading, not
by arithmetic; each move applied as a single targeted edit against text that was
actually looked at. Two moves are needed:

1. the tuition `<Section>` below `subjects`
2. `#hero-calendar` out of the hero

Target order: Header · Hero · Compact tuition · Explore Ailemy (`products`) ·
Marking demo (`try`) · Progress/how · Subjects · Detailed tuition + calendar ·
Trust/teachers/audience · Final CTA.

**First act of the next session.** Not tonight, and not scripted.

---

## Doctrine this established

> Restructuring a large JSX file by line arithmetic fails the same way twice.
> Block moves on files over ~1,000 lines are hand-edits with the file open, not
> scripted extractions. **Two clean reverts is the correct outcome, not a
> failure.**
