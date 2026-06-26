// Populate the assistant knowledge base from Storyblok (standalone equivalent
// of the admin "Sync Storyblok" action). Each published story becomes a
// kb_documents row + embedded chunks (Voyage). Idempotent; prunes removed
// stories. Requires VOYAGE_API_KEY + Supabase secret key + Storyblok token.
//
//   npm run sync-kb
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { createClient } from "@supabase/supabase-js";
import { createDocument, ingestDocumentText } from "../src/lib/rag/ingest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_TOKEN = process.env.NEXT_PUBLIC_STORYBLOK_TOKEN;
const SB_REGION = (process.env.NEXT_PUBLIC_STORYBLOK_REGION || "eu").toLowerCase();

const CDN_HOST: Record<string, string> = {
  eu: "https://api.storyblok.com",
  us: "https://api-us.storyblok.com",
  ap: "https://api-ap.storyblok.com",
  ca: "https://api-ca.storyblok.com",
  cn: "https://app.storyblokchina.com",
};

if (!SUPABASE_URL || !SECRET) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY.");
  process.exit(1);
}
if (!SB_TOKEN) {
  console.error("Missing NEXT_PUBLIC_STORYBLOK_TOKEN.");
  process.exit(1);
}
if (!process.env.VOYAGE_API_KEY) {
  console.error("Missing VOYAGE_API_KEY (needed to embed the knowledge base).");
  process.exit(1);
}

// --- Prose extraction (mirrors src/lib/rag/storyblok-sync.ts) --------------
const SKIP_KEYS = new Set([
  "_uid", "_editable", "component", "plugin", "icon", "id", "uuid", "url",
  "cached_url", "fieldtype", "linktype", "anchor", "target", "filename",
  "focus", "source", "story",
]);
function looksLikeProse(value: string): boolean {
  const v = value.trim();
  if (v.length < 2) return false;
  if (/^https?:\/\//i.test(v)) return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(v)) return false;
  if (/^#?[0-9a-fA-F]{3,8}$/.test(v)) return false;
  if (/^[a-z0-9_-]+\.(png|jpe?g|svg|webp|gif|mp4|pdf)$/i.test(v)) return false;
  if (/a\.storyblok\.com/.test(v)) return false;
  if (/^[a-z_]+$/.test(v) && v.length < 16) return false;
  return true;
}
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
function slugToUrl(fullSlug: string): string {
  const s = fullSlug.replace(/^\/+|\/+$/g, "");
  return s === "" || s === "home" ? "/" : `/${s}`;
}

type Story = { uuid: string; name: string; full_slug: string; content: Record<string, unknown> };

async function fetchAllStories(): Promise<Story[]> {
  const base = `${CDN_HOST[SB_REGION] ?? CDN_HOST.eu}/v2/cdn/stories`;
  const all: Story[] = [];
  let page = 1;
  const perPage = 100;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const url = `${base}?token=${SB_TOKEN}&version=published&per_page=${perPage}&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Storyblok ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { stories?: Story[] };
    const stories = data.stories ?? [];
    all.push(...stories);
    if (stories.length < perPage) break;
    page += 1;
  }
  return all;
}

async function main() {
  const db = createClient(SUPABASE_URL!, SECRET!, { auth: { persistSession: false } });

  const { data: cfg } = await db
    .from("assistant_config")
    .select("excluded_slug_prefixes")
    .eq("id", "default")
    .maybeSingle();
  const excluded = (((cfg?.excluded_slug_prefixes as string[]) ?? []))
    .map((p) => p.trim().replace(/^\/+/, ""))
    .filter(Boolean);
  const isExcluded = (fullSlug: string) =>
    excluded.some((p) => fullSlug.replace(/^\/+/, "").startsWith(p));

  const SKIP_COMPONENTS = new Set(["global_config", "nav_item"]);

  const allStories = await fetchAllStories();
  const stories = allStories.filter(
    (s) => !isExcluded(s.full_slug) && !SKIP_COMPONENTS.has(String(s.content?.component ?? "")),
  );
  console.log(`Fetched ${allStories.length} stories, ${stories.length} to index.`);
  const liveUuids = new Set(stories.map((s) => s.uuid));

  const { data: existing } = await db
    .from("kb_documents")
    .select("id, storyblok_uuid")
    .eq("source_type", "storyblok");
  const existingRows = (existing as { id: string; storyblok_uuid: string | null }[]) ?? [];

  const stale = existingRows
    .filter((d) => d.storyblok_uuid && !liveUuids.has(d.storyblok_uuid))
    .map((d) => d.id);
  if (stale.length) {
    await db.from("kb_documents").delete().in("id", stale);
    console.log(`Pruned ${stale.length} removed stories.`);
  }
  const byUuid = new Map(existingRows.map((d) => [d.storyblok_uuid, d.id] as const));

  let docs = 0,
    chunks = 0;
  const errors: { title: string; error: string }[] = [];
  for (const story of stories) {
    const title = story.name || story.full_slug;
    const text = [title, ...extractText(story.content)].join("\n\n").trim();
    if (!text) continue;
    try {
      let docId = byUuid.get(story.uuid);
      if (!docId) {
        docId = await createDocument(db, {
          source_type: "storyblok",
          title,
          storyblok_uuid: story.uuid,
          source_url: slugToUrl(story.full_slug),
        });
      } else {
        await db
          .from("kb_documents")
          .update({ title, source_url: slugToUrl(story.full_slug), status: "pending", updated_at: new Date().toISOString() })
          .eq("id", docId);
      }
      const { chunkCount } = await ingestDocumentText(db, docId, text);
      docs += 1;
      chunks += chunkCount;
      console.log(`  ${title} -> ${chunkCount} chunks`);
    } catch (e) {
      errors.push({ title, error: e instanceof Error ? e.message : "ingest failed" });
      console.error(`  FAILED ${title}: ${(e as Error).message}`);
    }
  }

  console.log(`\nDone. ${docs} documents, ${chunks} chunks, ${stale.length} pruned, ${errors.length} errors.`);
  if (errors.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error("sync-kb failed:", err.message || err);
  process.exit(1);
});
