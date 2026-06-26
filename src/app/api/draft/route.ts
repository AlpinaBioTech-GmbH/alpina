// src/app/api/draft/route.ts
// Enables Next.js draft mode so the Visual Editor shows DRAFT content.
//   http://localhost:3000/api/draft?secret=YOUR_SECRET&slug=/
// Disable with: /api/draft?disable=1

import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dm = await draftMode();

  if (searchParams.get("disable")) {
    dm.disable();
    redirect("/");
  }

  if (searchParams.get("secret") !== process.env.STORYBLOK_DRAFT_SECRET) {
    return new Response("Invalid token", { status: 401 });
  }

  dm.enable();
  const slug = searchParams.get("slug") || "/";
  redirect(slug.startsWith("/") ? slug : `/${slug}`);
}
