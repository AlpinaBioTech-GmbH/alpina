// One-off: bring already-seeded legal pages into the proper format.
//  - rich_text component schema -> { heading, last_updated, content }
//  - legal pages -> a single rich_text blok with its own heading, NO hero
//  - about + legal bodies were stored under `text`; the component reads
//    `content`, so move them to `content` (otherwise the body renders blank)
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const TOKEN = process.env.STORYBLOK_MANAGEMENT_TOKEN?.trim();
const SPACE = process.env.STORYBLOK_SPACE_ID?.trim();
const REGION = (process.env.NEXT_PUBLIC_STORYBLOK_REGION || "eu").toLowerCase();
const HOST: Record<string, string> = {
  eu: "https://mapi.storyblok.com",
  us: "https://api-us.storyblok.com",
  ap: "https://api-ap.storyblok.com",
  ca: "https://api-ca.storyblok.com",
  cn: "https://app.storyblokchina.com",
};
const BASE = `${HOST[REGION] ?? HOST.eu}/v1/spaces/${SPACE}`;

let n = 0;
const uid = () => `legal-${++n}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mapi(path: string, init: RequestInit = {}, attempt = 0): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: TOKEN!, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (res.status === 429 && attempt < 6) {
    await sleep(1000 * (attempt + 1));
    return mapi(path, init, attempt + 1);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`MAPI ${res.status} ${path}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const rt = (paras: string[]) => ({
  type: "doc",
  content: paras.map((t) => ({ type: "paragraph", content: t ? [{ type: "text", text: t }] : [] })),
});
const link = (p: string) => ({ url: p, cached_url: p, linktype: "url" });

async function putStory(slug: string, name: string, body: unknown[]) {
  const found = await mapi(`/stories?with_slug=${encodeURIComponent(slug)}`);
  const story = found?.stories?.[0];
  if (!story) {
    console.log(`  not found, skipping: ${slug}`);
    return;
  }
  await mapi(`/stories/${story.id}`, {
    method: "PUT",
    body: JSON.stringify({ story: { name, slug, content: { component: "page", body } }, publish: 1 }),
  });
  console.log(`  updated: ${slug}`);
  await sleep(250);
}

const legalBlok = (heading: string, paras: string[]) => ({
  _uid: uid(),
  component: "rich_text",
  heading,
  content: rt(paras),
});

async function main() {
  // 1. rich_text component schema -> heading + last_updated + content
  const comps = await mapi(`/components/`);
  const rich = (comps?.components ?? []).find((c: { name: string }) => c.name === "rich_text");
  if (rich) {
    await mapi(`/components/${rich.id}`, {
      method: "PUT",
      body: JSON.stringify({
        component: {
          ...rich,
          schema: {
            heading: { type: "text" },
            last_updated: { type: "text" },
            content: { type: "richtext" },
          },
        },
      }),
    });
    console.log("  updated rich_text component schema");
    await sleep(250);
  }

  // 2. Legal pages: single rich_text with heading, no hero.
  await putStory("imprint", "Imprint", [
    legalBlok("Imprint", [
      "AlpinaBioTech GmbH",
      "Schauinslandstrasse 12, 76199 Karlsruhe, Germany",
      "Email: info@alpinabiotech.com",
      "Commercial Register: Mannheim, HRB 757253",
    ]),
  ]);

  const stubs: [string, string][] = [
    ["privacy-policy", "Privacy Policy"],
    ["terms-and-conditions", "Terms & Conditions"],
    ["refund-policy", "Refund Policy"],
    ["shipping-policy", "Shipping Policy"],
    ["accessibility-statement", "Accessibility Statement"],
  ];
  for (const [slug, name] of stubs) {
    await putStory(slug, name, [
      legalBlok(name, [`Add the full ${name.toLowerCase()} text here in the Storyblok editor.`]),
    ]);
  }

  // 3. About: keep its hero, but move the body to `content` so it renders.
  await putStory("about", "About", [
    {
      _uid: uid(),
      component: "hero",
      eyebrow: "About AlpinaBioTech",
      headline: "Shaping the future of diagnostics with precision and reliability",
      layout: "split",
    },
    {
      _uid: uid(),
      component: "rich_text",
      content: rt([
        "AlpinaBioTech GmbH is the exclusive European commercial distributor for ImmunoGuide. We supply validated ELISA kits to clinical laboratories, research institutions, and biotech companies.",
        "All products are manufactured by ImmunoGuide under ISO 13485 certification, with a focus on inflammation, oncology, and rare diseases.",
        "Our catalog covers both drug-level ELISAs for therapeutic drug monitoring and anti-drug antibody (ADA) assays. All kits are supplied For Research Use Only.",
      ]),
    },
    {
      _uid: uid(),
      component: "cta_band",
      heading: "Work with us",
      subhead: "Questions about a kit, distribution, or a custom requirement? Get in touch.",
      cta_label: "Contact us",
      cta_href: link("/contact"),
    },
  ]);

  console.log("Done.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
