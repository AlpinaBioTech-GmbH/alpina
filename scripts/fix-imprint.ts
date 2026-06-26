// Populate the Imprint page with AlpinaBioTech's real company details and a
// "last updated" date. Uses the rich_text blok's heading + last_updated +
// content fields (no hero), matching the legal-page format.
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

// Set this when the imprint text materially changes.
const LAST_UPDATED = process.env.IMPRINT_LAST_UPDATED || "2026-06-25";

async function mapi(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: TOKEN!, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`MAPI ${res.status} ${path}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const h = (text: string) => ({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] });

const content = {
  type: "doc",
  content: [
    p("AlpinaBioTech GmbH i.G."),
    p("Schauinslandstrasse 12, 76199 Karlsruhe, Germany"),

    h("Contact"),
    p("Email: info@alpinabiotech.com"),
    p("Web: www.alpinabiotech.com"),
    p("Phone: pending"),

    h("Managing Directors"),
    p("Dr. Orhan Aybay"),
    p("Enes Faruk Goecer"),

    h("Commercial Register"),
    p("Amtsgericht Mannheim, HRB 757253"),

    h("VAT Identification Number"),
    p("DE461960437"),

    h("Liability for Content"),
    p(
      "We compile the content of these pages with care, but we cannot guarantee that it is accurate, complete, or up to date. As a service provider we are responsible for our own content under the general laws; we are not obliged to monitor third-party information that we transmit or store.",
    ),

    h("Liability for Links"),
    p(
      "Our site contains links to external websites over whose content we have no control, so we cannot accept responsibility for it. The respective provider is always responsible for the content of linked pages. Linked pages were checked for legal violations at the time of linking.",
    ),

    h("Copyright"),
    p(
      "The content and works on these pages are protected by copyright. Reproduction, editing, distribution, or any use beyond the limits of copyright requires our prior written consent.",
    ),
  ],
};

async function main() {
  const found = await mapi(`/stories?with_slug=imprint`);
  const story = found?.stories?.[0];
  if (!story) throw new Error("imprint story not found");
  const body = [
    {
      _uid: "imprint-rt",
      component: "rich_text",
      heading: "Imprint",
      last_updated: LAST_UPDATED,
      content,
    },
  ];
  await mapi(`/stories/${story.id}`, {
    method: "PUT",
    body: JSON.stringify({
      story: { name: "Imprint", slug: "imprint", content: { component: "page", body } },
      publish: 1,
    }),
  });
  console.log(`updated + published imprint (last updated ${LAST_UPDATED})`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
