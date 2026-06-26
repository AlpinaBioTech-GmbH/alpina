// src/lib/rag/storyblok-sync.ts
// Pull published Storyblok content into the assistant knowledge base. Each
// story becomes one kb_documents row (keyed by its uuid) plus embedded chunks.
// Stories removed from Storyblok are pruned on the next sync.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStoryblokApi } from "@/lib/storyblok";
import { createDocument, ingestDocumentText } from "./ingest";

// Keys whose string values are never prose (ids, components, assets, plumbing).
const SKIP_KEYS = new Set([
  "_uid",
  "_editable",
  "component",
  "plugin",
  "icon",
  "id",
  "uuid",
  "url",
  "cached_url",
  "fieldtype",
  "linktype",
  "anchor",
  "target",
  "filename",
  "focus",
  "source",
  "story",
]);

function looksLikeProse(value: string): boolean {
  const v = value.trim();
  if (v.length < 2) return false;
  if (/^https?:\/\//i.test(v)) return false; // URL
  if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(v)) return false; // uuid
  if (/^#?[0-9a-fA-F]{3,8}$/.test(v)) return false; // color
  if (/^[a-z0-9_-]+\.(png|jpe?g|svg|webp|gif|mp4|pdf)$/i.test(v)) return false;
  if (/a\.storyblok\.com/.test(v)) return false;
  if (/^[a-z_]+$/.test(v) && v.length < 16) return false; // enum-ish token
  return true;
}

/** Recursively collect prose strings from a Storyblok content tree. */
function extractText(node: unknown, key = ""): string[] {
  if (typeof node === "string") {
    return !SKIP_KEYS.has(key) && looksLikeProse(node) ? [node] : [];
  }
  if (Array.isArray(node)) return node.flatMap((n) => extractText(n));
  if (node && typeof node === "object") {
    return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
      SKIP_KEYS.has(k) ? [] : extractText(v, k),
    );
  }
  return [];
}

type Story = {
  uuid: string;
  name: string;
  full_slug: string;
  content: Record<string, unknown>;
};

async function fetchAllStories(): Promise<Story[]> {
  const client = getStoryblokApi();
  const all: Story[] = [];
  let page = 1;
  const perPage = 100;
  while (true) {
    const { data } = await client.get("cdn/stories", {
      version: "published",
      per_page: perPage,
      page,
    });
    const stories = (data?.stories ?? []) as Story[];
    all.push(...stories);
    if (stories.length < perPage) break;
    page += 1;
  }
  return all;
}

export type SyncResult = {
  documents: number;
  chunks: number;
  pruned: number;
  skipped: number;
  errors: { title: string; error: string }[];
};

/** Storyblok full_slug -> public site path. */
function slugToUrl(fullSlug: string): string {
  const s = fullSlug.replace(/^\/+|\/+$/g, "");
  return s === "" || s === "home" ? "/" : `/${s}`;
}

export async function syncStoryblok(db: SupabaseClient): Promise<SyncResult> {
  // Folders/pages the admin excluded from the knowledge base.
  const { data: cfg } = await db
    .from("assistant_config")
    .select("excluded_slug_prefixes")
    .eq("id", "default")
    .maybeSingle();
  const excluded = ((cfg?.excluded_slug_prefixes as string[]) ?? [])
    .map((p) => p.trim().replace(/^\/+/, ""))
    .filter(Boolean);
  const isExcluded = (fullSlug: string) =>
    excluded.some((p) => fullSlug.replace(/^\/+/, "").startsWith(p));

  // Non-content story types (site config, nav) never belong in the KB.
  const SKIP_COMPONENTS = new Set(["global_config", "nav_item"]);

  const allStories = await fetchAllStories();
  const stories = allStories.filter(
    (s) =>
      !isExcluded(s.full_slug) &&
      !SKIP_COMPONENTS.has(String(s.content?.component ?? "")),
  );
  const skipped = allStories.length - stories.length;
  const liveUuids = new Set(stories.map((s) => s.uuid));

  // Prune documents for stories that no longer exist (chunks cascade).
  const { data: existing } = await db
    .from("kb_documents")
    .select("id, storyblok_uuid")
    .eq("source_type", "storyblok");

  const stale = ((existing as { id: string; storyblok_uuid: string | null }[]) ?? [])
    .filter((d) => d.storyblok_uuid && !liveUuids.has(d.storyblok_uuid))
    .map((d) => d.id);
  if (stale.length) {
    await db.from("kb_documents").delete().in("id", stale);
  }

  const byUuid = new Map(
    ((existing as { id: string; storyblok_uuid: string | null }[]) ?? []).map(
      (d) => [d.storyblok_uuid, d.id] as const,
    ),
  );

  const result: SyncResult = {
    documents: 0,
    chunks: 0,
    pruned: stale.length,
    skipped,
    errors: [],
  };

  for (const story of stories) {
    const title = story.name || story.full_slug;
    const sourceUrl = slugToUrl(story.full_slug);
    const prose = extractText(story.content);
    const text = [title, ...prose].join("\n\n").trim();
    if (!text) continue;

    try {
      let docId = byUuid.get(story.uuid);
      if (!docId) {
        docId = await createDocument(db, {
          source_type: "storyblok",
          title,
          storyblok_uuid: story.uuid,
          source_url: sourceUrl,
        });
      } else {
        await db
          .from("kb_documents")
          .update({
            title,
            source_url: sourceUrl,
            status: "pending",
            updated_at: new Date().toISOString(),
          })
          .eq("id", docId);
      }
      const { chunkCount } = await ingestDocumentText(db, docId, text);
      result.documents += 1;
      result.chunks += chunkCount;
    } catch (e) {
      result.errors.push({
        title,
        error: e instanceof Error ? e.message : "ingest failed",
      });
    }
  }

  return result;
}
