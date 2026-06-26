// Storyblok publish webhook -> bust the Next Data Cache for all published
// Storyblok reads (tagged STORYBLOK_TAG), so a publish shows up immediately
// while normal traffic still hits the cache.
//
// Configure in Storyblok: Settings -> Webhooks -> "Story published" (and
// unpublished/deleted) -> URL https://<site>/api/revalidate
// Set a webhook secret there and as STORYBLOK_WEBHOOK_SECRET (Storyblok signs
// the body with HMAC-SHA1 in the `webhook-signature` header). For quick manual
// tests you can also call /api/revalidate?secret=<secret>.
import crypto from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { STORYBLOK_TAG } from "@/lib/storyblok-tag";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

async function authorized(req: NextRequest, body: string): Promise<boolean> {
  const secret =
    process.env.STORYBLOK_WEBHOOK_SECRET || process.env.STORYBLOK_DRAFT_SECRET;
  if (!secret) {
    console.warn("[revalidate] no STORYBLOK_WEBHOOK_SECRET set; accepting request");
    return true;
  }
  // Preferred: Storyblok HMAC-SHA1 signature of the raw body.
  const sig = req.headers.get("webhook-signature");
  if (sig) {
    const expected = crypto.createHmac("sha1", secret).update(body).digest("hex");
    return safeEqual(sig, expected);
  }
  // Fallback: ?secret= query (manual testing / simple setups).
  const q = new URL(req.url).searchParams.get("secret");
  return Boolean(q && safeEqual(q, secret));
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  if (!(await authorized(req, body))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  // expire: 0 -> the next request is a fresh cache miss (published edit shows
  // immediately), rather than the stale-while-revalidate "max" profile.
  revalidateTag(STORYBLOK_TAG, { expire: 0 });
  return NextResponse.json({ ok: true, revalidated: STORYBLOK_TAG });
}

// GET for manual testing: /api/revalidate?secret=...
export async function GET(req: NextRequest) {
  return POST(req);
}
