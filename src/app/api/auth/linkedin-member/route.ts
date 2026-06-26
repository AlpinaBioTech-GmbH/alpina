import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { isAdminRequest } from "@/lib/supabase/admin-auth";
import { authUrl, linkedinAccount } from "@/lib/linkedin/client";

export const dynamic = "force-dynamic";

// Personal-profile connection — uses the SECOND LinkedIn app (Sign In with
// OpenID Connect + Share on LinkedIn). The org page uses /api/auth/linkedin.
export async function GET(req: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const state = randomBytes(16).toString("hex");
  const response = NextResponse.redirect(authUrl(state, linkedinAccount("member")));
  response.cookies.set("li_member_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  void req;
  return response;
}
