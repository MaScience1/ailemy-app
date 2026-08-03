"use server";

import { revalidatePath } from "next/cache";

import { assertAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * CRUD for standalone dynamic pages.
 *
 * Every export below calls assertAdmin() as its FIRST statement. These actions
 * are directly invocable by anyone who can discover their ids — the edit-mode
 * cookie, the middleware gate and the server render checks are all irrelevant
 * to authorisation here.
 */

type Result = { ok: true; slug?: string } | { ok: false; error: string };

/**
 * Route prefixes owned by real files in the app. A dynamic page may not claim
 * one of these, because the real route always wins and the row would be
 * silently unreachable — better to reject at authoring time with a clear
 * message than to let someone create an invisible page.
 */
const RESERVED = [
  "admin",
  "api",
  "auth",
  "dashboard",
  "learn",
  "login",
  "signup",
  "past-papers",
  "intensive",
  "_next",
];

function normaliseSlug(raw: string): string {
  return raw
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function validateSlug(slug: string): string | null {
  if (!slug) return "Slug is required";
  if (!/^[a-z0-9]+(?:[-/][a-z0-9]+)*$/.test(slug)) {
    return "Slug may contain lowercase letters, numbers, hyphens and slashes only";
  }
  const first = slug.split("/")[0];
  if (RESERVED.includes(first)) {
    return `“${first}” is reserved by an existing route — pick another slug`;
  }
  return null;
}

export async function createPage(
  _prev: Result | null,
  fd: FormData,
): Promise<Result> {
  try {
    await assertAdmin();

    const slug = normaliseSlug(String(fd.get("slug") ?? ""));
    const title = String(fd.get("title") ?? "").trim();
    const body_md = String(fd.get("body_md") ?? "");
    const status = String(fd.get("status") ?? "draft");

    const slugError = validateSlug(slug);
    if (slugError) return { ok: false, error: slugError };
    if (!title) return { ok: false, error: "Title is required" };
    if (!["draft", "published"].includes(status)) {
      return { ok: false, error: "Status must be draft or published" };
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("pages")
      .insert({ slug, title, body_md, status });
    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: `A page with slug “${slug}” already exists` };
      }
      return { ok: false, error: error.message };
    }

    revalidatePath("/", "layout");
    return { ok: true, slug };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function updatePage(
  id: string,
  _prev: Result | null,
  fd: FormData,
): Promise<Result> {
  try {
    await assertAdmin();

    const slug = normaliseSlug(String(fd.get("slug") ?? ""));
    const title = String(fd.get("title") ?? "").trim();
    const body_md = String(fd.get("body_md") ?? "");
    const status = String(fd.get("status") ?? "draft");

    const slugError = validateSlug(slug);
    if (slugError) return { ok: false, error: slugError };
    if (!title) return { ok: false, error: "Title is required" };
    if (!["draft", "published"].includes(status)) {
      return { ok: false, error: "Status must be draft or published" };
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("pages")
      .update({ slug, title, body_md, status })
      .eq("id", id);
    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: `A page with slug “${slug}” already exists` };
      }
      return { ok: false, error: error.message };
    }

    revalidatePath("/", "layout");
    return { ok: true, slug };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function deletePage(id: string): Promise<{ error?: string }> {
  try {
    await assertAdmin();
    const supabase = createAdminClient();
    const { error } = await supabase.from("pages").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function setPageStatus(
  id: string,
  status: "published" | "draft",
): Promise<{ error?: string }> {
  try {
    await assertAdmin();
    const supabase = createAdminClient();
    const { error } = await supabase.from("pages").update({ status }).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}
