// Shared text post-processing for every social composer/validator.
import type { CatalogItem } from "@/lib/social/catalog";

export const BANNED_HASHTAGS = new Set([
  "#solopreneur",
  "#solobuilder",
  "#hustle",
  "#grindset",
  "#sidehustle",
  "#riseandgrind",
  "#entrepreneurlife",
  "#hustleculture",
]);

// Optional house hashtags the composer may draw on. Empty by default; populate
// for your brand if you want a consistent base set on longer-form posts.
export const BASE_HASHTAGS: string[] = [];

/** Plain hyphens only — never em/en dashes. */
export function normalizeDashes(text: string): string {
  return text.replace(/\s*—\s*/g, " - ").replace(/\s+–\s+/g, " - ");
}

export function cleanHashtags(tags: string[] | undefined, max: number): string[] {
  const out: string[] = [];
  for (const raw of tags ?? []) {
    const tag = ("#" + raw.replace(/^#+/, "")).replace(/\s+/g, "");
    if (tag.length < 2) continue;
    if (BANNED_HASHTAGS.has(tag.toLowerCase())) continue;
    if (out.some((t) => t.toLowerCase() === tag.toLowerCase())) continue;
    out.push(tag);
    if (out.length >= max) break;
  }
  return out;
}

export function renderCatalog(catalog: CatalogItem[], recentItemIds: string[]): string {
  return catalog
    .map((c) => {
      const recent = recentItemIds.includes(c.id) ? " (recently featured)" : "";
      const tags = c.tags.length ? ` (tags: ${c.tags.join(", ")})` : "";
      return `- id=${c.id} [${c.type}] "${c.title}" - ${c.summary}${tags}${recent}`;
    })
    .join("\n");
}

export const LINKEDIN_MAX_CHARS = 3000;
export const TWEET_MAX_CHARS = 280;
export const TCO_URL_LENGTH = 23; // every URL counts as 23 chars on X

export function assembleLinkedinText(commentary: string, url: string, hashtags: string[]): string {
  const parts = [commentary.trim(), url];
  if (hashtags.length) parts.push(hashtags.join(" "));
  return parts.join("\n\n");
}

/** Effective tweet length: every URL counts as 23 chars regardless of length. */
export function effectiveTweetLength(text: string): number {
  let length = 0;
  let rest = text;
  const urlRe = /https?:\/\/\S+/g;
  let m: RegExpExecArray | null;
  let consumed = 0;
  while ((m = urlRe.exec(text)) !== null) {
    length += m.index - consumed + TCO_URL_LENGTH;
    consumed = m.index + m[0].length;
  }
  rest = text.slice(consumed);
  return length + rest.length;
}

export function assembleTweetText(body: string, url: string, hashtags: string[]): string {
  const tags = hashtags.length ? " " + hashtags.join(" ") : "";
  // budget = 280 - (2 newline chars + 23 url chars + hashtag suffix)
  const budget = TWEET_MAX_CHARS - (2 + TCO_URL_LENGTH + tags.length);
  let trimmed = body.trim();
  if (trimmed.length > budget) {
    trimmed = trimmed.slice(0, Math.max(0, budget - 1)).replace(/\s+\S*$/, "") + "…";
  }
  return `${trimmed}\n\n${url}${tags}`;
}
