# Transactional email — what I need from you

Everything that needs no secret is done: five templates in this folder, on
brand, verified for the traps that break auth mail. **Nothing has been sent, no
account has been created, and no credential has been invented or guessed.**

This is the seam. Below is exactly what to fetch and exactly where each value
goes.

---

## Why this is blocking, in one paragraph

Supabase's built-in sender is explicitly **for development only**. It is rate
limited to a handful of messages per hour across the whole project, sends from a
Supabase-owned address, and has no deliverability reputation attached to your
domain. A parent who pays and then waits for a confirmation email that never
arrives — or lands in spam — cannot complete signup, and there is no code change
that fixes it. It needs a real sender.

---

## 1. Choose a provider

Any SMTP provider works; Supabase takes host/port/user/pass. Two that suit this
project:

| | **Resend** | **Postmark** |
|---|---|---|
| Free tier | 3,000/month, 100/day | 100/month, then paid |
| Setup | fastest — DNS + key, minutes | slightly more involved |
| Deliverability | good | best in class for transactional |
| Separate streams | no | **yes** — transactional never mixes with marketing |

**My recommendation: Resend**, on the free tier, now. The volume fits early
signups comfortably, setup is the shortest path off the dev sender, and moving
to Postmark later is a host/user/pass change and a second DNS record — not a
migration. Take Postmark instead if you already know you'll send marketing email
from the same domain, because keeping those streams apart is what protects the
signup mail.

⚠ **Do not use a Gmail/Workspace SMTP account.** It is rate limited, it rewrites
headers, and a sending account suspension takes signup down with it.

---

## 2. What to fetch

### a. The API key / SMTP password

- Resend → **Dashboard → API Keys → Create API Key**, permission **Sending
  access** only.
  - Value looks like `re_...`
  - SMTP username is the literal string `resend`
  - SMTP host `smtp.resend.com`, **port 587**, TLS **STARTTLS**
- Postmark → **Servers → [your server] → API Tokens → Server Token**
  - SMTP host `smtp.postmarkapp.com`, port 587
  - Username **and** password are both the server token

⚠ Give it **sending permission only**. A full-access key in an SMTP field is a
key that can also read and delete.

### b. The DNS records

On the domain you'll send from. Decide this first, because it goes in the
records:

- **Sending domain**: I'd use a subdomain — `mail.ailemy.com` — rather than the
  apex. A subdomain's sending reputation is separate from the apex's, so a
  future marketing mistake cannot take signup email down with it. The
  *From* address still reads `noreply@mail.ailemy.com`.
- Confirm whether **ailemy.com** is the live domain and where its DNS is hosted
  (Cloudflare / Vercel / registrar) — I don't have that and won't assume it.

The provider generates the exact values after you add the domain. There will be:

| Record | Type | Purpose |
|---|---|---|
| SPF | TXT on the sending domain | says the provider may send as you |
| DKIM | TXT (often 1–3 CNAMEs on Resend) | signs each message |
| DMARC | TXT at `_dmarc.<domain>` | tells receivers what to do on failure |
| Return-Path | CNAME | aligns the bounce domain |

**Start DMARC at `p=none`:**

```
v=DMARC1; p=none; rua=mailto:dmarc@ailemy.com
```

`p=none` monitors without rejecting. Going straight to `p=reject` before SPF and
DKIM are confirmed aligned bounces your own signup mail, and the symptom is
silence. Tighten to `quarantine` then `reject` once reports are clean.

⚠ **Propagation is real.** Verify in the provider's dashboard that every record
reads *verified* before switching Supabase over. A half-propagated DKIM sends
mail that authenticates intermittently, which is worse to diagnose than mail
that fails outright.

---

## 3. Where each value goes

**Supabase Dashboard → Project Settings → Authentication → SMTP Settings**
→ *Enable Custom SMTP*:

| Field | Value |
|---|---|
| Sender email | `noreply@mail.ailemy.com` |
| Sender name | `Ailemy` |
| Host | `smtp.resend.com` |
| Port | `587` |
| Username | `resend` |
| Password | the `re_...` key |
| Minimum interval | leave default |

⚠ **This is a dashboard setting, not an env var.** It does not belong in
`.env.local`, is not read by the app, and must not be committed. The app never
sees this key — Supabase sends the mail.

Then **Authentication → Emails**, and paste each file in this folder into the
template of the matching name:

| File | Supabase template |
|---|---|
| `confirm-signup.html` | Confirm signup |
| `magic-link.html` | Magic Link |
| `reset-password.html` | Reset Password |
| `invite.html` | Invite user |
| `change-email.html` | Change Email Address |

Also check **Authentication → URL Configuration**:

- **Site URL** — the production origin. Every `{{ .ConfirmationURL }}` is built
  from it, so if it still points at localhost the links in real email will too.
- **Redirect URLs** — must include the production callback. `/auth/callback`
  exists in this app; a URL not on the allow-list is rejected after the
  recipient has already clicked, which reads as a broken link.

⚠ **Turn OFF click tracking** for this stream (Resend: per-domain; Postmark: per
message stream). A tracker rewrites `{{ .ConfirmationURL }}` through its own
domain, and a scanner — corporate mail filters do this routinely — can consume
the one-time Supabase token before the recipient clicks. The user then sees
"link expired" on a link they never opened.

---

## 4. How to know it worked

I haven't test-sent anything, deliberately. When the above is in place:

1. Sign up with a **real address you control on a different provider** from your
   own (a Gmail address if your domain is Google-hosted, say). Self-delivery
   inside one provider proves less than nothing about deliverability.
2. Check it arrives in **Inbox, not Promotions or Spam**.
3. Open the raw source and confirm the headers read `spf=pass`, `dkim=pass`,
   `dmarc=pass`.
4. Click the link and confirm it lands on the app, signed in.
5. Send to an Outlook/Hotmail address too — its filtering is the strictest of
   the big three and the most likely to catch a missing record.

If you want, paste me the raw headers afterwards and I'll read the
authentication results.

---

## What I did not do, and why

- **No credentials invented.** No placeholder key, no example DNS value that
  could be pasted in by mistake and appear to work.
- **No test send.** Sending needs a real key and would go to a real inbox.
- **No account created** with any provider.
- **`.env.local` untouched.** The SMTP password does not belong there — it is a
  Supabase dashboard setting, and putting a copy in the repo's env file creates
  a second place for it to leak from.
