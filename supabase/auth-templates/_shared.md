# Auth email templates

Paste each `.html` file into **Supabase Dashboard → Authentication → Emails**,
into the template of the matching name. They are plain HTML with inline styles —
no build step, no imports, nothing to compile.

## Why inline styles and tables

Email clients are not browsers. Gmail strips `<style>` blocks in some contexts,
Outlook renders through Word's engine, and neither supports CSS variables, flex
or grid reliably. So: table layout, inline styles, hex colours written out.

## Why the fonts are a stack, not a webfont

Fraunces and Inter are loaded by `next/font` in the app. An email cannot do
that — Gmail strips `@font-face` outright. Each template names the brand font
first so desktop clients that happen to have it use it, then falls back through
system serif/sans. The layout is designed to hold up in the fallback, because
that is what most recipients will see.

## Brand values used

Taken from `src/app/globals.css`, written as literals because email has no
custom properties:

| token         | value     | used for                     |
|---------------|-----------|------------------------------|
| ink           | `#0F1419` | body text, button background |
| ink-60        | `#5C5952` | secondary text               |
| ink-40        | `#8A867D` | captions, footer             |
| parchment     | `#F5EFE6` | page background              |
| parchment-2   | `#EDE5D8` | rules, muted surface         |
| snow          | `#FFFFFF` | card background              |
| signal (lime) | `#B8FF3D` | accent rule only             |

⚠ **Lime is an accent, never a button.** `#B8FF3D` on white fails contrast badly,
and a call to action a recipient cannot read is worse than a plain one. Buttons
are ink on parchment; the lime appears as a 3px rule under the wordmark.

## Supabase template variables

Only these are substituted. Anything else renders literally:

- `{{ .ConfirmationURL }}` — the action link
- `{{ .Token }}` — 6-digit OTP
- `{{ .SiteURL }}`, `{{ .Email }}`

⚠ **`{{ .ConfirmationURL }}` must not sit inside a tracking wrapper.** If a
provider rewrites links for click tracking, the Supabase token can be consumed
by the scanner before the recipient clicks it and the link arrives already used.
Turn click tracking OFF for this stream — see `CREDENTIALS.md`.
