"use server";
// src/app/admin/(dashboard)/assistant/actions.ts
// Admin actions for the AI assistant: config, document ingest, notes, Storyblok
// sync, and deletion. Every action re-checks the admin allowlist (Server
// Actions are not covered by the layout guard or the proxy).
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/service";
import { parseDocument } from "@/lib/rag/parse";
import { createDocument, ingestDocumentText } from "@/lib/rag/ingest";
import { syncStoryblok } from "@/lib/rag/storyblok-sync";

export type ActionState = { ok: boolean; message: string };

const ASSISTANT_PATH = "/admin/assistant";

function db() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase is not configured.");
  return client;
}

const configSchema = z.object({
  enabled: z.boolean(),
  model: z.enum(["claude-haiku-4-5", "claude-sonnet-4-6"]),
  system_prompt: z.string().min(1).max(8000),
  preset_questions: z.array(z.string().min(1).max(200)).max(5),
  excluded_slug_prefixes: z.array(z.string().min(1).max(200)).max(50),
});

function linesFrom(formData: FormData, field: string): string[] {
  return String(formData.get(field) ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function saveConfig(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = configSchema.safeParse({
    enabled: formData.get("enabled") === "on",
    model: formData.get("model"),
    system_prompt: String(formData.get("system_prompt") ?? "").trim(),
    preset_questions: linesFrom(formData, "preset_questions").slice(0, 5),
    excluded_slug_prefixes: linesFrom(formData, "excluded_slug_prefixes"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Check the fields and try again." };
  }

  const { error } = await db()
    .from("assistant_config")
    .update({
      enabled: parsed.data.enabled,
      model: parsed.data.model,
      system_prompt: parsed.data.system_prompt,
      preset_questions: parsed.data.preset_questions,
      excluded_slug_prefixes: parsed.data.excluded_slug_prefixes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "default");

  if (error) return { ok: false, message: error.message };
  revalidatePath(ASSISTANT_PATH);
  updateTag("assistant-config"); // refresh the public widget immediately
  return { ok: true, message: "Settings saved." };
}

export async function uploadDocuments(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const client = db();

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, message: "Choose at least one file." };

  let ok = 0;
  const failures: string[] = [];
  for (const file of files) {
    try {
      const { text } = await parseDocument(await file.arrayBuffer(), file.name);
      if (!text) throw new Error("No extractable text.");
      const docId = await createDocument(client, {
        source_type: "upload",
        title: file.name,
      });
      await ingestDocumentText(client, docId, text);
      ok += 1;
    } catch (e) {
      failures.push(`${file.name}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  revalidatePath(ASSISTANT_PATH);
  if (failures.length) {
    return {
      ok: ok > 0,
      message: `${ok} added. Problems: ${failures.join("; ")}`,
    };
  }
  return { ok: true, message: `${ok} document${ok === 1 ? "" : "s"} added.` };
}

const noteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(20000),
});

export async function addNote(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const client = db();

  const parsed = noteSchema.safeParse({
    title: String(formData.get("title") ?? "").trim(),
    content: String(formData.get("content") ?? "").trim(),
  });
  if (!parsed.success) return { ok: false, message: "Add a title and some content." };

  try {
    const docId = await createDocument(client, {
      source_type: "note",
      title: parsed.data.title,
    });
    await ingestDocumentText(client, docId, parsed.data.content);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Failed to save note." };
  }

  revalidatePath(ASSISTANT_PATH);
  return { ok: true, message: "Note added." };
}

export async function reindexStoryblok(
  _prev: ActionState | null,
  _formData?: FormData,
): Promise<ActionState> {
  await requireAdmin();
  try {
    const result = await syncStoryblok(db());
    const errs = result.errors.length ? ` (${result.errors.length} errors)` : "";
    revalidatePath(ASSISTANT_PATH);
    return {
      ok: true,
      message: `Synced ${result.documents} stories, ${result.chunks} chunks, skipped ${result.skipped}, pruned ${result.pruned}${errs}.`,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Sync failed." };
  }
}

export async function deleteDocument(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (id) {
    await db().from("kb_documents").delete().eq("id", id);
    revalidatePath(ASSISTANT_PATH);
  }
}
