// Storyblok Management API: publishing pipeline-generated articles.
// Component-free delivery reads: this module is imported by the CLI pipeline,
// so it must not pull in lib/storyblok.ts (React component map + server-only).
import { fetchStoriesRaw as fetchStories } from "@/lib/storyblok-delivery";
import { stripLongDashesDeep } from "@/lib/strip-dashes";
import { imageDimensions } from "@/lib/images/dimensions";
import type { DraftArticle } from "@/lib/anthropic/writer";
import { brand, content } from "@/lib/config";

// Use `?.trim() ||`, not `??`: an unset CI var injects "", which `??` would
// keep, producing /spaces//... (empty id) and a 404.
const SPACE_ID = process.env.STORYBLOK_SPACE_ID?.trim() || "";
const MAPI = `https://mapi.storyblok.com/v1/spaces/${SPACE_ID}`;

// Article folder slug derived from the content config (no trailing slash).
const ARTICLE_PREFIX = content.articleSlugPrefix; // e.g. "articles/"
const ARTICLE_FOLDER = ARTICLE_PREFIX.replace(/\/+$/, ""); // e.g. "articles"

function managementToken(): string {
  const token = process.env.STORYBLOK_MANAGEMENT_TOKEN;
  if (!token) throw new Error("STORYBLOK_MANAGEMENT_TOKEN is not set");
  return token;
}

async function mapi(path: string, init: RequestInit = {}) {
  const res = await fetch(`${MAPI}${path}`, {
    ...init,
    headers: {
      Authorization: managementToken(),
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Storyblok MAPI ${path} failed (${res.status}): ${JSON.stringify(data.errors ?? data).slice(0, 500)}`);
  }
  return data;
}

/**
 * Upload an image to Storyblok assets and return its asset id + canonical CDN
 * URL. Four steps: register the asset (signed S3 form, with WxH so the URL
 * carries a dimensions segment) → POST the bytes to S3 → finish_upload → GET
 * the finalized asset for its canonical, dimensioned `filename`.
 */
export async function uploadImageAsset(opts: {
  bytes: ArrayBuffer;
  filename: string;
  contentType: string;
}): Promise<{ id: number; url: string }> {
  // Send the real dimensions as `size` ("WxH"): without it the asset URL lacks
  // the dimensions segment and Storyblok's `/m/WxH/` image transforms 400.
  const dim = imageDimensions(opts.bytes);
  const reg = await mapi(`/assets/`, {
    method: "POST",
    body: JSON.stringify({ filename: opts.filename, ...(dim && { size: `${dim.width}x${dim.height}` }) }),
  });
  const fields = (reg.fields ?? {}) as Record<string, string>;
  if (!reg.post_url || !reg.id) throw new Error("Storyblok asset registration returned no upload target");

  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append("file", new Blob([opts.bytes], { type: opts.contentType }), opts.filename);
  const s3 = await fetch(reg.post_url, { method: "POST", body: form });
  if (!s3.ok) throw new Error(`Storyblok asset S3 upload failed (${s3.status})`);

  await mapi(`/assets/${reg.id}/finish_upload`);

  // Use the finalized asset's canonical filename (it carries the dimensions
  // segment); fall back to the registration URL if the GET is unavailable.
  let url: string | null = null;
  try {
    const asset = await mapi(`/assets/${reg.id}`);
    url = asset?.filename ?? null;
  } catch {
    /* fall back below */
  }
  url = url || reg.pretty_url || reg.filename || (fields.key ? `https://a.storyblok.com/${fields.key}` : null);
  if (!url) throw new Error("Storyblok asset upload returned no URL");
  if (url.startsWith("//")) url = `https:${url}`; // normalize protocol-relative
  return { id: reg.id as number, url };
}

interface CategoryStory {
  uuid: string;
  slug: string;
  name: string;
}

export async function listCategories(): Promise<CategoryStory[]> {
  try {
    const stories = await fetchStories("article-categories/");
    return (stories as CategoryStory[]).map((s) => ({ uuid: s.uuid, slug: s.slug, name: s.name }));
  } catch {
    return [];
  }
}

export async function recentArticleTitles(limit = 30): Promise<string[]> {
  try {
    const stories = await fetchStories(ARTICLE_PREFIX, { per_page: limit });
    return (stories as { name: string; content?: { title?: string } }[])
      .map((s) => s.content?.title || s.name)
      .filter(Boolean)
      .slice(0, limit);
  } catch {
    return [];
  }
}

async function storyExists(fullSlug: string): Promise<boolean> {
  const data = await mapi(`/stories?with_slug=${encodeURIComponent(fullSlug)}`);
  return Boolean(data.stories?.[0]);
}

async function uniqueSlug(slug: string): Promise<string> {
  let candidate = slug;
  for (let n = 2; n <= 6; n++) {
    if (!(await storyExists(`${ARTICLE_PREFIX}${candidate}`))) return candidate;
    candidate = `${slug}-${n}`;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

function sourcesSection(sourceUrls: string[]): string {
  if (sourceUrls.length === 0) return "";
  const items = sourceUrls.map((u, i) => {
    let label = u;
    try {
      label = new URL(u).hostname.replace(/^www\./, "");
    } catch {
      // keep raw url as label
    }
    return `- [${i + 1}] [${label}](${u})`;
  });
  return `\n\n---\n\n## Sources\n\n${items.join("\n")}`;
}

// Fold the writer's tags onto the controlled vocabulary (content.writer.
// articleTags), mapping common synonyms back to a canonical tag so the
// /articles tag filter only ever sees the approved 7.
const TAG_ALIASES: Record<string, string> = {
  ada: "Anti-Drug Antibodies",
  "anti-drug antibody": "Anti-Drug Antibodies",
  "anti-drug antibodies": "Anti-Drug Antibodies",
  immunogenicity: "Immunogenicity",
  immunogenic: "Immunogenicity",
  tdm: "Therapeutic Drug Monitoring",
  "therapeutic drug monitoring": "Therapeutic Drug Monitoring",
  "drug monitoring": "Therapeutic Drug Monitoring",
  "drug-level monitoring": "Therapeutic Drug Monitoring",
  trough: "Therapeutic Drug Monitoring",
  pharmacokinetics: "Therapeutic Drug Monitoring",
  biosimilar: "Biosimilars",
  biosimilars: "Biosimilars",
  switching: "Biosimilars",
  "anti-tnf": "Anti-TNF",
  tnf: "Anti-TNF",
  infliximab: "Anti-TNF",
  adalimumab: "Anti-TNF",
  ibd: "Anti-TNF",
  "inflammatory bowel disease": "Anti-TNF",
  elisa: "ELISA",
  immunoassay: "ELISA",
  immunoassays: "ELISA",
  methods: "ELISA",
  "assay validation": "Assay Validation",
  validation: "Assay Validation",
  reproducibility: "Assay Validation",
  "fit-for-purpose": "Assay Validation",
  ruo: "Assay Validation",
  quality: "Assay Validation",
};

function constrainTags(raw: string[]): string[] {
  const canon = new Map(content.writer.articleTags.map((t) => [t.toLowerCase(), t]));
  const out: string[] = [];
  const add = (v?: string) => {
    if (v && !out.includes(v)) out.push(v);
  };
  for (const t of raw) {
    const key = t.trim().toLowerCase();
    if (!key) continue;
    if (canon.has(key)) add(canon.get(key));
    else if (TAG_ALIASES[key]) add(TAG_ALIASES[key]);
    else {
      // substring fallback: "anti-TNF therapy", "biosimilar switching", etc.
      const hit = Object.keys(TAG_ALIASES).find((a) => key.includes(a));
      if (hit) add(TAG_ALIASES[hit]);
    }
  }
  return out.slice(0, 3);
}

export interface PublishedArticle {
  id: string;
  slug: string;
  full_slug: string;
  title: string;
  excerpt: string;
  tags: string[];
  published: boolean;
  /** Whether the article was given a hero figure (figure or cover). */
  hasHero: boolean;
}

const FIGURE_COPYRIGHT = "© 2026 AlpinaBioTech GmbH. All rights reserved.";
const FIGURE_SOURCE = "Original illustration created in-house for AlpinaBioTech GmbH.";

// Upload an original SVG figure as a Storyblok asset (with rights metadata) and
// return the hero_image asset object for the article content.
async function uploadFigure(
  figure: { svg: string; alt: string; title: string },
  slug: string,
): Promise<Record<string, unknown>> {
  const bytes = new TextEncoder().encode(figure.svg);
  const filename = `${slug.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 70)}.svg`;
  const { id, url } = await uploadImageAsset({
    bytes: bytes.buffer as ArrayBuffer,
    filename,
    contentType: "image/svg+xml",
  });
  await mapi(`/assets/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      meta_data: { alt: figure.alt, title: figure.title, copyright: FIGURE_COPYRIGHT, source: FIGURE_SOURCE },
    }),
  });
  return {
    id,
    fieldtype: "asset",
    filename: url,
    alt: figure.alt,
    title: figure.title,
    copyright: FIGURE_COPYRIGHT,
    source: FIGURE_SOURCE,
    name: "",
  };
}

/**
 * Create the article story in Storyblok. Approved drafts are published
 * immediately (publish: 1); editor-rejected drafts are created unpublished for
 * human review (the rejection reason and score live in pipeline_runs / the
 * admin dashboard, never in the article content).
 */
export async function publishArticle(
  rawDraft: DraftArticle,
  opts: {
    publish: boolean;
    author?: string;
    // Original SVG hero figure (preferred). Per IMAGE-GENERATION.md.
    figure?: { svg: string; alt: string; title: string };
    cover?: { assetId: number; assetUrl: string; alt: string; credit: string; sourceUrl: string };
  },
): Promise<PublishedArticle> {
  // Deterministic guarantee: no long dashes in any published field (title,
  // excerpt, body, tags), regardless of what the model wrote.
  const draft = stripLongDashesDeep(rawDraft);

  const folderData = await mapi(`/stories?with_slug=${encodeURIComponent(ARTICLE_FOLDER)}`);
  const folder = folderData.stories?.[0];
  if (!folder) throw new Error(`${ARTICLE_FOLDER} folder missing in Storyblok`);

  const slug = await uniqueSlug(draft.slug);

  // Hero image: prefer the original SVG figure; fall back to a stock cover.
  let heroImage: Record<string, unknown> | undefined;
  if (opts.figure) {
    heroImage = await uploadFigure(opts.figure, slug);
  } else if (opts.cover) {
    heroImage = {
      id: opts.cover.assetId,
      filename: opts.cover.assetUrl,
      alt: opts.cover.alt,
      fieldtype: "asset",
    };
  }

  // The `article` component stores its body as a markdown field (rendered by
  // ArticleBody / react-markdown), so write the markdown string directly - do
  // NOT convert to richtext. Field names match the article schema exactly
  // (title, teaser, author, date, body, tags, hero_image) so nothing lands
  // out-of-schema.
  const body = draft.body + sourcesSection(draft.source_urls);

  const todayIso = new Date().toISOString().slice(0, 10);
  const created = await mapi(`/stories`, {
    method: "POST",
    body: JSON.stringify({
      publish: opts.publish ? 1 : 0,
      story: {
        name: draft.title,
        slug,
        parent_id: folder.id,
        content: {
          component: "article",
          title: draft.title,
          teaser: draft.excerpt,
          author: opts.author ?? brand.name,
          date: todayIso,
          body,
          tags: constrainTags(draft.tags),
          ...(heroImage && { hero_image: heroImage }),
        },
      },
    }),
  });
  const story = created.story;
  if (!story) throw new Error("Storyblok create returned no story");
  return {
    id: String(story.id),
    slug,
    full_slug: story.full_slug,
    title: draft.title,
    excerpt: draft.excerpt,
    tags: draft.tags,
    published: opts.publish,
    hasHero: Boolean(heroImage),
  };
}
