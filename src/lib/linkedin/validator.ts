// LinkedIn post validation: deterministic checks first (short-circuit, no
// model call on hard failure), then a brief Claude brand review (fail open).
import { siteUrl } from "@/lib/site";
import { LINKEDIN_MAX_CHARS } from "@/lib/social/format";
import { reviewPostBriefly } from "@/lib/social/review";
import type { LinkedinConnection } from "@/lib/linkedin/client";

export interface ValidationResult {
  ok: boolean;
  reasons: string[];
}

export async function validateLinkedinPost(opts: {
  connection: Pick<LinkedinConnection, "accessToken" | "expired"> | null;
  fullText: string;
  url: string;
  hashtags: string[];
  imageBytes: Uint8Array | null;
  recentTexts: string[];
  skipConnectionCheck?: boolean; // preview mode
}): Promise<ValidationResult> {
  const reasons: string[] = [];

  if (!opts.skipConnectionCheck) {
    if (!opts.connection?.accessToken) reasons.push("LinkedIn not connected");
    else if (opts.connection.expired) reasons.push("LinkedIn token expired");
  }
  if (!opts.fullText.trim()) reasons.push("empty post body");
  if (opts.fullText.length > LINKEDIN_MAX_CHARS) {
    reasons.push(`post too long (${opts.fullText.length} > ${LINKEDIN_MAX_CHARS})`);
  }
  try {
    const link = new URL(opts.url);
    const site = new URL(siteUrl());
    if (link.protocol !== "https:") reasons.push("link is not https");
    if (link.host !== site.host) reasons.push(`link host ${link.host} is not ${site.host}`);
  } catch {
    reasons.push(`invalid link URL: ${opts.url}`);
  }
  if (opts.hashtags.length < 1) reasons.push("needs at least 1 hashtag");
  if (!opts.imageBytes || opts.imageBytes.byteLength < 1024) {
    reasons.push("OG image missing or under 1 KB");
  }
  if (reasons.length > 0) return { ok: false, reasons };

  const review = await reviewPostBriefly(opts.fullText, opts.recentTexts);
  if (!review.approved) return { ok: false, reasons: [`brand review: ${review.reason}`] };
  return { ok: true, reasons: [] };
}
