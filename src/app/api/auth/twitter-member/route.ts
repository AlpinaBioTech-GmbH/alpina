import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { isAdminRequest } from "@/lib/supabase/admin-auth";
import { authUrl, generatePkce, twitterAccount } from "@/lib/twitter/client";

export const dynamic = "force-dynamic";

// Personal-account connection — authorizes a second X account (the admin's own)
// through the same X app. The company account uses /api/auth/twitter.
export async function GET(req: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const state = randomBytes(16).toString("hex");
  const { verifier, challenge } = generatePkce();
  const response = NextResponse.redirect(authUrl(state, challenge, twitterAccount("member")));
  const cookieOpts = { httpOnly: true, secure: true, sameSite: "lax" as const, maxAge: 600, path: "/" };
  response.cookies.set("tw_member_oauth_state", state, cookieOpts);
  response.cookies.set("tw_member_oauth_verifier", verifier, cookieOpts);
  void req;
  return response;
}
