"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { retryIssueSend } from "@/lib/newsletter/send";
import type { ActionResult } from "@/lib/admin/action-result";

export async function retryFailedIssue(issueId: string): Promise<ActionResult> {
  await requireAdmin();
  const result = await retryIssueSend(issueId, "manual");
  revalidatePath("/admin/newsletter");
  if (result.outcome === "sent") return { ok: true, message: "Issue sent." };
  return { ok: false, message: result.reason ?? `Retry ended as ${result.outcome}.` };
}
