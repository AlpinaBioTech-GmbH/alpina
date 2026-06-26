import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { isAdminRequest } from "@/lib/supabase/admin-auth";
import { authUrl, generatePkce } from "@/lib/twitter/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const state = randomBytes(16).toString("hex");
  const { verifier, challenge } = generatePkce();
  const response = NextResponse.redirect(authUrl(state, challenge));
  const cookieOpts = { httpOnly: true, secure: true, sameSite: "lax" as const, maxAge: 600, path: "/" };
  response.cookies.set("tw_oauth_state", state, cookieOpts);
  response.cookies.set("tw_oauth_verifier", verifier, cookieOpts);
  void req;
  return response;
}
