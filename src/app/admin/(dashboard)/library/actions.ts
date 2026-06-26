"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { serviceClient } from "@/lib/supabase/service";
import {
  registerDocument,
  analyzeDocument,
  DOCUMENTS_BUCKET,
} from "@/lib/documents";
import type { ActionResult } from "@/lib/admin/action-result";

function errorResult(err: unknown): ActionResult {
  return { ok: false, message: err instanceof Error ? err.message : String(err) };
}

export async function createDocumentUploadUrl(
  filename: string
): Promise<{ ok: boolean; path?: string; token?: string; message?: string }> {
  await requireAdmin();
  try {
    const db = serviceClient();
    if (!db) return { ok: false, message: "Supabase not configured" };
    const path = `upload/${Date.now()}-${filename.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(0, 80)}`;
    const { data, error } = await db.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) return { ok: false, message: error?.message ?? "signed URL failed" };
    return { ok: true, path: data.path, token: data.token };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

export async function finalizeUploadedDocument(fields: {
  path: string;
  title: string;
  byteSize: number;
}): Promise<ActionResult> {
  await requireAdmin();
  try {
    const { id } = await registerDocument({
      path: fields.path,
      title: fields.title,
      byteSize: fields.byteSize,
    });
    const { topics } = await analyzeDocument(id);
    revalidatePath("/admin/library");
    return { ok: true, message: `Document added and analyzed: ${topics} opinion angle(s) queued` };
  } catch (err) {
    return errorResult(err);
  }
}

export async function addDocumentFromUrl(fields: {
  url: string;
  title?: string;
}): Promise<ActionResult> {
  await requireAdmin();
  try {
    const url = fields.url.trim();
    try {
      if (new URL(url).protocol !== "https:") throw new Error();
    } catch {
      return { ok: false, message: "Provide a valid https PDF URL" };
    }
    const fallbackTitle = decodeURIComponent(url.split("/").pop() ?? "document")
      .replace(/\.pdf$/i, "")
      .replace(/[_-]+/g, " ");
    const { id } = await registerDocument({
      sourceUrl: url,
      title: fields.title?.trim() || fallbackTitle,
    });
    const { topics } = await analyzeDocument(id);
    revalidatePath("/admin/library");
    return { ok: true, message: `Document fetched and analyzed: ${topics} opinion angle(s) queued` };
  } catch (err) {
    return errorResult(err);
  }
}

export async function reanalyzeDocument(id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    const { topics } = await analyzeDocument(id);
    revalidatePath("/admin/library");
    return { ok: true, message: `Re-analyzed: ${topics} pending angle(s)` };
  } catch (err) {
    return errorResult(err);
  }
}

export async function archiveDocument(id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    const db = serviceClient();
    if (!db) return { ok: false, message: "Supabase not configured" };
    const { error } = await db
      .from("reference_documents")
      .update({ status: "archived" })
      .eq("id", id);
    if (error) return { ok: false, message: error.message };
    // Archive also clears its pending queue so the cron stops writing from it.
    await db.from("opinion_topics").update({ status: "dismissed" }).eq("document_id", id).eq("status", "pending");
    revalidatePath("/admin/library");
    return { ok: true, message: "Document archived; pending angles dismissed" };
  } catch (err) {
    return errorResult(err);
  }
}

export async function dismissTopic(id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    const db = serviceClient();
    if (!db) return { ok: false, message: "Supabase not configured" };
    const { error } = await db
      .from("opinion_topics")
      .update({ status: "dismissed" })
      .eq("id", id)
      .eq("status", "pending");
    if (error) return { ok: false, message: error.message };
    revalidatePath("/admin/library");
    return { ok: true, message: "Angle dismissed" };
  } catch (err) {
    return errorResult(err);
  }
}
