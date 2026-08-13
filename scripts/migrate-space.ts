// Clone the OLD Storyblok space into the NEW one: components (upsert), folders,
// all stories (published stay published, drafts stay drafts), with every
// a.storyblok.com asset re-uploaded to the new space and content URLs rewritten.
// The old space is read-only: its client physically cannot issue writes.
// Resumable: uploaded assets are cached in data/migration-asset-map.json.
//
//   Old space: OLD_STORYBLOK_SPACE_ID + OLD_STORYBLOK_MANAGEMENT_TOKEN
//   New space: STORYBLOK_SPACE_ID + STORYBLOK_MANAGEMENT_TOKEN (standard vars)
//
//   npm run migrate-space               # clone
//   npm run migrate-space -- --verify   # read-only parity checks, no writes
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const OLD_SPACE = process.env.OLD_STORYBLOK_SPACE_ID?.trim();
const OLD_TOKEN = process.env.OLD_STORYBLOK_MANAGEMENT_TOKEN?.trim();
const NEW_SPACE = process.env.STORYBLOK_SPACE_ID?.trim();
const NEW_TOKEN = process.env.STORYBLOK_MANAGEMENT_TOKEN?.trim();
const REGION = (process.env.NEXT_PUBLIC_STORYBLOK_REGION || "eu").toLowerCase();
const OLD_REGION = (process.env.OLD_STORYBLOK_REGION || REGION).toLowerCase();
const HOST: Record<string, string> = {
  eu: "https://mapi.storyblok.com", us: "https://api-us.storyblok.com",
  ap: "https://api-ap.storyblok.com", ca: "https://api-ca.storyblok.com",
  cn: "https://app.storyblokchina.com",
};
if (!OLD_SPACE || !OLD_TOKEN || !NEW_SPACE || !NEW_TOKEN) {
  console.error("Missing OLD_STORYBLOK_SPACE_ID / OLD_STORYBLOK_MANAGEMENT_TOKEN / STORYBLOK_SPACE_ID / STORYBLOK_MANAGEMENT_TOKEN.");
  process.exit(1);
}
if (OLD_SPACE === NEW_SPACE) {
  console.error("OLD_STORYBLOK_SPACE_ID equals STORYBLOK_SPACE_ID - refusing to clone a space onto itself.");
  process.exit(1);
}
const VERIFY = process.argv.includes("--verify");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(base: string, token: string, path: string, init: RequestInit = {}, attempt = 0): Promise<any> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { Authorization: token, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (res.status === 429 && attempt < 6) { await sleep(1000 * (attempt + 1)); return api(base, token, path, init, attempt + 1); }
  const text = await res.text();
  if (!res.ok) throw new Error(`MAPI ${res.status} ${path}: ${text}`);
  return text ? JSON.parse(text) : null;
}
const OLD_BASE = `${HOST[OLD_REGION] ?? HOST.eu}/v1/spaces/${OLD_SPACE}`;
const NEW_BASE = `${HOST[REGION] ?? HOST.eu}/v1/spaces/${NEW_SPACE}`;
// GET-only by construction: the old space can never be written to.
const oldApi = (path: string) => api(OLD_BASE, OLD_TOKEN!, path);
const newApi = (path: string, init: RequestInit = {}) => api(NEW_BASE, NEW_TOKEN!, path, init);

const ASSET_URL_RE = new RegExp(
  `(?:https?:)?//(?:s3\\.amazonaws\\.com/)?a\\.storyblok\\.com/f/${OLD_SPACE}/[^"'\\\\\\s)]+`, "g",
);

async function listStories(get: (path: string) => Promise<any>) {
  const all: any[] = [];
  for (let page = 1; ; page++) {
    const res = await get(`/stories?per_page=100&page=${page}`);
    const stories = res?.stories ?? [];
    all.push(...stories);
    if (stories.length < 100) return all;
  }
}

// --- asset re-upload (resumable) -------------------------------------------
const cachePath = new URL("../data/migration-asset-map.json", import.meta.url);
const assetMap: Record<string, { id: number; newUrl: string }> = existsSync(cachePath)
  ? JSON.parse(readFileSync(cachePath, "utf8"))
  : {};
const saveAssetMap = () => writeFileSync(cachePath, JSON.stringify(assetMap, null, 2));

const CONTENT_TYPES: Record<string, string> = {
  svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  avif: "image/avif", webp: "image/webp", gif: "image/gif", pdf: "application/pdf",
};

let oldAssetMeta: Map<string, Record<string, string>> | null = null;
async function loadOldAssetMeta() {
  if (oldAssetMeta) return oldAssetMeta;
  oldAssetMeta = new Map();
  for (let page = 1; ; page++) {
    const res = await oldApi(`/assets/?per_page=100&page=${page}`);
    const assets = res?.assets ?? [];
    for (const a of assets) {
      const base = String(a.filename ?? "").split("/").pop();
      if (base && a.meta_data) oldAssetMeta.set(base, a.meta_data);
    }
    if (assets.length < 100) return oldAssetMeta;
  }
}

async function migrateAsset(oldUrl: string): Promise<{ id: number; newUrl: string }> {
  if (assetMap[oldUrl]) return assetMap[oldUrl];
  const httpsUrl = oldUrl.startsWith("//") ? `https:${oldUrl}` : oldUrl;
  const res = await fetch(httpsUrl);
  if (!res.ok) throw new Error(`download ${httpsUrl} ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const filename = decodeURIComponent(httpsUrl.split("/").pop()!);
  const ext = filename.split(".").pop()!.toLowerCase();
  // Asset URLs embed the dimensions: /f/<space>/<WxH>/<hash>/<name> ("x" for PDFs).
  const dims = httpsUrl.match(new RegExp(`/f/${OLD_SPACE}/(\\d+x\\d+)/`))?.[1];
  const reg = await newApi(`/assets/`, {
    method: "POST",
    body: JSON.stringify({ filename, ...(dims ? { size: dims } : {}) }),
  });
  const form = new FormData();
  for (const [k, v] of Object.entries((reg.fields ?? {}) as Record<string, string>)) form.append(k, v);
  form.append("file", new Blob([bytes], { type: CONTENT_TYPES[ext] ?? "application/octet-stream" }), filename);
  const s3 = await fetch(reg.post_url, { method: "POST", body: form });
  if (!s3.ok) throw new Error(`S3 ${filename} ${s3.status}`);
  await newApi(`/assets/${reg.id}/finish_upload`);
  const meta = (await loadOldAssetMeta()).get(filename);
  if (meta) await newApi(`/assets/${reg.id}`, { method: "PUT", body: JSON.stringify({ meta_data: meta }) });
  let url: string | null = null;
  try { url = (await newApi(`/assets/${reg.id}`))?.filename ?? null; } catch { /* fall back */ }
  url = url || reg.pretty_url || reg.filename;
  if (url?.startsWith("//")) url = `https:${url}`;
  const entry = { id: reg.id as number, newUrl: url! };
  assetMap[oldUrl] = entry;
  saveAssetMap();
  await sleep(180);
  return entry;
}

// Point rewritten asset objects at the new asset ids so the editor's asset
// picker doesn't hold dangling references to the old space.
function fixAssetIds(node: any, idByNewUrl: Map<string, number>) {
  if (Array.isArray(node)) { node.forEach((n) => fixAssetIds(n, idByNewUrl)); return; }
  if (!node || typeof node !== "object") return;
  if (node.fieldtype === "asset" && typeof node.filename === "string") {
    const id = idByNewUrl.get(node.filename);
    if (id) node.id = id;
  }
  Object.values(node).forEach((v) => fixAssetIds(v, idByNewUrl));
}

// --- clone -----------------------------------------------------------------
async function migrateComponents() {
  const [oldComps, newComps] = await Promise.all([oldApi(`/components/`), newApi(`/components/`)]);
  const existing = new Map((newComps?.components ?? []).map((c: any) => [c.name, c.id]));
  for (const c of oldComps?.components ?? []) {
    const body = {
      component: {
        name: c.name, display_name: c.display_name, schema: c.schema,
        is_root: c.is_root, is_nestable: c.is_nestable,
        color: c.color, icon: c.icon, preview_field: c.preview_field,
      },
    };
    // Upsert: fresh spaces auto-create demo components (page/teaser/...) whose
    // schemas must be overwritten, not skipped.
    if (existing.has(c.name)) {
      await newApi(`/components/${existing.get(c.name)}`, { method: "PUT", body: JSON.stringify(body) });
      console.log(`component updated: ${c.name}`);
    } else {
      await newApi(`/components/`, { method: "POST", body: JSON.stringify(body) });
      console.log(`component created: ${c.name}`);
    }
    await sleep(150);
  }
}

async function migrateStories() {
  const oldList = await listStories(oldApi);
  const newList = await listStories(newApi);
  const newBySlug = new Map(newList.map((s: any) => [s.full_slug, s]));

  // Folders first (shallowest first), building the old->new parent_id map.
  const parentMap = new Map<number, number>([[0, 0]]);
  const folders = oldList.filter((s) => s.is_folder).sort((a, b) => a.full_slug.split("/").length - b.full_slug.split("/").length);
  for (const f of folders) {
    const found = newBySlug.get(f.full_slug);
    if (found) { parentMap.set(f.id, found.id); console.log(`folder exists: ${f.full_slug}`); continue; }
    const created = await newApi(`/stories`, {
      method: "POST",
      body: JSON.stringify({ story: { name: f.name, slug: f.slug, is_folder: true, parent_id: parentMap.get(f.parent_id ?? 0) ?? 0 } }),
    });
    parentMap.set(f.id, created.story.id);
    console.log(`folder created: ${f.full_slug}`);
    await sleep(150);
  }

  const stories = oldList.filter((s) => !s.is_folder).sort((a, b) => a.full_slug.localeCompare(b.full_slug));
  let done = 0;
  for (const s of stories) {
    done++;
    const existing = newBySlug.get(s.full_slug);
    // Storyblok auto-creates an empty `home` on space creation: update it in place.
    if (existing && s.full_slug !== "home") { console.log(`[${done}/${stories.length}] exists, skipped: ${s.full_slug}`); continue; }

    const full = (await oldApi(`/stories/${s.id}`)).story;
    let json = JSON.stringify(full.content);
    const urls = [...new Set(json.match(ASSET_URL_RE) ?? [])];
    for (const url of urls) {
      const { newUrl } = await migrateAsset(url);
      // Replace the base URL everywhere, preserving any /m/ transform suffix.
      json = json.split(url).join(newUrl);
    }
    const content = JSON.parse(json);
    const idByNewUrl = new Map(Object.values(assetMap).map((a) => [a.newUrl, a.id]));
    fixAssetIds(content, idByNewUrl);

    const story = {
      name: full.name, slug: full.slug, content,
      parent_id: parentMap.get(full.parent_id ?? 0) ?? 0,
      position: full.position, tag_list: full.tag_list,
      first_published_at: full.first_published_at ?? undefined,
    };
    const publish = full.published ? 1 : 0;
    if (existing) {
      await newApi(`/stories/${existing.id}`, { method: "PUT", body: JSON.stringify({ story, publish }) });
      console.log(`[${done}/${stories.length}] updated: ${s.full_slug}${publish ? "" : " (draft)"} (${urls.length} assets)`);
    } else {
      await newApi(`/stories`, { method: "POST", body: JSON.stringify({ story, publish }) });
      console.log(`[${done}/${stories.length}] created: ${s.full_slug}${publish ? "" : " (draft)"} (${urls.length} assets)`);
    }
    await sleep(200);
  }
}

// --- verify (read-only on both spaces) --------------------------------------
function normalize(value: any): any {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    const out: Record<string, any> = {};
    for (const k of Object.keys(value).sort()) {
      if (k === "id") continue; // asset ids differ between spaces by design
      out[k] = normalize(value[k]);
    }
    return out;
  }
  if (typeof value === "string") {
    // Compare asset URLs by basename: the space id + hash segments differ.
    return value.replace(/(?:https?:)?\/\/(?:s3\.amazonaws\.com\/)?a\.storyblok\.com\/f\/\d+\/[^"'\\\s)]*\/([^"'\\\s)\/]+)/g, "asset:$1");
  }
  return value;
}

async function verify() {
  const oldList = await listStories(oldApi);
  const newList = await listStories(newApi);
  const count = (list: any[], pred: (s: any) => boolean) => list.filter(pred).length;
  const stats = (list: any[]) => ({
    total: list.length,
    folders: count(list, (s) => s.is_folder),
    drafts: count(list, (s) => !s.is_folder && !s.published),
    products: count(list, (s) => !s.is_folder && s.full_slug.startsWith("products/")),
    categories: count(list, (s) => !s.is_folder && s.full_slug.startsWith("categories/")),
    articles: count(list, (s) => !s.is_folder && s.full_slug.startsWith("articles/")),
    root: count(list, (s) => !s.is_folder && !s.full_slug.includes("/")),
  });
  const o = stats(oldList), n = stats(newList);
  console.log("old:", JSON.stringify(o));
  console.log("new:", JSON.stringify(n));
  let failed = JSON.stringify(o) !== JSON.stringify(n);
  if (failed) console.error("FAIL: story counts differ");

  const oldBySlug = new Map(oldList.filter((s) => !s.is_folder).map((s) => [s.full_slug, s]));
  let oldRefs = 0, mismatches = 0, missing = 0;
  for (const s of newList.filter((x: any) => !x.is_folder)) {
    const full = (await newApi(`/stories/${s.id}`)).story;
    const json = JSON.stringify(full.content);
    const refs = (json.match(new RegExp(OLD_SPACE!, "g")) ?? []).length;
    if (refs) { oldRefs += refs; console.error(`FAIL: ${s.full_slug} still references the old space (${refs}x)`); }
    const oldStory = oldBySlug.get(s.full_slug);
    if (!oldStory) { missing++; console.error(`FAIL: ${s.full_slug} not in old space`); continue; }
    const oldFull = (await oldApi(`/stories/${oldStory.id}`)).story;
    if (JSON.stringify(normalize(full.content)) !== JSON.stringify(normalize(oldFull.content))) {
      mismatches++;
      console.error(`DIFF: ${s.full_slug}`);
    }
  }
  for (const slug of oldBySlug.keys()) {
    if (!newList.some((s: any) => !s.is_folder && s.full_slug === slug)) { missing++; console.error(`FAIL: ${slug} missing in new space`); }
  }
  failed = failed || oldRefs > 0 || mismatches > 0 || missing > 0;
  console.log(`old-space references: ${oldRefs} | content diffs: ${mismatches} | slug mismatches: ${missing}`);
  console.log(failed ? "VERIFY FAILED" : "VERIFY OK");
  if (failed) process.exit(1);
}

async function main() {
  if (VERIFY) return verify();
  console.log(`Cloning space ${OLD_SPACE} -> ${NEW_SPACE} (${OLD_REGION} -> ${REGION})`);
  await migrateComponents();
  await migrateStories();
  console.log(`\nDone. ${Object.keys(assetMap).length} assets in data/migration-asset-map.json. Run with --verify next.`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
