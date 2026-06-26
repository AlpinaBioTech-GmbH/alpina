import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/supabase/admin-auth";
import { exchangeCode, discoverAuthor, saveCredentials } from "@/lib/linkedin/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get("li_oauth_state")?.value;
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/admin/linkedin?error=${encodeURIComponent(reason)}`, req.url));

  if (!code) return fail(req.nextUrl.searchParams.get("error_description") ?? "missing code");
  if (!state || state !== expectedState) return fail("state mismatch");

  try {
    const token = await exchangeCode(code);
    const author = await discoverAuthor(token.access_token);
    await saveCredentials({
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      authorUrn: author.authorUrn,
      scope: token.scope,
      displayName: author.displayName,
    });
    const response = NextResponse.redirect(new URL("/admin/linkedin?connected=linkedin", req.url));
    response.cookies.delete("li_oauth_state");
    return response;
  } catch (err) {
    console.error("[linkedin] OAuth callback failed:", err);
    return fail(err instanceof Error ? err.message : "OAuth failed");
  }
}
