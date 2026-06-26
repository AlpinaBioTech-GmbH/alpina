import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/supabase/admin-auth";
import { exchangeCode, fetchMe, saveCredentials } from "@/lib/instagram/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get("ig_oauth_state")?.value;
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/admin/instagram?error=${encodeURIComponent(reason)}`, req.url));

  if (!code) return fail(req.nextUrl.searchParams.get("error_description") ?? "missing code");
  if (!state || state !== expectedState) return fail("state mismatch");

  try {
    const token = await exchangeCode(code);
    const me = await fetchMe(token.accessToken);
    await saveCredentials({
      accessToken: token.accessToken,
      expiresAt: token.expiresAt,
      userId: token.userId,
      displayName: me.username ? `@${me.username}` : null,
    });
    const response = NextResponse.redirect(new URL("/admin/instagram?connected=instagram", req.url));
    response.cookies.delete("ig_oauth_state");
    return response;
  } catch (err) {
    console.error("[instagram] OAuth callback failed:", err);
    return fail(err instanceof Error ? err.message : "OAuth failed");
  }
}
