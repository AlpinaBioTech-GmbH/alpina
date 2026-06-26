"use server";
// Sends a magic link, but only to emails on the admin allowlist. We always
// return the same neutral message so the form can't be used to enumerate who
// is an admin. shouldCreateUser is true so a first-time admin gets an auth user
// on first sign-in (the allowlist, not auth.users, decides who may request).
import { headers } from "next/headers";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isAllowedAdmin } from "@/lib/supabase/admin-auth";

const schema = z.object({
  email: z.string().email(),
  next: z.string().optional(),
});

export type LoginState = { ok: boolean; message: string };

const NEUTRAL: LoginState = {
  ok: true,
  message: "If that email is authorized, a sign-in link is on its way.",
};

export async function sendMagicLink(
  _prev: LoginState | null,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: "Enter a valid email address." };
  }
  const { email, next } = parsed.data;

  // Only allowlisted admins actually trigger an email.
  const allowed = await isAllowedAdmin(email);
  if (!allowed) return NEUTRAL;

  const hdrs = await headers();
  // 0.0.0.0 is the dev server's bind address, not a browsable host. If the
  // admin opened the "Network" URL, normalize it so the email link works.
  const origin = (
    hdrs.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://localhost:3000"
  ).replace("0.0.0.0", "localhost");
  const dest = next && next.startsWith("/admin") ? next : "/admin";
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(dest)}`;

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
  });

  if (error) {
    console.error("magic link send failed:", error.message);
    return { ok: false, message: "Could not send the link. Try again shortly." };
  }
  return NEUTRAL;
}
