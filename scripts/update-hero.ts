// 1) Update the Storyblok `hero` component schema with the media settings
//    (layout full/right, ratio 1:1/4:3/3:4, Mux video url + poster, autoplay,
//    image/video assets). 2) Upload the AlpinaBioTech logo to Storyblok assets.
//    3) Set it on the home hero (split layout) and publish.
//
//   npx tsx scripts/update-hero.ts
import { config } from "dotenv";
config({ path: ".env.local" });
config();
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

let n = 0;
const uid = () => `hero-${++n}`;

async function mapi(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: TOKEN!, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`MAPI ${res.status} ${path}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const HERO_SCHEMA = {
  eyebrow: { type: "text" },
  headline: { type: "text" },
  subhead: { type: "textarea" },
  cta_label: { type: "text" },
  cta_href: { type: "multilink" },
  layout: {
    type: "option", default_value: "full",
    description: "Media placement: full-bleed background, or framed to the right.",
    options: [
      { _uid: uid(), name: "Full (background)", value: "full" },
      { _uid: uid(), name: "Right (split)", value: "split" },
    ],
  },
  media_ratio: {
    type: "option", default_value: "square",
    description: "Framed media aspect ratio on desktop (split layout).",
    options: [
      { _uid: uid(), name: "Square (1:1)", value: "square" },
      { _uid: uid(), name: "Landscape (4:3)", value: "landscape" },
      { _uid: uid(), name: "Portrait (3:4)", value: "portrait" },
    ],
  },
  hero_image: { type: "asset", filetypes: ["images"] },
  hero_video: { type: "asset", filetypes: ["videos"] },
  video_url: { type: "text", description: "Mux playback URL (https://stream.mux.com/<PLAYBACK_ID>.m3u8). Takes priority over an image." },
  video_poster: { type: "text", description: "Poster image URL, e.g. https://image.mux.com/<PLAYBACK_ID>/thumbnail.jpg" },
  autoplay: { type: "boolean", description: "Autoplay framed video as a muted loop (split). Off = click-to-play." },
};

const IMAGE_URL = "https://static.wixstatic.com/media/a87ace_82bc09088e7e415286eef5d4a8ff844f~mv2.jpg";

async function uploadAsset(): Promise<{ filename: string; alt: string }> {
  const res = await fetch(IMAGE_URL);
  if (!res.ok) throw new Error(`download image ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(bytes).metadata();
  const filename = "alpinabiotech-logo.jpg";
  const reg = await mapi(`/assets/`, {
    method: "POST",
    body: JSON.stringify({ filename, ...(meta.width && meta.height ? { size: `${meta.width}x${meta.height}` } : {}) }),
  });
  const fields = (reg.fields ?? {}) as Record<string, string>;
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append("file", new Blob([bytes], { type: "image/jpeg" }), filename);
  const s3 = await fetch(reg.post_url, { method: "POST", body: form });
  if (!s3.ok) throw new Error(`S3 upload ${s3.status}`);
  await mapi(`/assets/${reg.id}/finish_upload`);
  let url: string | null = null;
  try { url = (await mapi(`/assets/${reg.id}`))?.filename ?? null; } catch { /* fall back */ }
  url = url || reg.pretty_url || reg.filename;
  if (url?.startsWith("//")) url = `https:${url}`;
  if (!url) throw new Error("no asset url");
  return { filename: url, alt: "AlpinaBioTech" };
}

async function main() {
  // 1) hero component schema
  const comps = await mapi(`/components/`);
  const hero = (comps?.components ?? []).find((c: { name: string }) => c.name === "hero");
  if (!hero) throw new Error("hero component not found in space");
  await mapi(`/components/${hero.id}`, {
    method: "PUT",
    body: JSON.stringify({ component: { ...hero, schema: HERO_SCHEMA } }),
  });
  console.log("updated hero component schema");

  // 2) upload logo
  const asset = await uploadAsset();
  console.log("uploaded asset:", asset.filename);

  // 3) set on home hero (split, landscape), publish
  const found = await mapi(`/stories?with_slug=home`);
  const ref = found?.stories?.[0];
  if (!ref) throw new Error("home story not found");
  // The list endpoint omits full content; fetch the single story for its body.
  const story = (await mapi(`/stories/${ref.id}`)).story;
  const content = story.content as { body?: Record<string, unknown>[] };
  const body = content.body ?? [];
  const heroBlok = body.find((b) => b.component === "hero");
  if (!heroBlok) throw new Error("home has no hero blok");
  heroBlok.layout = "split";
  heroBlok.media_ratio = "landscape";
  heroBlok.hero_image = { fieldtype: "asset", filename: asset.filename, alt: asset.alt };
  await mapi(`/stories/${story.id}`, {
    method: "PUT",
    body: JSON.stringify({ story: { name: story.name, slug: story.slug, content }, publish: 1 }),
  });
  console.log("home hero updated (split + landscape + image) and published");
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
