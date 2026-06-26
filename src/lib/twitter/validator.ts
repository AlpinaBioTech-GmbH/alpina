// Tweet validation: deterministic checks first (short-circuit, no model call
// on hard failure), then a brief Claude brand review (fail open).
import { siteUrl } from "@/lib/site";
import { TWEET_MAX_CHARS, effectiveTweetLength } from "@/lib/social/format";
import { reviewPostBriefly } from "@/lib/social/review";

export interface ValidationResult {
  ok: boolean;
  reasons: string[];
}

export async function validateTweet(opts: {
  connected: boolean;
  fullText: string;
  url: string;
  hashtags: string[];
  recentTexts: string[];
  skipConnectionCheck?: boolean; // preview mode
}): Promise<ValidationResult> {
  const reasons: string[] = [];

  if (!opts.skipConnectionCheck && !opts.connected) {
    reasons.push("X not connected (token refresh failed or never connected)");
  }
  if (!opts.fullText.trim()) reasons.push("empty tweet");
  const effective = effectiveTweetLength(opts.fullText);
  if (effective > TWEET_MAX_CHARS) {
    reasons.push(`tweet too long (effective ${effective} > ${TWEET_MAX_CHARS})`);
  }
  try {
    const link = new URL(opts.url);
    const site = new URL(siteUrl());
    if (link.protocol !== "https:") reasons.push("link is not https");
    if (link.host !== site.host) reasons.push(`link host ${link.host} is not ${site.host}`);
  } catch {
    reasons.push(`invalid link URL: ${opts.url}`);
  }
  if (opts.hashtags.length > 3) reasons.push("more than 3 hashtags");
  if (reasons.length > 0) return { ok: false, reasons };

  const review = await reviewPostBriefly(opts.fullText, opts.recentTexts);
  if (!review.approved) return { ok: false, reasons: [`brand review: ${review.reason}`] };
  return { ok: true, reasons: [] };
}
