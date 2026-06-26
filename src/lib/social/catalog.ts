// The content catalog: the single source of groundable, linkable site material
// shared by all social providers. Built from Storyblok on every run, driven by
// content.config.ts so a rebrand never edits this file. A CMS hiccup degrades
// to a smaller catalog (articles-only, or empty) and never throws.
import { fetchStory, fetchStories } from "@/lib/storyblok";
import { siteUrl } from "@/lib/site";
import { content } from "@/lib/config";

export interface CatalogItem {
  type: "article" | "offering" | "feature" | "project" | "newsletter";
  id: string; // stable id (Storyblok story uuid or derived)
  slug: string | null;
  title: string;
  summary: string; // 1-3 sentences the composer can ground in
  url: string; // absolute https URL on the site — the link the post carries
  tags: string[];
}

async function safe<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}

interface StorySummary {
  uuid: string;
  name: string;
  slug: string;
  full_slug: string;
  content?: Record<string, unknown>;
}

/** Pull a usable 1-3 sentence summary out of an arbitrary story's content. */
function genericSummary(c: Record<string, unknown>): string {
  const candidates = [
    c.excerpt,
    c.subtitle,
    c.seo_description,
    c.description,
    c.tagline,
    c.summary,
    c.intro,
  ];
  for (const v of candidates) {
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  // Fall back to a hero/first-section subheadline if present.
  const body = c.body;
  if (Array.isArray(body)) {
    for (const blok of body as Array<Record<string, unknown>>) {
      const sub = blok.subheadline ?? blok.subtitle ?? blok.intro;
      if (typeof sub === "string" && sub.trim().length > 0) return sub.trim();
    }
  }
  return "";
}

/** Articles published under content.articleSlugPrefix. */
async function fetchArticleItems(): Promise<CatalogItem[]> {
  const site = siteUrl();
  const prefix = content.articleSlugPrefix; // e.g. "articles/"
  const stories = (await fetchStories(prefix, { per_page: 25 })) as StorySummary[];
  return stories
    .map((story) => {
      const c = story.content ?? {};
      return {
        type: "article" as const,
        id: story.uuid,
        slug: story.full_slug,
        title: String(c.title || story.name),
        summary: genericSummary(c),
        url: `${site}/${story.full_slug}`,
        tags: Array.isArray(c.tags) ? (c.tags as string[]).slice(0, 6) : [],
      };
    })
    .filter((item) => item.summary.length > 0);
}

/** Optional marketing/landing pages featured by full-slug (content.catalog.pageSlugs). */
async function fetchPageItems(): Promise<CatalogItem[]> {
  const slugs = content.catalog.pageSlugs;
  if (!slugs.length) return [];
  const site = siteUrl();
  const stories = await Promise.all(
    slugs.map((s) => fetchStory(s).catch(() => null) as Promise<StorySummary | null>),
  );
  return stories
    .filter((s): s is StorySummary => Boolean(s))
    .map((story) => {
      const c = story.content ?? {};
      return {
        type: "feature" as const,
        id: story.uuid,
        slug: story.full_slug,
        title: String(c.title || story.name),
        summary: genericSummary(c),
        url: `${site}/${story.full_slug}`,
        tags: Array.isArray(c.tags) ? (c.tags as string[]).slice(0, 6) : [],
      };
    })
    .filter((item) => item.summary.length > 0);
}

/** Optional newsletter issues, when content.catalog.includeNewsletter is on.
 *  Reads from the "newsletter/" folder; degrades silently if it does not exist. */
async function fetchNewsletterItems(): Promise<CatalogItem[]> {
  const site = siteUrl();
  const stories = (await fetchStories("newsletter/", { per_page: 4 })) as StorySummary[];
  return stories
    .map((story) => {
      const c = story.content ?? {};
      return {
        type: "newsletter" as const,
        id: story.uuid,
        slug: story.full_slug,
        title: String(c.title || story.name),
        summary: genericSummary(c),
        url: `${site}/${story.full_slug}`,
        tags: ["newsletter"],
      };
    })
    .filter((item) => item.summary.length > 0);
}

export async function buildCatalog(): Promise<CatalogItem[]> {
  const tasks: Array<Promise<CatalogItem[]>> = [];
  if (content.catalog.includeArticles) tasks.push(safe(fetchArticleItems));
  if (content.catalog.pageSlugs.length) tasks.push(safe(fetchPageItems));
  if (content.catalog.includeNewsletter) tasks.push(safe(fetchNewsletterItems));

  const groups = await Promise.all(tasks);

  // Dedupe by URL (path-normalized); first writer wins.
  const seen = new Set<string>();
  const catalog: CatalogItem[] = [];
  for (const item of groups.flat()) {
    const key = item.url.replace(/\/+$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    catalog.push(item);
  }
  return catalog;
}

/** Single-item helper for announce-on-publish. */
export function articleCatalogItem(a: {
  slug: string;
  title: string;
  excerpt: string;
  tags?: string[];
}): CatalogItem {
  const prefix = content.articleSlugPrefix; // "articles/"
  const bare = a.slug.replace(new RegExp(`^${prefix}`), "");
  const fullSlug = `${prefix}${bare}`;
  return {
    type: "article",
    id: fullSlug,
    slug: fullSlug,
    title: a.title,
    summary: a.excerpt,
    url: `${siteUrl()}/${fullSlug}`,
    tags: a.tags ?? [],
  };
}

/** OG-image URL for a catalog item (rendered by /api/og?slug=). */
export function imageUrlFor(item: CatalogItem): string {
  const slug = item.slug ?? "home";
  return `${siteUrl()}/api/og?slug=${encodeURIComponent(slug)}`;
}

/** Drop items already tried this run, but never starve the composer. */
export function excludeItems(
  catalog: CatalogItem[],
  excludeIds: Set<string>,
  minKeep = 1,
): CatalogItem[] {
  const kept = catalog.filter((c) => !excludeIds.has(c.id));
  return kept.length >= minKeep ? kept : catalog;
}
