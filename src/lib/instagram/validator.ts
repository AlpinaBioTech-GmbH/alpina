// Instagram carousel validation: deterministic checks first (short-circuit,
// no model call on hard failure), then the shared brief Claude review (fail
// open). Slide image rendering is exercised by the publish step (IG fetches
// the signed route), not validated in-process.
import { siteUrl } from "@/lib/site";
import { reviewPostBriefly } from "@/lib/social/review";
import type { SlideSpec } from "@/lib/instagram/slides";

const CAPTION_MAX = 2200;
const SLIDE_TITLE_MAX = 90;
const SLIDE_BODY_MAX = 220;
const SLIDE_KICKER_MAX = 40;

export interface ValidationResult {
  ok: boolean;
  reasons: string[];
}

export async function validateCarousel(opts: {
  connected: boolean;
  fullCaption: string; // caption + hashtags as posted
  slides: SlideSpec[];
  hashtags: string[];
  groundingUrl: string;
  recentTexts: string[];
  skipConnectionCheck?: boolean;
}): Promise<ValidationResult> {
  const reasons: string[] = [];

  if (!opts.skipConnectionCheck && !opts.connected) {
    reasons.push("Instagram not connected (or token expired)");
  }
  if (!opts.fullCaption.trim()) reasons.push("empty caption");
  if (opts.fullCaption.length > CAPTION_MAX) {
    reasons.push(`caption too long (${opts.fullCaption.length} > ${CAPTION_MAX})`);
  }
  if (/https?:\/\//i.test(opts.fullCaption)) {
    reasons.push("caption contains a URL (IG links are dead text — use 'link in bio')");
  }
  if (opts.slides.length < 3 || opts.slides.length > 10) {
    reasons.push(`needs 3-10 slides, got ${opts.slides.length}`);
  }
  opts.slides.forEach((slide, i) => {
    if (!slide.title?.trim()) reasons.push(`slide ${i + 1}: empty title`);
    if ((slide.title ?? "").length > SLIDE_TITLE_MAX)
      reasons.push(`slide ${i + 1}: title over ${SLIDE_TITLE_MAX} chars`);
    if ((slide.body ?? "").length > SLIDE_BODY_MAX)
      reasons.push(`slide ${i + 1}: body over ${SLIDE_BODY_MAX} chars`);
    if ((slide.kicker ?? "").length > SLIDE_KICKER_MAX)
      reasons.push(`slide ${i + 1}: kicker over ${SLIDE_KICKER_MAX} chars`);
    if (/https?:\/\//i.test(`${slide.kicker ?? ""} ${slide.title} ${slide.body ?? ""}`))
      reasons.push(`slide ${i + 1}: contains a URL`);
  });
  if (opts.hashtags.length > 8) reasons.push("more than 8 hashtags");
  try {
    const link = new URL(opts.groundingUrl);
    const site = new URL(siteUrl());
    if (link.host !== site.host) reasons.push(`grounding URL host ${link.host} is not ${site.host}`);
  } catch {
    reasons.push(`invalid grounding URL: ${opts.groundingUrl}`);
  }
  if (reasons.length > 0) return { ok: false, reasons };

  const slidesText = opts.slides
    .map((s, i) => `[slide ${i + 1}] ${s.kicker ? `${s.kicker} | ` : ""}${s.title}${s.body ? ` - ${s.body}` : ""}`)
    .join("\n");
  const review = await reviewPostBriefly(
    `CAROUSEL SLIDES:\n${slidesText}\n\nCAPTION:\n${opts.fullCaption}`,
    opts.recentTexts,
  );
  if (!review.approved) return { ok: false, reasons: [`brand review: ${review.reason}`] };
  return { ok: true, reasons: [] };
}
