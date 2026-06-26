"use server";
// src/app/admin/(dashboard)/conversations/actions.ts
// Archive (soft delete) and hard delete for logged conversations. Each action
// re-checks the admin allowlist.
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/service";

const PATH = "/admin/conversations";

function db() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase is not configured.");
  return client;
}

export async function archiveConversation(id: string) {
  await requireAdmin();
  await db()
    .from("assistant_conversations")
    .update({ archived: true, archived_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath(PATH);
}

export async function unarchiveConversation(id: string) {
  await requireAdmin();
  await db()
    .from("assistant_conversations")
    .update({ archived: false, archived_at: null })
    .eq("id", id);
  revalidatePath(PATH);
}

export async function deleteConversation(id: string) {
  await requireAdmin();
  await db().from("assistant_conversations").delete().eq("id", id);
  revalidatePath(PATH);
}
