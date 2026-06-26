// Rename the "BATCH/LOT INFORMATION" info section to "BATCH INFORMATION" on all
// published products. Idempotent; only republishes products that change.
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { readFileSync } from "node:fs";

const TOKEN = process.env.STORYBLOK_MANAGEMENT_TOKEN?.trim();
const SPACE = process.env.STORYBLOK_SPACE_ID?.trim();
const REGION = (process.env.NEXT_PUBLIC_STORYBLOK_REGION || "eu").toLowerCase();
const HOST: Record<string, string> = {
  eu: "https://mapi.storyblok.com", us: "https://api-us.storyblok.com",
  ap: "https://api-ap.storyblok.com", ca: "https://api-ca.storyblok.com",
  cn: "https://app.storyblokchina.com",
};
const BASE = `${HOST[REGION] ?? HOST.eu}/v1/spaces/${SPACE}`;
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

const products = (JSON.parse(readFileSync(new URL("../data/products.json", import.meta.url), "utf8")) as { products: { slug: string }[] }).products;

async function main() {
  let changed = 0;
  for (const { slug } of products) {
    const found = await mapi(`/stories?with_slug=${encodeURIComponent(`products/${slug}`)}`);
    const ref = found?.stories?.[0];
    if (!ref) continue;
    const story = (await mapi(`/stories/${ref.id}`)).story;
    const secs = story.content?.info_sections;
    if (!Array.isArray(secs)) continue;
    let touched = false;
    for (const s of secs) {
      if (typeof s.title === "string" && /batch\s*\/?\s*lot\s+information/i.test(s.title)) {
        s.title = "BATCH INFORMATION";
        touched = true;
      }
    }
    if (!touched) continue;
    await mapi(`/stories/${ref.id}`, {
      method: "PUT",
      body: JSON.stringify({ story: { name: story.name, slug: story.slug, content: story.content }, publish: 1 }),
    });
    changed++;
    console.log(`  renamed: ${slug}`);
    await sleep(180);
  }
  console.log(`Done. ${changed} products updated.`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
