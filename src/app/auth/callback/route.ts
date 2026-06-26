// Magic-link landing route. Supabase redirects here with a `code` (PKCE) after
// the user clicks the email link. We exchange it for a session (cookies are
// written by the server client), enforce the allowlist, then redirect to the
// intended admin page. Token-hash links (?token_hash&type) are also handled.
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isAllowedAdmin } from "@/lib/supabase/admin-auth";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const { searchParams } = url;
  // Never redirect to the non-browsable bind address.
  const origin = url.origin.replace("0.0.0.0", "localhost");
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/admin";

  const supabase = await getSupabaseServer();

  let exchangeError: string | null = null;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    exchangeError = error?.message ?? null;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    exchangeError = error?.message ?? null;
  } else {
    exchangeError = "Missing authentication code.";
  }

  if (exchangeError) {
    return NextResponse.redirect(`${origin}/admin/login?error=link_invalid`);
  }

  // Belt-and-suspenders: only allowlisted emails may land in /admin.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const allowed = await isAllowedAdmin(user?.email);
  if (!allowed) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/admin/login?error=not_allowed`);
  }

  const dest = next.startsWith("/admin") ? next : "/admin";
  return NextResponse.redirect(`${origin}${dest}`);
}
