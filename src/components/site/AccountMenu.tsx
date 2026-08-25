"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { CalendarDays, ChevronDown, LogOut, UserRound } from "lucide-react";

import { navToneVars } from "@/lib/design/subject-colours";
import type { NavSession } from "@/lib/auth/nav-session";

/**
 * The signed-in account control in the site header.
 *
 * ============================================================================
 * ⚠ THE HEADER SHOWS A NAME, NOT A LOGIN ADDRESS
 * ============================================================================
 * It used to render `session.email` as the primary identity — the one string on
 * the page that is a CREDENTIAL rather than a person. It sat in the nav of every
 * marketing page, visible to anyone standing behind the student, truncated in
 * the middle of a domain so it was not even legible as an address. A name is
 * what a person is called; an address is how they sign in, and the two are not
 * interchangeable.
 *
 * The address still appears, once, INSIDE the open menu, as the secondary line
 * under the name — which is the one place it answers a real question ("which
 * account am I in?").
 *
 * ⚠ AND WHEN THERE IS NO NAME, THE LABEL NAMES THE CONTROL, NOT THE PERSON.
 * identity.ts's displayName() ends its ladder at null on purpose: "Student",
 * "User" and "there" all look like the system knows who you are and got it
 * wrong. That ruling is about NAMING A PERSON and it still stands — nothing here
 * invents a first name, and initialsFor() refuses to cut a monogram out of an
 * email. "My Account" is a different kind of string: it is the label of a
 * button, describing where the button goes. A nameless account gets a neutral
 * silhouette and the word Account; it never gets a fabricated identity, and it
 * never gets a raw uuid.
 *
 * ⚠ NO SUPABASE CLIENT IN HERE. Sign-out stays a plain <form method="POST">,
 * exactly as it was in SiteNav: importing the browser client would ship it to
 * every visitor of every marketing page, including logged-out ones who can never
 * use it, and the form still works with JavaScript disabled. See
 * src/app/api/auth/sign-out/route.ts.
 *
 * ⚠ THE TYPE IMPORT CROSSES INTO A server-only MODULE, AND THAT IS SAFE.
 * `import type` is erased before bundling, so nothing from nav-session.ts
 * reaches the client. Same pattern as AnswerEditor.tsx importing ResponsePayload
 * from the server-only @/lib/exam/attempts. Duplicating the shape here instead
 * is what let SiteNav's old private copy of NavSession drift.
 */

export type AccountSession = NonNullable<NavSession>;

/**
 * ============================================================================
 * ⚠ EVERY ENTRY IS A ROUTE THAT EXISTS. THE ABSENT ONES ARE ABSENT ON PURPOSE.
 * ============================================================================
 * A menu is a promise about where things are. Four of the six entries this
 * control was asked for could not be kept honestly, and each was checked against
 * src/app rather than assumed:
 *
 *   Progress     — there is no /progress route. Academic progress is real, but
 *                  it renders INSIDE /profile (loadAcademicSummary → MyCourses),
 *                  and those sections carry no id to anchor to. A second entry
 *                  landing on the same page top would be a label pretending to
 *                  be a destination.
 *
 *   My Tuition   — /my-tuition exists only as a 307 to /profile. That redirect
 *                  IS the founder ruling of 2026-08-20, "ONE STUDENT SURFACE,
 *                  NOT TWO"; putting the old name back in a menu re-creates the
 *                  second surface the ruling deleted, this time as a signpost.
 *
 *   Settings     — no /settings route exists anywhere in src/app. The timezone
 *                  editor that would be its first inhabitant is still the next
 *                  slice (see the §21 note on /profile).
 *
 *   Billing      — deliberately excluded. Payment work is paused.
 *
 * Calendar IS duplicated from the top-level nav row, and that is not the
 * Resources mistake NAV_LINKS warns about: Resources was a second DISCOVERY
 * MODEL for the whole content tree, maintained in parallel. This is one link to
 * one page, reachable two ways — and on mobile the account section is already
 * open when a student wants it.
 */
const ACCOUNT_LINKS = [
  {
    label: "My profile",
    href: "/profile",
    hint: "Courses, calendar, credits and lessons",
    Icon: UserRound,
  },
  {
    label: "Calendar",
    href: "/calendar",
    hint: "Everything Ailemy has scheduled",
    Icon: CalendarDays,
  },
] as const;

/**
 * ⚠ THE FALLBACK LABELS THE BUTTON, NOT THE STUDENT. See the header note. This
 * is exported so the desktop trigger and the mobile panel cannot answer the
 * question differently.
 */
export function accountLabel(session: AccountSession): string {
  return session.name ?? "My Account";
}

/**
 * ⚠ HOVER IS NEVER THE ONLY TRIGGER, and the outline is a separate property
 * from the tint — a decorative fill that doubles as the focus indicator stops
 * being an indicator the moment somebody restyles the decoration. Same contract
 * as TAB in SiteNav.
 *
 * The outline offset is NEGATIVE so the ring is drawn inside the row rather than
 * clipped by the panel edge it sits against.
 */
const ITEM_BASE = [
  "flex w-full gap-2.5 rounded px-3 text-left",
  "transition-colors duration-150",
  "hover:bg-ink/[0.06] focus-visible:bg-ink/[0.06]",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink",
].join(" ");

/**
 * ⚠ THREE COMPLETE LITERALS, NOT ONE STRING WITH BITS OVERRIDDEN.
 *
 * Two hazards, and both bite silently:
 *
 *   Tailwind generates a utility only for a class name it can SEE while
 *   scanning the source. `ITEM.replace("py-2", "py-2.5")` puts `py-2.5` nowhere
 *   in this file, so the row loses its padding the day nothing ELSE on the site
 *   happens to use it. Same constraint subject-colours.ts records for the gold
 *   ramp's literals.
 *
 *   And appending `items-center` after `items-start` does not win. Conflicting
 *   utilities resolve by CSS SOURCE order, not by class-attribute order — so
 *   the alignment is chosen by whichever Tailwind happened to emit last, which
 *   is not a decision anyone made. Neither string carries an alignment it then
 *   has to fight.
 *
 * The mobile row is the taller one: a 24px line box plus 20px of padding is a
 * 44px touch target, against 36px where there is a pointer.
 */
const ITEM = `${ITEM_BASE} items-start py-2`;
const ITEM_MOBILE = `${ITEM_BASE} items-start py-2.5`;
/** Sign out is one line with an icon, so it centres rather than top-aligning. */
const ITEM_FLAT = `${ITEM_BASE} items-center py-2`;

/**
 * The initials bubble.
 *
 * ⚠ 20px ON DESKTOP BECAUSE THE Login CAPSULE IS 34px TALL. The signed-out
 * header renders `Login` in the same slot: text-sm (20px line box) + py-1.5
 * (12px) + two 1px borders = 34px. A 24px bubble would have made the header 4px
 * taller the instant a student signed in, for no reason they could see. This is
 * the same "nothing reflows, ever" rule the hover capsule is built around.
 *
 * ⚠ aria-hidden BECAUSE THE NAME IS RIGHT THERE. Reading "M A, Muhammed Ali"
 * out loud is noise; the monogram is decoration for the eye only.
 *
 * ⚠ NO INITIALS MEANS A SILHOUETTE, NOT A LETTER. initialsFor() returns null
 * rather than slicing a monogram out of a login address — see identity.ts.
 */
function Bubble({ initials, size }: { initials: string | null; size: "sm" | "md" }) {
  const box = size === "sm" ? "h-5 w-5 text-[10px]" : "h-9 w-9 text-xs";
  const glyph = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-ink font-medium leading-none tracking-wide text-parchment ${box}`}
    >
      {initials ?? <UserRound className={glyph} strokeWidth={2.25} />}
    </span>
  );
}

/** Every focusable row currently in the open menu, in DOM order. */
function menuItems(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>('[role="menuitem"]'));
}

/**
 * Desktop: a name pill that discloses a dropdown.
 *
 * `capsuleClassName` is SiteNav's TAB, passed in rather than imported. SiteNav
 * owns the nav's visual language and already imports this file; importing TAB
 * back out of it would make the two modules circular, and re-typing the capsule
 * here is exactly the drift TAB's own comment exists to prevent.
 */
export function AccountMenu({
  session,
  capsuleClassName,
}: {
  session: AccountSession;
  capsuleClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  const label = accountLabel(session);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    // Escape must put the caret back where it came from; a click outside must
    // not steal focus away from whatever the click was aimed at.
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Bound only while open, so a closed nav — the state on every page a
  // logged-out visitor ever sees — adds no global listeners.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open, close]);

  /**
   * ⚠ FOCUS ENTERS THE MENU ON OPEN. role="menu" is a promise that arrow keys
   * work and that the items are not in the tab order; a panel that announces
   * itself as a menu and then leaves focus on the button behind it strands a
   * keyboard user with no way in. focus-visible means a mouse user sees no ring.
   */
  useEffect(() => {
    if (!open) return;
    menuItems(menuRef.current)[0]?.focus();
  }, [open]);

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Tab leaves a menu rather than walking it — the items are tabIndex={-1}.
    if (e.key === "Tab") {
      setOpen(false);
      return;
    }
    const list = menuItems(menuRef.current);
    if (list.length === 0) return;
    const here = list.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => {
      e.preventDefault();
      list[(i + list.length) % list.length]?.focus();
    };
    if (e.key === "ArrowDown") go(here < 0 ? 0 : here + 1);
    else if (e.key === "ArrowUp") go(here < 0 ? list.length - 1 : here - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(list.length - 1);
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        style={navToneVars("neutral")}
        /**
         * ⚠ THE SAME CAPSULE AS Login, BECAUSE IT IS THE SAME SLOT. Signed out
         * this position holds a Login link; signed in it holds this control. If
         * only one of them grew a capsule, the nav would change shape on sign-in
         * for no reason the user can see. max-w and truncate stay: a long name
         * must never push the nav around.
         *
         * ⚠ NO title ATTRIBUTE ANY MORE. It used to carry the full email because
         * the visible label was a truncated address. The label is a name now, and
         * a native tooltip that prints a login address on hover is the shoulder-
         * surfing problem this whole change was made to remove.
         */
        className={`${capsuleClassName} max-w-[16rem] gap-2 text-sm font-medium text-ink/80`}
      >
        <Bubble initials={session.initials} size="sm" />
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          /**
           * ⚠ THE ACCESSIBLE NAME FALLS BACK TO THE ADDRESS. THE VISIBLE LABEL
           * STILL DOES NOT.
           *
           * The identity header below is role="none" — correct, because a
           * role="menu" may only own menuitems — but that also means the address
           * it renders is not part of anything's accessible NAME. A sighted user
           * opening this menu can always answer "which account am I in?"; a
           * screen-reader user got `label`, and for a nameless account `label` is
           * "My Account", which answers nothing. The one disambiguator on the
           * panel was visible and unnamed.
           *
           * So the NAME ladder ends at the address where the VISIBLE ladder ends
           * at "My Account". That is not the ruling being reversed: nothing new
           * is rendered, the header chrome still never prints a credential, and
           * the address is announced only in the case where it is already on
           * screen and is the only thing distinguishing one account from another.
           * accountLabel() is deliberately not touched — the button keeps
           * labelling the button.
           */
          aria-label={`Account: ${session.name ?? session.email}`}
          ref={menuRef}
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full z-50 mt-2 w-[17rem] rounded-md border border-ink/10 bg-parchment p-1 shadow-[0_8px_24px_-12px_rgba(15,20,25,0.18)]"
        >
          {/* ⚠ role="none" ON EVERYTHING THAT IS NOT AN ITEM. A role="menu" whose
              children are arbitrary divs is a malformed widget; the identity
              header and the rules are presentation, and say so. */}
          <div role="none" className="flex items-start gap-2.5 px-3 pb-2.5 pt-2">
            <Bubble initials={session.initials} size="md" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">{label}</span>
              {/* ⚠ MONO, SO IT DOES NOT MASQUERADE AS A NAME. Same treatment
                  /profile and /dashboard give an address they have to show. */}
              <span
                className="mt-0.5 block truncate font-mono text-[11px] text-ink/55"
                title={session.email}
              >
                {session.email}
              </span>
            </span>
          </div>

          <div role="none" className="border-t border-ink/10" />

          <div role="none" className="py-1">
            {ACCOUNT_LINKS.map(({ label: text, href, hint, Icon }) => (
              <Link
                key={href}
                href={href}
                role="menuitem"
                tabIndex={-1}
                onClick={() => setOpen(false)}
                className={ITEM}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink/55" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{text}</span>
                  <span className="block text-[11px] leading-snug text-ink/50">{hint}</span>
                </span>
              </Link>
            ))}
          </div>

          {/* ⚠ SIGN OUT IS SEPARATED BY A RULE, NOT BY A COLOUR. It is the one
              destructive-feeling row here, and marking it in red alone would be
              state carried by colour; the rule and the icon carry it in
              greyscale too. --color-danger is reserved for errors. */}
          <div role="none" className="border-t border-ink/10" />
          <SignOutForm next={pathname} menuitem />
        </div>
      )}
    </div>
  );
}

/**
 * Mobile: the same identity and the same routes, flat.
 *
 * ⚠ NO DROPDOWN INSIDE THE DROPDOWN. The hamburger panel IS the disclosure, so
 * nesting a second one would be a pointless extra tap on the surface where taps
 * are most expensive. Rows are 44px, which is why they use ITEM_MOBILE.
 */
export function AccountPanel({
  session,
  onNavigate,
}: {
  session: AccountSession;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const label = accountLabel(session);

  return (
    <>
      <div className="flex items-start gap-3">
        <Bubble initials={session.initials} size="md" />
        <div className="min-w-0">
          <p className="truncate text-base font-medium text-ink">{label}</p>
          <p className="truncate font-mono text-[11px] text-ink/55" title={session.email}>
            {session.email}
          </p>
        </div>
      </div>

      {/* -mx-3 cancels the row padding so a touched row bleeds out to meet the
          panel's own edge, exactly as TAB_MOBILE does for the primary links. */}
      <nav aria-label="Account" className="-mx-3">
        <ul className="space-y-0.5">
          {ACCOUNT_LINKS.map(({ label: text, href, hint, Icon }) => (
            <li key={href}>
              <Link href={href} onClick={onNavigate} className={ITEM_MOBILE}>
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink/55" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium text-ink">{text}</span>
                  <span className="block text-[11px] leading-snug text-ink/50">{hint}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-ink/10 pt-4">
        <SignOutForm next={pathname} full />
      </div>
    </>
  );
}

/**
 * Sign out via a form POST. `next` returns the visitor to the page they were
 * on; the route validates it as a same-origin relative path before redirecting.
 *
 * ⚠ role="none" ON THE FORM. Inside a role="menu" the BUTTON is the menuitem;
 * the form wrapping it is plumbing and must not appear in the accessibility
 * tree between the menu and its item.
 */
function SignOutForm({
  next,
  full = false,
  menuitem = false,
}: {
  next: string;
  full?: boolean;
  menuitem?: boolean;
}) {
  return (
    <form method="POST" action="/api/auth/sign-out" role={menuitem ? "none" : undefined}>
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        role={menuitem ? "menuitem" : undefined}
        tabIndex={menuitem ? -1 : undefined}
        className={
          full
            ? "flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-ink/15 px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-ink/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            : `${ITEM_FLAT} cursor-pointer text-sm font-medium text-ink`
        }
      >
        <LogOut className={full ? "h-4 w-4" : "h-4 w-4 shrink-0 text-ink/55"} aria-hidden="true" />
        Sign out
      </button>
    </form>
  );
}
