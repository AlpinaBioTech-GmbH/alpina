// One-off: overwrite the space's default "home" story with the AlpinaBioTech
// home content and publish it. (Storyblok auto-creates an empty Home on space
// creation, which the seed skips as "exists".)
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
const uid = () => `home-${++n}`;

async function mapi(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: TOKEN!, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`MAPI ${res.status} ${path}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const link = (p: string) => ({ url: p, cached_url: p, linktype: "url" });

const content = {
  component: "page",
  body: [
    {
      _uid: uid(),
      component: "hero",
      eyebrow: "Empowering Precision Diagnostics",
      headline: "Bringing ImmunoGuide ELISA technologies to Europe and beyond",
      subhead:
        "Validated ELISA kits for therapeutic drug monitoring and anti-drug antibody detection, for clinical labs, research institutions, and biotech teams. For Research Use Only.",
      cta_label: "Browse ELISA kits",
      cta_href: link("/catalog"),
      layout: "full",
    },
    {
      _uid: uid(),
      component: "product_grid",
      heading: "Featured ELISA kits",
      intro:
        "Drug-level and anti-drug antibody assays across TNF-alpha, VEGF, EGFR, HER2, and more.",
      show_filter: false,
      limit: "6",
    },
    {
      _uid: uid(),
      component: "cta_band",
      heading: "Need a specific assay or a quote?",
      subhead:
        "Tell us the analyte and your application, and we will get back to you with pricing and availability.",
      cta_label: "Request a quote",
      cta_href: link("/contact"),
    },
  ],
};

async function main() {
  const found = await mapi(`/stories?with_slug=home`);
  const existing = found?.stories?.[0];
  if (!existing) {
    const created = await mapi(`/stories`, {
      method: "POST",
      body: JSON.stringify({ story: { name: "Home", slug: "home", content }, publish: 1 }),
    });
    console.log("created + published home", created.story.id);
    return;
  }
  await mapi(`/stories/${existing.id}`, {
    method: "PUT",
    body: JSON.stringify({ story: { name: "Home", slug: "home", content }, publish: 1 }),
  });
  console.log("updated + published home", existing.id);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
