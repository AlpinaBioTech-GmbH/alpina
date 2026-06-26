// Make /contact match the legal pages: no hero, just the contact_form blok
// (which renders its own eyebrow + heading + lead on the light base).
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const TOKEN = process.env.STORYBLOK_MANAGEMENT_TOKEN?.trim();
const SPACE = process.env.STORYBLOK_SPACE_ID?.trim();
const REGION = (process.env.NEXT_PUBLIC_STORYBLOK_REGION || "eu").toLowerCase();
const HOST: Record<string, string> = {
  eu: "https://mapi.storyblok.com", us: "https://api-us.storyblok.com",
  ap: "https://api-ap.storyblok.com", ca: "https://api-ca.storyblok.com",
  cn: "https://app.storyblokchina.com",
};
const BASE = `${HOST[REGION] ?? HOST.eu}/v1/spaces/${SPACE}`;

async function mapi(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: TOKEN!, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`MAPI ${res.status} ${path}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const found = await mapi(`/stories?with_slug=contact`);
  const ref = found?.stories?.[0];
  if (!ref) throw new Error("contact story not found");
  const story = (await mapi(`/stories/${ref.id}`)).story;
  story.content = {
    component: "page",
    body: [
      {
        _uid: "contact-form",
        component: "contact_form",
        heading: "Request a quote or ask a question",
        lead: "Tell us the kit or analyte you need and your intended application. We typically reply within one business day.",
      },
    ],
  };
  await mapi(`/stories/${ref.id}`, {
    method: "PUT",
    body: JSON.stringify({ story: { name: story.name, slug: story.slug, content: story.content }, publish: 1 }),
  });
  console.log("contact page updated (no hero) and published");
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
