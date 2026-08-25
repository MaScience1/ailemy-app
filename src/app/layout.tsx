import { Analytics } from "@/components/analytics/Analytics";
import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { AdminOverlay } from "@/components/admin-inline/AdminOverlay";

/**
 * ⚠ VARIABLE, NOT FOUR STATIC WEIGHTS — OPTICAL SIZING WAS NEVER ENGAGED.
 *
 * This asked for weight: ["400","500","600","700"], and next/font answers a
 * weight list with STATIC instances. A static instance carries no `opsz`
 * axis, so `font-optical-sizing: auto` had nothing to act on: every display
 * heading was rendering with letterforms drawn for body text — tighter
 * apertures and heavier hairlines than Fraunces intends at 48px.
 *
 * Omitting `weight` requests the variable font, and `axes` adds the optical
 * and stylistic axes on top of the implicit `wght`. globals.css then drives
 * `opsz` explicitly at each display size rather than trusting the default.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

/**
 * ⚠ §57 — SITE-WIDE FALLBACK METADATA, AND IT WAS TWICE WRONG.
 *
 * It read: "Ailemy — Where reaction meets revelation." / "AI-native exam
 * preparation for IB, IGCSE, and A-Level. Built on the spec, not around it."
 *
 *   • "AI-native" is the closest thing on the site to the public AI-marking
 *     claim that is not allowed to exist. Marking is mark-scheme-informed and
 *     human-reviewed; "AI-native" advertises the opposite emphasis.
 *   • "IB, IGCSE, and A-Level" is the old positioning. Ailemy teaches Pearson
 *     Edexcel GCSE, International GCSE and IAL, and the footer and homepage
 *     were corrected to say so — this was the last place still disagreeing.
 *
 * No `title.template` deliberately: every page already sets a complete title
 * ("Live tuition — Ailemy"), and a template would render "… · Ailemy · Ailemy".
 */
export const metadata: Metadata = {
  title: "Ailemy — online science school and exam practice",
  description:
    "Live small-group science tuition, specification-mapped learning, past-paper practice with " +
    "mark-scheme-informed marking, and progress tracking. Pearson Edexcel GCSE, International GCSE and IAL.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* ⚠ RENDERS NOTHING AND SENDS NOTHING WITHOUT A KEY. See
            lib/analytics/posthog.ts — keyless is the normal state, and the
            privacy policy ships in the same branch as the key. */}
        <Analytics />
        {children}
        {/*
          Renders null for every non-admin (server-side branch), so students
          receive no overlay markup and no overlay JS chunk.
        */}
        <AdminOverlay />
      </body>
    </html>
  );
}
