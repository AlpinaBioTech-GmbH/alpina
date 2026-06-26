"use server";
// Shared admin Server Actions.
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
