// Product catalog helpers: fetch ELISA-kit products and their categories from
// Storyblok and shape them for the catalog pages. Products are stored as
// `product` stories under products/, categories as `category` stories under
// categories/. Server-only (uses the Storyblok delivery client).
import { unstable_cache } from "next/cache";
import { getStoryblokApi, STORYBLOK_TAG } from "@/lib/storyblok";

async function draftEnabled(): Promise<boolean> {
  try {
    const { draftMode } = await import("next/headers");
    return (await draftMode()).isEnabled;
  } catch {
    return false;
  }
}

export type ProductType = "drug ELISA" | "ADA ELISA";

export type ProductItem = {
  uuid: string;
  slug: string;
  fullSlug: string;
  name: string;
  analyte: string;
  productType: ProductType | string;
  categories: string[];
  description: string;
  price: string;
  sku: string;
  sampleType: string;
  sensitivity: string;
  format: string;
  tests: string;
  regulatory: string;
  image?: string;
  sourceUrl?: string;
};

export type CategoryItem = {
  uuid: string;
  slug: string;
  fullSlug: string;
  name: string;
  kind: "functional" | "target" | string;
  description: string;
};

type SbStory = {
  uuid: string;
  slug: string;
  full_slug: string;
  content: Record<string, unknown>;
};

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function toProductItem(story: SbStory): ProductItem {
  const c = story.content || {};
  const img = c.image as { filename?: string } | undefined;
  const cats = Array.isArray(c.categories)
    ? (c.categories as unknown[]).map((x) => String(x))
    : [];
  return {
    uuid: story.uuid,
    slug: story.slug,
    fullSlug: story.full_slug,
    name: s(c.name) || story.slug,
    analyte: s(c.analyte),
    productType: s(c.product_type),
    categories: cats,
    description: s(c.description),
    price: s(c.price),
    sku: s(c.sku),
    sampleType: s(c.sample_type),
    sensitivity: s(c.sensitivity),
    format: s(c.format),
    tests: s(c.tests),
    regulatory: s(c.regulatory),
    image: img?.filename || undefined,
    sourceUrl: s(c.source_url) || undefined,
  };
}

export function toCategoryItem(story: SbStory): CategoryItem {
  const c = story.content || {};
  return {
    uuid: story.uuid,
    slug: story.slug,
    fullSlug: story.full_slug,
    name: s(c.name) || story.slug,
    kind: s(c.kind) || "target",
    description: s(c.description),
  };
}

async function rawStoriesOfType(
  contentType: string,
  version: "draft" | "published",
): Promise<SbStory[]> {
  const { data } = await getStoryblokApi().get("cdn/stories", {
    version,
    content_type: contentType,
    per_page: 100,
    sort_by: "content.name:asc",
    cv: Date.now(),
  });
  return (data?.stories ?? []) as SbStory[];
}

const cachedByType = unstable_cache(
  (contentType: string) => rawStoriesOfType(contentType, "published"),
  ["sb-catalog"],
  { tags: [STORYBLOK_TAG], revalidate: 3600 },
);

// Cache published reads only in production (see lib/storyblok.ts); dev is fresh.
const CACHE_PUBLISHED = process.env.NODE_ENV === "production";

async function storiesOfType(contentType: string): Promise<SbStory[]> {
  if (await draftEnabled()) return rawStoriesOfType(contentType, "draft");
  return CACHE_PUBLISHED
    ? cachedByType(contentType)
    : rawStoriesOfType(contentType, "published");
}

/** All products, A-Z by name. */
export async function fetchProducts(): Promise<ProductItem[]> {
  try {
    return (await storiesOfType("product")).map(toProductItem);
  } catch (e) {
    console.error("catalog products fetch failed:", e);
    return [];
  }
}

/** All categories. */
export async function fetchCategories(): Promise<CategoryItem[]> {
  try {
    return (await storiesOfType("category")).map(toCategoryItem);
  } catch (e) {
    console.error("catalog categories fetch failed:", e);
    return [];
  }
}

/** Products tagged with a given category slug. */
export async function fetchProductsByCategory(
  categorySlug: string,
): Promise<ProductItem[]> {
  const all = await fetchProducts();
  return all.filter((p) => p.categories.includes(categorySlug));
}
