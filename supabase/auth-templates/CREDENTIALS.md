# Transactional email — Resend on ailemy.com, DNS on Cloudflare

Everything that needs no secret is done: five templates in this folder, on
brand, verified. **Nothing has been sent, no account created, no credential
invented.** Below is the runbook, in order.

Decisions already taken: **Resend**, sending domain **`mail.ailemy.com`**, DMARC
starts at **`p=none`**, click tracking **off**.

⚠ **Why a subdomain and not the apex.** `mail.ailemy.com` builds its own sending
reputation. If marketing mail ever goes out from the apex and gets complaints,
signup email on the subdomain is unaffected — and the reverse. The *From*
address reads `noreply@mail.ailemy.com`, which is unremarkable to a recipient.

---

## Step 1 — Resend account and domain

1. Sign up at **resend.com** (free tier: 3,000/month, 100/day).
2. **Domains → Add Domain** → enter `mail.ailemy.com`.
3. Choose the region closest to your users — **eu-west-1 (Ireland)**.
4. Resend shows you a record set. **Do not close that page**: the DKIM value is
   generated per domain and is the one thing below I cannot give you.

---

## Step 2 — Cloudflare DNS

Cloudflare dashboard → **ailemy.com** → **DNS → Records**.

⚠ **Two Cloudflare-specific traps, both of which cause silent failure:**

- **Proxy status must be `DNS only`** (grey cloud, not orange) on every record
  below. Cloudflare's proxy does not apply to TXT/MX, but it *will* try on a
  CNAME, and a proxied DKIM CNAME resolves to Cloudflare's IPs instead of
  Resend's — DKIM then fails to verify with no obvious cause.
- **Cloudflare appends the zone name.** In the Name field enter
  `resend._domainkey.mail`, **not** `resend._domainkey.mail.ailemy.com`. Typing
  the full name produces `resend._domainkey.mail.ailemy.com.ailemy.com`. If
  Cloudflare shows the full name back to you after saving, that is correct.

### The records

| # | Type | Name (as typed into Cloudflare) | Value | TTL | Proxy |
|---|------|--------------------------------|-------|-----|-------|
| 1 | `MX` | `send.mail` | `feedback-smtp.eu-west-1.amazonses.com` (priority **10**) | Auto | DNS only |
| 2 | `TXT` | `send.mail` | `v=spf1 include:amazonses.com ~all` | Auto | n/a |
| 3 | `TXT` | `resend._domainkey.mail` | **the long `p=MIGfMA0…` key Resend shows you** | Auto | n/a |
| 4 | `TXT` | `_dmarc.mail` | `v=DMARC1; p=none; rua=mailto:dmarc@ailemy.com; fo=1` | Auto | n/a |

**Record 3 is the only value I cannot give you** — it is generated per domain.
Copy it from the Resend page exactly, with no added quotes and no line breaks.
Cloudflare will show it wrapped in the UI; that is display only.

⚠ **Records 1 and 2 are on `send.mail`, not `mail`.** That subdomain is the
bounce/return-path domain, and getting it right is what makes SPF *align* with
the From address. An SPF record on the wrong host passes SPF and fails DMARC
alignment, which is the hardest version of this to diagnose.

⚠ **If you already have an SPF TXT record on `mail` or the apex, do not add a
second one.** A domain with two SPF records is a PermError and every receiver
treats it as a failure. Merge into the existing one instead — add
`include:amazonses.com` before the `~all`.

`fo=1` on the DMARC record asks for a forensic report on any failure, which is
what makes `p=none` useful rather than just permissive.

### After adding

Back in Resend → **Domains → mail.ailemy.com → Verify**. Wait until all four
read **verified** — Cloudflare is usually seconds, but do not proceed on
"pending". A half-propagated DKIM authenticates intermittently, which is worse
to diagnose than one that fails outright.

---

## Step 3 — The API key

Resend → **API Keys → Create API Key**.

- Name: `supabase-auth`
- Permission: **Sending access** — not full access. A key in an SMTP field
  should not also be able to read and delete.
- Domain: restrict to `mail.ailemy.com`.

Copy the `re_…` value. **It is shown once.**

---

## Step 4 — Turn click tracking OFF

Resend → **Domains → mail.ailemy.com → Settings** → ensure **Click tracking** is
disabled. (Open tracking is harmless; click tracking is not.)

⚠ **This is the one that will bite silently.** Click tracking rewrites every
link through the provider's domain. `{{ .ConfirmationURL }}` carries a
single-use Supabase token, and corporate mail filters follow links to scan them
— so the scanner consumes the token before the recipient clicks, and they see
"link expired" on a link they never opened. It is intermittent, it depends on
the recipient's employer, and it looks like a Supabase bug.

---

## Step 5 — Supabase

**Project Settings → Authentication → SMTP Settings** → *Enable Custom SMTP*:

| Field | Value |
|---|---|
| Sender email | `noreply@mail.ailemy.com` |
| Sender name | `Ailemy` |
| Host | `smtp.resend.com` |
| Port | `587` |
| Username | `resend` (the literal string) |
| Password | the `re_…` key |
| Minimum interval | leave default |

⚠ **A dashboard setting, not an env var.** It does not belong in `.env.local`,
the app never reads it, and a copy in the repo's env file is a second place for
it to leak from. Supabase sends the mail; the app never holds this key.

Then **Authentication → Emails** — paste each file into the matching template:

| File | Supabase template |
|---|---|
| `confirm-signup.html` | Confirm signup |
| `magic-link.html` | Magic Link |
| `reset-password.html` | Reset Password |
| `invite.html` | Invite user |
| `change-email.html` | Change Email Address |

And **Authentication → URL Configuration**:

- **Site URL** → `https://ailemy.com` (no trailing slash). Every
  `{{ .ConfirmationURL }}` is built from this — if it still points at localhost,
  so will the links in real email.
- **Redirect URLs** → must include `https://ailemy.com/auth/callback`. A URL not
  on the allow-list is rejected *after* the recipient has clicked, which reads
  to them as a broken link.

---

## Step 6 — Prove it, don't assume it

1. Sign up with a **real address on a different provider from your own** — a
   Gmail address, given ailemy.com's own mail. Self-delivery inside one provider
   proves nothing about deliverability.
2. It must land in **Inbox**, not Promotions or Spam.
3. Open the raw source (Gmail: ⋮ → Show original) and confirm:
   `spf=pass`, `dkim=pass`, `dmarc=pass`, and **`header.from=mail.ailemy.com`**
   — alignment, not just passing.
4. Click the link and confirm it signs you in.
5. Repeat to an **Outlook/Hotmail** address. Its filtering is the strictest of
   the big three and the likeliest to catch a missing record.

Paste me the raw headers afterwards and I'll read the authentication results.

⚠ Leave DMARC at `p=none` until you have a week of clean reports. Only then
`p=quarantine`, and later `p=reject`. Going straight to reject before alignment
is confirmed bounces your own signup mail, and the symptom is silence.

---

## What I did not do, and why

- **No credentials invented.** No placeholder key, no example DKIM value that
  could be pasted in and appear to work.
- **No test send.** That needs a real key and a real inbox.
- **No account created** with Resend or anyone else.
- **`.env.local` untouched.**
