"use client";

import posthog from "posthog-js";

import type { EventName, EventProps } from "./events";

/**
 * PostHog, initialised only when it is actually configured (§37).
 *
 * ============================================================================
 * ⚠ NO KEY MEANS NO SCRIPT, NOT A BROKEN ONE
 * ============================================================================
 * NEXT_PUBLIC_POSTHOG_KEY absent is the normal state in development and will be
 * the state in production until the founder adds one. In that case nothing
 * loads, nothing is sent, and every `track()` call is a no-op — the same
 * keyless discipline Stripe already follows here.
 *
 * ⚠ AND THE PRIVACY POLICY SHIPS WITH IT OR NEITHER SHIPS. privacy/page.tsx
 * states in the published text that PostHog is not installed and requires the
 * page be updated BEFORE it goes live — "a release step, not a follow-up". The
 * policy text is updated in the same branch as this file. Setting the key
 * without that text going live would make the published policy false.
 *
 * ⚠ NO AUTOCAPTURE, AND THAT IS THE POINT. autocapture records every click and
 * input on the page, including form fields — which on this site means names,
 * emails and a child's year group. Only the named events in events.ts are sent.
 * `person_profiles: "identified_only"` means an anonymous visitor never becomes
 * a stored profile.
 */

let started = false;

export function initAnalytics(): void {
  if (started) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;                       // ⚠ keyless: do nothing at all
  if (typeof window === "undefined") return;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
    // ⚠ EVERY ONE OF THESE IS A DELIBERATE NARROWING, not a default.
    autocapture: false,          // no blanket click/input capture — see above
    capture_pageview: false,     // pageviews are sent explicitly, once, by us
    capture_pageleave: false,
    disable_session_recording: true,   // never record a session on this site
    person_profiles: "identified_only",
    persistence: "memory",       // ⚠ no cookie, so no consent banner is owed
  });
  started = true;
}

/**
 * ⚠ THE ONLY WAY TO SEND AN EVENT. The name is a union, so a typo is a compile
 * error rather than a silently forked funnel, and the props type forbids
 * free-form keys — which is what stops an email address reaching a third party.
 */
export function track(name: EventName, props?: EventProps): void {
  if (!started) return;
  posthog.capture(name, props);
}

/** True when analytics is actually running — for a UI that needs to know. */
export function analyticsEnabled(): boolean {
  return started;
}
