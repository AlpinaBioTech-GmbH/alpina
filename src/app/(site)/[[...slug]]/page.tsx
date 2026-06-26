// src/app/(site)/[[...slug]]/page.tsx
// Catch-all route: renders any Storyblok story by slug.
//  /            -> story "home"
//  /about       -> story "about"
//  /news/<slug> -> a news_article story
//  /articles/<slug> -> a published article story

import type { Metadata } from "next";
import { StoryblokStory } from "@storyblok/react/rsc";
import { notFound } from "next/navigation";
import { fetchStory } from "@/lib/storyblok";
import { brand } from "@/lib/config";

const DEFAULT_DESC = brand.description;

type Blok = { component: string; subhead?: string; [k: string]: unknown };

// Per-route SEO/OG. Prefers the story's seo-metatags field, then derives a
// description from the page's hero/excerpt, then falls back to the brand default.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const joined = slug?.join("/") || "home";
  const story = await fetchStory(joined).catch(() => null);
  if (!story) return {};

  const c = (story.content ?? {}) as {
    title?: string;
    seo?: { title?: string; description?: string; og_image?: string };
    excerpt?: string;
    body?: unknown; // array of bloks for `page`; richtext object for content types
  };
  const seo = c.seo ?? {};
  // `body` is a blok array on the `page` type, but a richtext object on content
  // types (news_article) - only scan it when it's actually an array.
  const heroSub = Array.isArray(c.body)
    ? (c.body as Blok[]).find((b) => b.component === "hero")?.subhead
    : undefined;
  const description = seo.description || heroSub || c.excerpt || DEFAULT_DESC;

  const isHome = joined === "home";
  const ogImageUrl = `/api/og?slug=${encodeURIComponent(joined)}`;
  const title: Metadata["title"] = seo.title
    ? { absolute: seo.title }
    : isHome
      ? { absolute: brand.homeTitle }
      : c.title || brand.name;

  return {
    title,
    description,
    alternates: { canonical: `/${isHome ? "" : joined}` },
    // og:image / twitter:image come from the dynamic generator (one branded
    // card per route). metadataBase resolves this to an absolute URL.
    openGraph: {
      title: typeof title === "object" ? title.absolute : `${title} - ${brand.name}`,
      description,
      type: "website",
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const joined = slug?.join("/") || "home";

  let story;
  try {
    story = await fetchStory(joined);
  } catch {
    notFound();
  }
  if (!story) notFound();

  // StoryblokStory renders via the server component map AND attaches the
  // Visual Editor bridge for live editing.
  return <StoryblokStory story={story} />;
}

// Revalidate published content periodically; the Storyblok publish webhook can
// also revalidate on demand. Draft mode bypasses this.
export const revalidate = 3600;
