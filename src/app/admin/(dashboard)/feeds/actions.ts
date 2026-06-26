"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { serviceClient } from "@/lib/supabase/service";
import type { ActionResult } from "@/lib/admin/action-result";

function errorResult(err: unknown): ActionResult {
  return { ok: false, message: err instanceof Error ? err.message : String(err) };
}

export async function addFeed(fields: {
  url: string;
  label: string;
  category: string;
}): Promise<ActionResult> {
  await requireAdmin();
  try {
    const db = serviceClient();
    if (!db) return { ok: false, message: "Supabase not configured" };
    const url = fields.url.trim();
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error();
    } catch {
      return { ok: false, message: "Invalid feed URL" };
    }
    const { error } = await db.from("rss_feeds").insert({
      url,
      label: fields.label.trim() || new URL(url).hostname.replace(/^www\./, ""),
      category: fields.category.trim() || "general",
    });
    if (error) return { ok: false, message: error.message };
    revalidatePath("/admin/feeds");
    return { ok: true, message: "Feed added" };
  } catch (err) {
    return errorResult(err);
  }
}

export async function setFeedEnabled(id: string, enabled: boolean): Promise<ActionResult> {
  await requireAdmin();
  try {
    const db = serviceClient();
    if (!db) return { ok: false, message: "Supabase not configured" };
    const { error } = await db.from("rss_feeds").update({ enabled }).eq("id", id);
    if (error) return { ok: false, message: error.message };
    revalidatePath("/admin/feeds");
    return { ok: true, message: enabled ? "Feed enabled" : "Feed disabled" };
  } catch (err) {
    return errorResult(err);
  }
}

export async function deleteFeed(id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    const db = serviceClient();
    if (!db) return { ok: false, message: "Supabase not configured" };
    const { error } = await db.from("rss_feeds").delete().eq("id", id);
    if (error) return { ok: false, message: error.message };
    revalidatePath("/admin/feeds");
    return { ok: true, message: "Feed deleted" };
  } catch (err) {
    return errorResult(err);
  }
}
