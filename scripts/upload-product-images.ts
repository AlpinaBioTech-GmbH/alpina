// Migrate product galleries into Storyblok: upload each distinct image to the
// space's asset library, add an `images` (multiasset) field to the `product`
// component, and set each product's ordered gallery. Resumable: already-
// uploaded images are cached in data/uploaded-assets.json.
//
//   npx tsx scripts/upload-product-images.ts
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import sharp from "sharp";

const TOKEN = process.env.STORYBLOK_MANAGEMENT_TOKEN?.trim();
const SPACE = process.env.STORYBLOK_SPACE_ID?.trim();
const REGION = (process.env.NEXT_PUBLIC_STORYBLOK_REGION || "eu").toLowerCase();
const HOST: Record<string, string> = {
  eu: "https://mapi.storyblok.com", us: "https://api-us.storyblok.com",
  ap: "https://api-ap.storyblok.com", ca: "https://api-ca.storyblok.com",
  cn: "https://app.storyblokchina.com",
};
const BASE = `${HOST[REGION] ?? HOST.eu}/v1/spaces/${SPACE}`;
if (!TOKEN || !SPACE) { console.error("Missing STORYBLOK_MANAGEMENT_TOKEN / STORYBLOK_SPACE_ID."); process.exit(1); }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mapi(path: string, init: RequestInit = {}, attempt = 0): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: TOKEN!, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (res.status === 429 && attempt < 6) { await sleep(1000 * (attempt + 1)); return mapi(path, init, attempt + 1); }
  const text = await res.text();
  if (!res.ok) throw new Error(`MAPI ${res.status} ${path}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const url = (p: string) => new URL(p, import.meta.url);
const gallery = JSON.parse(readFileSync(url("../data/product-images.json"), "utf8")) as Record<string, string[]>;
const products = (JSON.parse(readFileSync(url("../data/products.json"), "utf8")) as { products: { slug: string; name: string }[] }).products;
const nameBySlug = new Map(products.map((p) => [p.slug, p.name]));

const cachePath = url("../data/uploaded-assets.json");
const cache: Record<string, string> = existsSync(cachePath)
  ? JSON.parse(readFileSync(cachePath, "utf8"))
  : {};
const saveCache = () => writeFileSync(cachePath, JSON.stringify(cache, null, 2));

async function uploadImage(id: string): Promise<string> {
  if (cache[id]) return cache[id];
  const ext = id.split(".").pop()!.toLowerCase();
  const contentType = ext === "png" ? "image/png" : "image/jpeg";
  const res = await fetch(`https://static.wixstatic.com/media/${id}`, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`download ${id} ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(bytes).metadata().catch(() => ({} as { width?: number; height?: number }));
  const filename = id.replace(/[^a-z0-9]/gi, "-").slice(-60) + "." + ext;
  const reg = await mapi(`/assets/`, {
    method: "POST",
    body: JSON.stringify({ filename, ...(meta.width && meta.height ? { size: `${meta.width}x${meta.height}` } : {}) }),
  });
  const fields = (reg.fields ?? {}) as Record<string, string>;
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append("file", new Blob([bytes], { type: contentType }), filename);
  const s3 = await fetch(reg.post_url, { method: "POST", body: form });
  if (!s3.ok) throw new Error(`S3 ${id} ${s3.status}`);
  await mapi(`/assets/${reg.id}/finish_upload`);
  let out: string | null = null;
  try { out = (await mapi(`/assets/${reg.id}`))?.filename ?? null; } catch { /* fall back */ }
  out = out || reg.pretty_url || reg.filename;
  if (out?.startsWith("//")) out = `https:${out}`;
  if (!out) throw new Error(`no url for ${id}`);
  cache[id] = out;
  saveCache();
  await sleep(180);
  return out;
}

async function ensureImagesField() {
  const comps = await mapi(`/components/`);
  const product = (comps?.components ?? []).find((c: { name: string }) => c.name === "product");
  if (!product) throw new Error("product component not found");
  if (!product.schema.images) {
    product.schema.images = {
      type: "multiasset",
      filetypes: ["images"],
      description: "Product gallery (main + related). Shown as a left/right slider.",
    };
    await mapi(`/components/${product.id}`, { method: "PUT", body: JSON.stringify({ component: product }) });
    console.log("added `images` field to product component");
  }
}

async function main() {
  // 1. Upload all distinct images (deduped, cached).
  const distinct = [...new Set(Object.values(gallery).flat())];
  console.log(`Uploading ${distinct.length} distinct images...`);
  let done = 0;
  for (const id of distinct) {
    await uploadImage(id);
    if (++done % 10 === 0) console.log(`  ${done}/${distinct.length}`);
  }
  console.log("uploads complete.");

  // 2. Add the images field to the product schema.
  await ensureImagesField();

  // 3. Set each product's gallery.
  let updated = 0;
  for (const [slug, ids] of Object.entries(gallery)) {
    if (!ids.length) continue;
    const found = await mapi(`/stories?with_slug=${encodeURIComponent(`products/${slug}`)}`);
    const ref = found?.stories?.[0];
    if (!ref) { console.warn(`  no story: products/${slug}`); continue; }
    const story = (await mapi(`/stories/${ref.id}`)).story;
    story.content.images = ids.map((id) => ({
      fieldtype: "asset",
      filename: cache[id],
      alt: nameBySlug.get(slug) ?? "",
      name: "",
      title: "",
    }));
    await mapi(`/stories/${ref.id}`, {
      method: "PUT",
      body: JSON.stringify({ story: { name: story.name, slug: story.slug, content: story.content }, publish: 1 }),
    });
    console.log(`  ${slug}: ${ids.length} images`);
    if (++updated % 10 === 0) await sleep(300);
    await sleep(180);
  }
  console.log(`\nDone. ${distinct.length} images uploaded, ${updated} products updated.`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
