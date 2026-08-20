// Deterministic digest assembly: which month, which articles. The AI only
// writes the intro (composer.ts); everything here is plain data.
import { fetchStoriesRaw } from "@/lib/storyblok-delivery";
import { content } from "@/lib/config";
import { siteUrl } from "@/lib/site";

export type DigestArticle = {
  title: string;
  teaser: string;
  date: string; // ISO date (content.date)
  tags: string[];
  heroUrl: string | null;
  heroAlt: string;
  url: string; // absolute
};

/** First day of a covered month, as 'YYYY-MM-01'. */
export type Period = string;

const BERLIN = "Europe/Berlin";

function berlinParts(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BERLIN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** Berlin-local day of month (guards the "first Tuesday" cron window). */
export function berlinDayOfMonth(now: Date = new Date()): number {
  return berlinParts(now).day;
}

/** The previous calendar month in Berlin time, as a Period ('YYYY-MM-01'). */
export function previousPeriod(now: Date = new Date()): Period {
  const { year, month } = berlinParts(now);
  const y = month === 1 ? year - 1 : year;
  const m = month === 1 ? 12 : month - 1;
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

export function periodSlug(period: Period): string {
  return period.slice(0, 7); // 'YYYY-MM'
}

export function periodLabel(period: Period): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function monthBounds(period: Period): { start: string; end: string } {
  const [y, m] = period.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { start: period, end: next };
}

type ArticleContent = {
  title?: string;
  teaser?: string;
  date?: string;
  tags?: string[];
  hero_image?: { filename?: string; alt?: string };
};

/**
 * Published articles whose content.date falls inside the covered month,
 * newest first. Filters in code (one code path for both bounds) rather than
 * Storyblok filter_query date operators.
 */
export async function fetchDigestArticles(period: Period): Promise<DigestArticle[]> {
  const { start, end } = monthBounds(period);
  const stories = await fetchStoriesRaw(content.articleSlugPrefix, {
    content_type: "article",
    sort_by: "content.date:desc",
  });
  return stories
    .map((s) => {
      const c = s.content as ArticleContent;
      const date = (c.date ?? "").slice(0, 10);
      return {
        title: c.title ?? s.name,
        teaser: c.teaser ?? "",
        date,
        tags: Array.isArray(c.tags) ? c.tags : [],
        heroUrl: c.hero_image?.filename || null,
        heroAlt: c.hero_image?.alt ?? "",
        url: `${siteUrl()}/${s.full_slug}`,
      };
    })
    .filter((a) => a.date >= start && a.date < end);
}
