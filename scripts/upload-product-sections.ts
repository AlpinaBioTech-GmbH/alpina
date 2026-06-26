// Migrate the product "read more" sections into Storyblok:
//  1. Upload each distinct PDF to the asset library (cached, resumable).
//  2. Add an `info_section` nestable blok + `info_sections` field to `product`.
//  3. Set each product's sections (title, content HTML, document) and publish.
// PDF links inside the HTML are rewritten to the Storyblok-hosted copies.
//
//   npx tsx scripts/upload-product-sections.ts
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { readFileSync, writeFileSync, existsSync } from "node:fs";

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

const u = (p: string) => new URL(p, import.meta.url);
type Section = { title: string; html: string; pdfs: string[] };
const sections = JSON.parse(readFileSync(u("../data/product-sections.json"), "utf8")) as Record<string, Section[]>;
const products = (JSON.parse(readFileSync(u("../data/products.json"), "utf8")) as { products: { slug: string; name: string }[] }).products;
const nameBySlug = new Map(products.map((p) => [p.slug, p.name]));

const cachePath = u("../data/uploaded-pdfs.json");
const cache: Record<string, string> = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};
const saveCache = () => writeFileSync(cachePath, JSON.stringify(cache, null, 2));

async function uploadPdf(pdfUrl: string): Promise<string> {
  if (cache[pdfUrl]) return cache[pdfUrl];
  const res = await fetch(pdfUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`download ${pdfUrl} ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const base = pdfUrl.split("/").pop()!.replace(/[^a-z0-9.]/gi, "-");
  const filename = base.endsWith(".pdf") ? base : base + ".pdf";
  const reg = await mapi(`/assets/`, { method: "POST", body: JSON.stringify({ filename }) });
  const fields = (reg.fields ?? {}) as Record<string, string>;
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append("file", new Blob([bytes], { type: "application/pdf" }), filename);
  const s3 = await fetch(reg.post_url, { method: "POST", body: form });
  if (!s3.ok) throw new Error(`S3 ${pdfUrl} ${s3.status}`);
  await mapi(`/assets/${reg.id}/finish_upload`);
  let out: string | null = null;
  try { out = (await mapi(`/assets/${reg.id}`))?.filename ?? null; } catch { /* fall back */ }
  out = out || reg.pretty_url || reg.filename;
  if (out?.startsWith("//")) out = `https:${out}`;
  if (!out) throw new Error(`no url for ${pdfUrl}`);
  cache[pdfUrl] = out;
  saveCache();
  await sleep(180);
  return out;
}

async function ensureSchema() {
  const comps = await mapi(`/components/`);
  const list = comps?.components ?? [];
  if (!list.find((c: { name: string }) => c.name === "info_section")) {
    await mapi(`/components/`, {
      method: "POST",
      body: JSON.stringify({
        component: {
          name: "info_section", display_name: "Info Section", is_root: false, is_nestable: true,
          schema: {
            title: { type: "text" },
            content_html: { type: "textarea", description: "Section content (HTML), rendered in the read-more accordion." },
            document: { type: "asset", description: "Optional downloadable document (e.g. instructions PDF)." },
          },
        },
      }),
    });
    console.log("created info_section component");
    await sleep(200);
  }
  const product = (await mapi(`/components/`)).components.find((c: { name: string }) => c.name === "product");
  if (product && !product.schema.info_sections) {
    product.schema.info_sections = {
      type: "bloks", restrict_components: true, component_whitelist: ["info_section"],
      description: "Read-more documentation sections (assay characteristics, references, IFU, SDS, batch/lot).",
    };
    await mapi(`/components/${product.id}`, { method: "PUT", body: JSON.stringify({ component: product }) });
    console.log("added info_sections field to product");
    await sleep(200);
  }
}

function rewrite(html: string): string {
  let out = html;
  for (const [orig, asset] of Object.entries(cache)) out = out.split(orig).join(asset);
  return out;
}

// Tidy a couple of source-site section titles.
function normalizeTitle(title: string): string {
  return title.replace(/batch\s*\/?\s*lot\s+information/i, "BATCH INFORMATION");
}

let uid = 0;
const nextUid = () => `sec-${++uid}`;

async function main() {
  // 1. Upload distinct PDFs.
  const distinct = [...new Set(Object.values(sections).flatMap((arr) => arr.flatMap((s) => s.pdfs)))];
  console.log(`Uploading ${distinct.length} distinct PDFs...`);
  let n = 0;
  for (const p of distinct) { try { await uploadPdf(p); } catch (e) { console.error(`  PDF FAIL ${p}: ${(e as Error).message}`); } if (++n % 15 === 0) console.log(`  ${n}/${distinct.length}`); }

  // 2. Schema.
  await ensureSchema();

  // 3. Set each product's sections.
  let updated = 0;
  for (const [slug, secs] of Object.entries(sections)) {
    if (!secs.length) { console.warn(`  skip (no sections): ${slug}`); continue; }
    const found = await mapi(`/stories?with_slug=${encodeURIComponent(`products/${slug}`)}`);
    const ref = found?.stories?.[0];
    if (!ref) { console.warn(`  no story: products/${slug}`); continue; }
    const story = (await mapi(`/stories/${ref.id}`)).story;
    story.content.info_sections = secs.map((s) => {
      const doc = s.pdfs[0] ? cache[s.pdfs[0]] : undefined;
      return {
        _uid: nextUid(),
        component: "info_section",
        title: normalizeTitle(s.title),
        content_html: rewrite(s.html),
        ...(doc ? { document: { fieldtype: "asset", filename: doc, alt: s.title, name: "", title: "" } } : {}),
      };
    });
    await mapi(`/stories/${ref.id}`, {
      method: "PUT",
      body: JSON.stringify({ story: { name: story.name, slug: story.slug, content: story.content }, publish: 1 }),
    });
    console.log(`  ${slug}: ${secs.length} sections`);
    updated++;
    await sleep(180);
  }
  console.log(`\nDone. ${distinct.length} PDFs, ${updated} products updated.`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
