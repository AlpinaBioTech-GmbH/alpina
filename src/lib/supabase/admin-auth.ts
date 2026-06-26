// Authorization helpers for the /admin area. Authentication (is there a valid
// session) is handled by Supabase + proxy.ts; authorization (is this user on
// the allowlist) is enforced here, server-side, via the service role. Per the
// Next.js 16 proxy docs we never rely on the proxy alone for authz.
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/service";
import { publicApiKey } from "@/lib/supabase/keys";

export type AdminRecord = {
  id: string;
  email: string;
  role: string;
  name: string | null;
};

/** Emails from the ADMIN_EMAILS env var (bootstrap allowlist for first deploy). */
function bootstrapEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Returns the admin record if the email is allowed. Allowed = present in the
 * admin_users table OR in ADMIN_EMAILS (so a fresh deploy isn't locked out
 * before the table is seeded). Uses the service role.
 */
export async function isAllowedAdmin(
  email: string | null | undefined,
): Promise<AdminRecord | null> {
  if (!email) return null;
  const admin = getSupabaseAdmin();
  if (admin) {
    const { data, error } = await admin
      .from("admin_users")
      .select("id, email, role, name")
      .ilike("email", email)
      .maybeSingle();
    if (error) {
      console.error("admin allowlist lookup failed:", error.message);
    } else if (data) {
      return data as AdminRecord;
    }
  }
  // Bootstrap fallback: ADMIN_EMAILS env allowlist.
  if (bootstrapEmails().includes(email.toLowerCase())) {
    return { id: "bootstrap", email, role: "owner", name: null };
  }
  return null;
}

/**
 * Guard for /admin server components and actions. Returns the authenticated,
 * allowlisted user. Redirects to the login page otherwise. A logged-in user
 * who is NOT on the allowlist is signed out, so a stale session can't linger.
 */
export async function requireAdmin(): Promise<{
  user: User;
  admin: AdminRecord;
}> {
  const hasEnv = process.env.NEXT_PUBLIC_SUPABASE_URL && publicApiKey();
  if (!hasEnv) redirect("/admin/login?error=not_configured");

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const admin = await isAllowedAdmin(user.email);
  if (!admin) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=not_allowed");
  }

  return { user, admin };
}

/** API-route / cron guard variant: returns false instead of redirecting. */
export async function isAdminRequest(): Promise<boolean> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  return Boolean(await isAllowedAdmin(user.email));
}
