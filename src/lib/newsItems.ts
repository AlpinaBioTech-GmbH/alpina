// src/lib/newsItems.ts
// Maps Storyblok news_article stories into the serializable shape NewsList
// renders, and ranks related articles by shared tags. Server-only helpers.
import type { NewsArticleStory as NewsArticle } from "@/lib/storyblok";
import { resolveLink } from "@/lib/links";
import { tagLabel, orderedTags } from "@/lib/newsTags";
import { lqip } from "@/lib/storyblokImage";
import type { NewsListItem } from "@/components/site/NewsList";

export function formatNewsDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function articleHref(a: NewsArticle): { href: string; external: boolean } {
  const ext = a.content.external_url
    ? resolveLink(a.content.external_url)
    : { href: "", external: false };
  if (ext.href && ext.href !== "#") return ext;
  return { href: `/${a.full_slug}`, external: false };
}

export function toNewsListItem(a: NewsArticle): NewsListItem {
  const { href, external } = articleHref(a);
  return {
    id: a.uuid,
    href,
    external,
    title: a.content.title || "",
    date: formatNewsDate(a.content.date),
    excerpt: a.content.excerpt || undefined,
    image: a.content.image?.filename
      ? { src: a.content.image.filename, alt: a.content.image.alt || a.content.title || "" }
      : null,
    tags: orderedTags(a.content.tags).map(tagLabel),
  };
}

/** Like toNewsListItem, but also generates a blurred placeholder per image.
 *  Async + parallel; placeholder generation is cached. */
export async function toNewsListItems(articles: NewsArticle[]): Promise<NewsListItem[]> {
  return Promise.all(
    articles.map(async (a) => ({
      ...toNewsListItem(a),
      blurDataURL: a.content.image?.filename ? await lqip(a.content.image.filename) : undefined,
    })),
  );
}

/** Other articles ranked by shared-tag overlap (desc), then newest first. */
export function rankRelated(current: NewsArticle, pool: NewsArticle[]): NewsArticle[] {
  const cur = new Set(current.content.tags ?? []);
  return pool
    .filter((a) => a.uuid !== current.uuid)
    .map((a) => ({
      a,
      shared: (a.content.tags ?? []).filter((t) => cur.has(t)).length,
      date: a.content.date ?? "",
    }))
    .sort((x, y) => y.shared - x.shared || (y.date > x.date ? 1 : y.date < x.date ? -1 : 0))
    .map((r) => r.a);
}
