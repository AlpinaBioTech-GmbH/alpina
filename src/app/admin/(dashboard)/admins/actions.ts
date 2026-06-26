"use server";
// src/app/admin/(dashboard)/admins/actions.ts
// Manage the admin allowlist (admin_users). Each action re-checks the caller is
// an admin. You cannot remove your own account, to avoid locking everyone out.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/service";

const PATH = "/admin/admins";

function db() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase is not configured.");
  return client;
}

export type ActionState = { ok: boolean; message: string };

const addSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().max(120).optional(),
  role: z.enum(["admin", "owner"]),
});

export async function addAdmin(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = addSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    name: String(formData.get("name") ?? "").trim() || undefined,
    role: formData.get("role") || "admin",
  });
  if (!parsed.success) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const { error } = await db()
    .from("admin_users")
    .upsert(
      {
        email: parsed.data.email,
        name: parsed.data.name ?? null,
        role: parsed.data.role,
      },
      { onConflict: "email" },
    );
  if (error) return { ok: false, message: error.message };

  revalidatePath(PATH);
  return { ok: true, message: `${parsed.data.email} added.` };
}

export async function removeAdmin(formData: FormData): Promise<void> {
  const { admin } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Never let an admin delete their own row (lockout guard).
  const { data } = await db()
    .from("admin_users")
    .select("email")
    .eq("id", id)
    .maybeSingle();
  const targetEmail = (data as { email: string } | null)?.email;
  if (!targetEmail || targetEmail.toLowerCase() === admin.email.toLowerCase()) {
    return;
  }

  await db().from("admin_users").delete().eq("id", id);
  revalidatePath(PATH);
}
