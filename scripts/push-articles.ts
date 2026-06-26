// Publish the articles in content/articles/*.md into Storyblok as `article`
// stories under the articles/ folder. Uploads each hero SVG as an asset with its
// rights metadata (alt/title/copyright/source). Idempotent: existing stories are
// updated, existing assets (by cache) reused.
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import matter from "gray-matter";

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

const here = dirname(fileURLToPath(import.meta.url));
const ARTICLES_DIR = join(here, "..", "content", "articles");
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

// --- asset cache (resumable) ----------------------------------------------
const cachePath = join(ARTICLES_DIR, ".uploaded-assets.json");
const cache: Record<string, { filename: string }> = existsSync(cachePath)
  ? JSON.parse(readFileSync(cachePath, "utf8"))
  : {};

type HeroMeta = { alt?: string; title?: string; copyright?: string; source?: string };

async function uploadHero(svgFile: string, meta: HeroMeta) {
  if (cache[svgFile]) return cache[svgFile];
  const full = join(ARTICLES_DIR, basename(svgFile));
  const bytes = readFileSync(full);
  const filename = basename(svgFile);
  const reg = await mapi(`/assets/`, { method: "POST", body: JSON.stringify({ filename, validate_upload: 1 }) });
  const fields = (reg.fields ?? {}) as Record<string, string>;
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append("file", new Blob([bytes], { type: "image/svg+xml" }), filename);
  const s3 = await fetch(reg.post_url, { method: "POST", body: form });
  if (!s3.ok) throw new Error(`S3 ${filename} ${s3.status}`);
  await mapi(`/assets/${reg.id}/finish_upload`);
  // Write rights metadata.
  await mapi(`/assets/${reg.id}`, {
    method: "PUT",
    body: JSON.stringify({ meta_data: { alt: meta.alt ?? "", title: meta.title ?? "", copyright: meta.copyright ?? "", source: meta.source ?? "" } }),
  });
  let url: string | null = null;
  try { url = (await mapi(`/assets/${reg.id}`))?.filename ?? null; } catch { /* fall back */ }
  url = url || reg.pretty_url || reg.filename;
  if (url?.startsWith("//")) url = `https:${url}`;
  const obj = { filename: url! };
  cache[svgFile] = obj;
  writeFileSync(cachePath, JSON.stringify(cache, null, 2));
  await sleep(180);
  return obj;
}

async function ensureArticleComponent() {
  const comps = await mapi(`/components/`);
  if ((comps?.components ?? []).find((c: { name: string }) => c.name === "article")) return;
  await mapi(`/components/`, {
    method: "POST",
    body: JSON.stringify({
      component: {
        name: "article", display_name: "Article", is_root: true, is_nestable: false,
        schema: {
          title: { type: "text" },
          teaser: { type: "textarea" },
          author: { type: "text" },
          date: { type: "text" },
          tags: { type: "options" },
          hero_image: { type: "asset", filetypes: ["images"] },
          body: { type: "markdown", description: "Article body (Markdown). References are appended here." },
        },
      },
    }),
  });
  console.log("created article component");
  await sleep(200);
}

async function ensureFolder(): Promise<number> {
  const found = await mapi(`/stories?with_slug=articles`);
  if (found?.stories?.length) return found.stories[0].id;
  const created = await mapi(`/stories`, { method: "POST", body: JSON.stringify({ story: { name: "Articles", slug: "articles", is_folder: true } }) });
  console.log("created articles folder");
  await sleep(180);
  return created.story.id;
}

function buildBody(raw: string, references?: string[]): string {
  // Drop the leading H1 (the title is rendered in the header band).
  let body = raw.replace(/^\s*#\s+.*(\r?\n)+/, "").trim();
  if (Array.isArray(references) && references.length) {
    body += "\n\n## References\n\n" + references.map((r, i) => `${i + 1}. ${r}`).join("\n\n");
  }
  return body;
}

async function main() {
  await ensureArticleComponent();
  const folderId = await ensureFolder();

  const files = readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".md")).sort();
  for (const file of files) {
    const { data, content } = matter(readFileSync(join(ARTICLES_DIR, file), "utf8"));
    const slug: string = data.storyblok?.slug || file.replace(/^\d+-/, "").replace(/\.md$/, "");
    let hero: { filename: string } | null = null;
    if (data.hero_image?.file) {
      hero = await uploadHero(data.hero_image.file, data.hero_image);
    }
    const heroObj = hero
      ? { fieldtype: "asset", filename: hero.filename, alt: data.hero_image?.alt ?? "", title: data.hero_image?.title ?? "", copyright: data.hero_image?.copyright ?? "", source: data.hero_image?.source ?? "", name: "" }
      : null;

    const storyContent = {
      component: "article",
      title: data.title ?? "",
      teaser: data.teaser ?? "",
      author: data.author ?? "",
      date: data.date ?? "",
      tags: data.tags ?? [],
      hero_image: heroObj,
      body: buildBody(content, data.references),
    };

    const fullSlug = `articles/${slug}`;
    const existing = await mapi(`/stories?with_slug=${encodeURIComponent(fullSlug)}`);
    const publish = data.storyblok?.publish === false ? 0 : 1;
    if (existing?.stories?.length) {
      const id = existing.stories[0].id;
      await mapi(`/stories/${id}`, { method: "PUT", body: JSON.stringify({ story: { name: data.title, slug, content: storyContent }, publish }) });
      console.log(`  updated: ${fullSlug}`);
    } else {
      await mapi(`/stories`, { method: "POST", body: JSON.stringify({ story: { name: data.title, slug, parent_id: folderId, content: storyContent }, publish }) });
      console.log(`  created: ${fullSlug}`);
    }
    await sleep(200);
  }
  console.log(`\nDone. ${files.length} articles published.`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
