import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/supabase/admin-auth";
import { exchangeCode, fetchMe, saveCredentials, twitterAccount } from "@/lib/twitter/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get("tw_member_oauth_state")?.value;
  const verifier = req.cookies.get("tw_member_oauth_verifier")?.value;
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/admin/twitter?error=${encodeURIComponent(reason)}`, req.url));

  if (!code) return fail(req.nextUrl.searchParams.get("error_description") ?? "missing code");
  if (!state || state !== expectedState) return fail("state mismatch");
  if (!verifier) return fail("missing PKCE verifier");

  try {
    const account = twitterAccount("member");
    const token = await exchangeCode(code, verifier, account);
    const me = await fetchMe(token.access_token);
    await saveCredentials(
      {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
        userId: me.id,
        scope: token.scope,
        displayName: me.name ? `${me.name} (@${me.username})` : me.username,
      },
      "twitter_member"
    );
    const response = NextResponse.redirect(
      new URL("/admin/twitter?connected=twitter-member", req.url)
    );
    response.cookies.delete("tw_member_oauth_state");
    response.cookies.delete("tw_member_oauth_verifier");
    return response;
  } catch (err) {
    console.error("[twitter-member] OAuth callback failed:", err);
    return fail(err instanceof Error ? err.message : "OAuth failed");
  }
}
