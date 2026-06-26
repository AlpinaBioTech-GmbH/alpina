// Server-side Storyblok init: registers the neutral component map and exposes
// typed fetch helpers. Imported by Server Components only.
//
// Uses the PREVIEW token (reads draft + published) and is draftMode-aware:
// the Visual Editor / /api/draft route serves draft, production serves
// published. Multi-story helpers (fetchStories) ground the social catalog and
// article pipeline.

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { storyblokInit, apiPlugin } from "@storyblok/react/rsc";
import { draftMode } from "next/headers";
import { STORYBLOK_TAG } from "@/lib/storyblok-tag";

export { STORYBLOK_TAG };

// --- Neutral blok components ----------------------------------------------
// Anything not in this map falls back to <Placeholder/>, so the page always
// renders. Add your own bloks here.
import Page from "@/components/storyblok/Page";
import Hero from "@/components/storyblok/Hero";
import RichText from "@/components/storyblok/RichText";
import StatGrid from "@/components/storyblok/StatGrid";
import Stat from "@/components/storyblok/Stat";
import TeamGrid from "@/components/storyblok/TeamGrid";
import TeamMember from "@/components/storyblok/TeamMember";
import CtaBand from "@/components/storyblok/CtaBand";
import NewsTeaser from "@/components/storyblok/NewsTeaser";
import NewsArticle from "@/components/storyblok/NewsArticle";
import Article from "@/components/storyblok/Article";
import ArticleTeaser from "@/components/storyblok/ArticleTeaser";
import ContactForm from "@/components/storyblok/ContactForm";
import Product from "@/components/storyblok/Product";
import Category from "@/components/storyblok/Category";
import ProductGrid from "@/components/storyblok/ProductGrid";
import Placeholder from "@/components/storyblok/Placeholder";

const components = {
  // pages + sections
  page: Page,
  hero: Hero,
  rich_text: RichText,
  stat_grid: StatGrid,
  stat: Stat,
  team_grid: TeamGrid,
  team_member: TeamMember,
  cta_band: CtaBand,
  news_teaser: NewsTeaser,
  contact_form: ContactForm,
  product_grid: ProductGrid,
  article_teaser: ArticleTeaser,
  // content types
  news_article: NewsArticle,
  article: Article,
  product: Product,
  category: Category,
  // global (rendered by chrome, not as bloks)
  nav_item: Placeholder,
  global_config: Placeholder,
};

export const getStoryblokApi = storyblokInit({
  accessToken: process.env.STORYBLOK_PREVIEW_TOKEN, // preview token reads draft + published
  use: [apiPlugin],
  components,
  apiOptions: {
    region: process.env.NEXT_PUBLIC_STORYBLOK_REGION || "eu",
  },
});

/** True when the Visual Editor / draft mode is on. */
async function draftEnabled(): Promise<boolean> {
  try {
    return (await draftMode()).isEnabled;
  } catch {
    // draftMode() is unavailable outside a request scope (e.g. scripts).
    return false;
  }
}

// Cache published reads only in production (busted by the publish webhook). In
// dev, always fetch fresh so local content edits show immediately - the webhook
// can't reach localhost.
const CACHE_PUBLISHED = process.env.NODE_ENV === "production";

// Raw delivery fetch. cv: Date.now() keeps the call itself fresh - it only runs
// on a Data Cache miss for published reads, or every time for draft.
async function rawStory(slug: string, version: "draft" | "published") {
  const { data } = await getStoryblokApi().get(`cdn/stories/${slug}`, {
    version,
    resolve_links: "url",
    cv: Date.now(),
  });
  return data?.story ?? null;
}

// Published reads go through the Next Data Cache, tagged so a publish webhook
// busts them instantly; the 1h revalidate is a backstop for missed webhooks.
const cachedStory = unstable_cache(
  (slug: string) => rawStory(slug, "published"),
  ["sb-story"],
  { tags: [STORYBLOK_TAG], revalidate: 3600 },
);

/** Fetch a single story by slug. Draft is always fresh; published is cached and
 *  tag-revalidated. Memoized per-request (React cache) so the page and
 *  generateMetadata don't double-fetch. */
export const fetchStory = cache(async (slug: string) => {
  try {
    if (await draftEnabled()) return await rawStory(slug, "draft");
    return CACHE_PUBLISHED
      ? await cachedStory(slug)
      : await rawStory(slug, "published");
  } catch (e) {
    console.error("SB fetch failed:", slug, e);
    return null;
  }
});

async function rawStories(
  startsWith: string,
  options: Record<string, unknown>,
  version: "draft" | "published",
) {
  const { data } = await getStoryblokApi().get("cdn/stories", {
    version,
    starts_with: startsWith,
    resolve_links: "url",
    cv: Date.now(),
    ...options,
  });
  return data?.stories ?? [];
}

const cachedStories = unstable_cache(
  (startsWith: string, options: Record<string, unknown>) =>
    rawStories(startsWith, options, "published"),
  ["sb-stories"],
  { tags: [STORYBLOK_TAG], revalidate: 3600 },
);

/** Fetch a list of stories under a folder prefix (catalog, article pipeline). */
export async function fetchStories(
  startsWith: string,
  options: Record<string, unknown> = {},
) {
  try {
    if (await draftEnabled()) return await rawStories(startsWith, options, "draft");
    return CACHE_PUBLISHED
      ? await cachedStories(startsWith, options)
      : await rawStories(startsWith, options, "published");
  } catch (e) {
    console.error("SB stories fetch failed:", startsWith, e);
    return [];
  }
}

/** Fetch the global config story (nav, footer, secondary link, logo). */
export async function fetchGlobalConfig() {
  try {
    return await fetchStory("global");
  } catch {
    return null;
  }
}

export type NewsArticleStory = {
  uuid: string;
  full_slug: string;
  content: {
    title?: string;
    date?: string;
    excerpt?: string;
    external_url?: { url?: string; cached_url?: string; linktype?: string };
    image?: { filename?: string | null; alt?: string | null };
    tags?: string[];
  };
};

async function rawNews(
  limit: number,
  version: "draft" | "published",
): Promise<NewsArticleStory[]> {
  const { data } = await getStoryblokApi().get("cdn/stories", {
    version,
    content_type: "news_article",
    sort_by: "content.date:desc",
    per_page: limit,
    resolve_links: "url",
    cv: Date.now(),
  });
  return (data?.stories ?? []) as NewsArticleStory[];
}

const cachedNews = unstable_cache(
  (limit: number) => rawNews(limit, "published"),
  ["sb-news"],
  { tags: [STORYBLOK_TAG], revalidate: 3600 },
);

/** Latest N news_article stories, newest first (Home teaser / News index). */
export async function fetchNewsArticles(limit = 3): Promise<NewsArticleStory[]> {
  try {
    if (await draftEnabled()) return await rawNews(limit, "draft");
    return CACHE_PUBLISHED ? await cachedNews(limit) : await rawNews(limit, "published");
  } catch (e) {
    console.error("SB news fetch failed:", e);
    return [];
  }
}

export type ArticleStory = {
  uuid: string;
  full_slug: string;
  content: {
    title?: string;
    teaser?: string;
    date?: string;
    tags?: string[];
    hero_image?: { filename?: string | null; alt?: string | null };
  };
};

async function rawArticles(limit: number, version: "draft" | "published"): Promise<ArticleStory[]> {
  const { data } = await getStoryblokApi().get("cdn/stories", {
    version,
    content_type: "article",
    sort_by: "content.date:desc",
    per_page: limit,
    cv: Date.now(),
  });
  return (data?.stories ?? []) as ArticleStory[];
}

const cachedArticles = unstable_cache(
  (limit: number) => rawArticles(limit, "published"),
  ["sb-articles"],
  { tags: [STORYBLOK_TAG], revalidate: 3600 },
);

/** Latest N `article` stories, newest first (Articles index + related). */
export async function fetchArticles(limit = 20): Promise<ArticleStory[]> {
  try {
    if (await draftEnabled()) return await rawArticles(limit, "draft");
    return CACHE_PUBLISHED ? await cachedArticles(limit) : await rawArticles(limit, "published");
  } catch (e) {
    console.error("SB articles fetch failed:", e);
    return [];
  }
}
