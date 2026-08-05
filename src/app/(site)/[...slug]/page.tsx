import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { getNavSession } from "@/lib/auth/nav-session";
import { Breadcrumb } from "@/components/catalogue/breadcrumb";
import { getEditContext } from "@/lib/admin/edit-mode";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { renderMarkdown } from "@/lib/pages/markdown";
import { EditPageSlot } from "@/components/admin-inline/page-slots";
import type { PageRow } from "@/components/admin-inline/PageEditor";

/**
 * Catch-all for admin-authored standalone pages.
 *
 * ROUTE PRIORITY: in the App Router, a static segment always beats a dynamic
 * one, and a dynamic segment beats a catch-all. This file sits at the root of
 * the (site) group with a `[...slug]` segment, which makes it the LOWEST
 * priority route in the application — it only ever runs for a path that no
 * real route file claims. /learn, /past-papers, /admin, /login, /signup,
 * /dashboard, /intensive, /auth/* and /api/* all continue to resolve to their
 * own files. (The route group parentheses add no URL segment.)
 *
 * Draft rows are invisible to the public: the anon client is subject to the
 * pages_public_read_published RLS policy. An admin gets a service-role read so
 * they can preview a draft before publishing.
 */

type Params = Promise<{ slug: string[] }>;

async function loadPage(
  slugParts: string[],
): Promise<{ page: PageRow | null; isDraftPreview: boolean }> {
  const slug = slugParts.map(decodeURIComponent).join("/");
  const { isAdmin } = await getEditContext();

  // Admin: service-role read so drafts are previewable.
  if (isAdmin) {
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("pages")
        .select("id, slug, title, body_md, status")
        .eq("slug", slug)
        .maybeSingle();
      return {
        page: (data as PageRow) ?? null,
        isDraftPreview: Boolean(data && data.status !== "published"),
      };
    } catch {
      return { page: null, isDraftPreview: false };
    }
  }

  // Public: anon client + RLS ⇒ published rows only.
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("pages")
      .select("id, slug, title, body_md, status")
      .eq("slug", slug)
      .maybeSingle();
    return { page: (data as PageRow) ?? null, isDraftPreview: false };
  } catch {
    // Table missing (0011 not applied) ⇒ behave as a plain 404.
    return { page: null, isDraftPreview: false };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const { page } = await loadPage(slug ?? []);
  if (!page) return { title: "Not found · Ailemy" };
  return { title: `${page.title} · Ailemy` };
}

export default async function DynamicPage({ params }: { params: Params }) {
  const { slug } = await params;
  const { page, isDraftPreview } = await loadPage(slug ?? []);

  // Missing, or a draft that this viewer may not see → real 404.
  if (!page) notFound();

  const html = renderMarkdown(page.body_md);

  const session = await getNavSession();

  return (
    <>
      <SiteNav session={session} />
      <main className="min-h-screen bg-parchment text-ink">
        <div className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-10 sm:py-24">
          <Breadcrumb crumbs={[{ label: page.title }]} />

          <EditPageSlot page={page} />

          {isDraftPreview && (
            <p className="mb-6 rounded-md border border-flask/40 bg-flask/10 px-3 py-2 text-sm text-ink/80">
              This page is a <strong>draft</strong> — visitors get a 404 until
              you publish it.
            </p>
          )}

          <h1 className="font-display mt-6 text-4xl font-medium leading-[1.05] tracking-tight md:text-5xl">
            {page.title}
          </h1>

          <article
            className="mt-8 text-base text-ink/80"
            // Safe: renderMarkdown escapes the entire source before
            // re-introducing a fixed set of tags. See lib/pages/markdown.ts.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
