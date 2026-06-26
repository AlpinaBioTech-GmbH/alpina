// Public, HMAC-signed slide renderer for Instagram ingestion. IG's servers
// fetch image_url when creating containers, so this route must be reachable
// without auth — the signature prevents arbitrary rendering. Output is JPEG
// (the only format the Content Publishing API accepts), converted with a
// pure-JS pipeline (no native deps; sharp failed to load on serverless).
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { serviceClient } from "@/lib/supabase/service";
import { pngToJpeg } from "@/lib/png-to-jpeg";
import { slideSignature } from "@/lib/instagram/client";
import { renderSlideImage, type SlideSpec } from "@/lib/instagram/slides";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function GET(req: NextRequest) {
  const postId = req.nextUrl.searchParams.get("post") ?? "";
  const indexRaw = req.nextUrl.searchParams.get("i") ?? "";
  const sig = req.nextUrl.searchParams.get("sig") ?? "";
  const index = Number(indexRaw);

  if (!postId || !Number.isInteger(index) || index < 0 || index > 9) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!safeEqual(sig, slideSignature(postId, index))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = serviceClient();
  if (!db) return NextResponse.json({ error: "not configured" }, { status: 500 });
  const { data: row } = await db
    .from("instagram_posts")
    .select("slides")
    .eq("id", postId)
    .maybeSingle();
  const slides = (row?.slides ?? []) as SlideSpec[];
  const slide = slides[index];
  if (!slide) return NextResponse.json({ error: "not found" }, { status: 404 });

  const png = await renderSlideImage(slide, index, slides.length);
  const jpeg = pngToJpeg(Buffer.from(await png.arrayBuffer()), 90);

  return new NextResponse(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
