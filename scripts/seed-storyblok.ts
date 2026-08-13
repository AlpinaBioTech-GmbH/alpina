// Seed the AlpinaBioTech Storyblok space: define component schemas, then push
// all catalog content (12 categories, 37 ELISA-kit products) plus home, about,
// contact, a filterable products index, and legal pages.
//
// Usage:  npm run create-space   (once, to make the space + tokens)
//         npm run seed
// Reads STORYBLOK_SPACE_ID + STORYBLOK_MANAGEMENT_TOKEN (the PAT) from .env.local
// and the scraped catalog from data/products.json.
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { readFileSync } from "node:fs";

const TOKEN = process.env.STORYBLOK_MANAGEMENT_TOKEN?.trim();
const SPACE = process.env.STORYBLOK_SPACE_ID?.trim();
const REGION = (process.env.NEXT_PUBLIC_STORYBLOK_REGION || "eu").toLowerCase();

const MAPI_HOST: Record<string, string> = {
  eu: "https://mapi.storyblok.com",
  us: "https://api-us.storyblok.com",
  ap: "https://api-ap.storyblok.com",
  ca: "https://api-ca.storyblok.com",
  cn: "https://app.storyblokchina.com",
};

if (!TOKEN || !SPACE) {
  console.error(
    "Missing STORYBLOK_MANAGEMENT_TOKEN and/or STORYBLOK_SPACE_ID. Run `npm run create-space` first.",
  );
  process.exit(1);
}

const BASE = `${MAPI_HOST[REGION] ?? MAPI_HOST.eu}/v1/spaces/${SPACE}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mapi(path: string, init: RequestInit = {}, attempt = 0): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: TOKEN!,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  // Storyblok management API rate-limits at ~6 req/sec. Back off and retry.
  if (res.status === 429 && attempt < 6) {
    await sleep(1000 * (attempt + 1));
    return mapi(path, init, attempt + 1);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`MAPI ${res.status} ${path}: ${text}`);
  return text ? JSON.parse(text) : null;
}

let uidN = 0;
const uid = () => `seed-${++uidN}`;

// --- Catalog data ----------------------------------------------------------
type Product = {
  slug: string;
  name: string;
  analyte: string;
  product_type: string;
  category_slugs: string[];
  description: string;
  price: string;
  specs: Record<string, string | null>;
  image_url?: string;
  source_url?: string;
};
type Category = { slug: string; name: string; kind: string; description: string };

const catalog = JSON.parse(
  readFileSync(new URL("../data/products.json", import.meta.url), "utf8"),
) as { categories: Category[]; products: Product[] };

// --- Richtext helper -------------------------------------------------------
function rt(paragraphs: string[]) {
  return {
    type: "doc",
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: text ? [{ type: "text", text }] : [],
    })),
  };
}

// --- Component schemas -----------------------------------------------------
const PRODUCT_TYPE_OPTIONS = [
  { _uid: uid(), name: "Drug-level ELISA", value: "drug ELISA" },
  { _uid: uid(), name: "Anti-drug antibody (ADA) ELISA", value: "ADA ELISA" },
];
const CATEGORY_OPTIONS = catalog.categories.map((c) => ({
  _uid: uid(),
  name: c.name,
  value: c.slug,
}));

const COMPONENTS: Record<string, { is_root: boolean; is_nestable: boolean; schema: Record<string, unknown> }> = {
  nav_card: {
    is_root: false,
    is_nestable: true,
    schema: {
      name: { type: "text" },
      one_liner: { type: "text" },
      image: { type: "asset", filetypes: ["images"] },
      href: { type: "multilink" },
    },
  },
  nav_item: {
    is_root: false,
    is_nestable: true,
    schema: {
      label: { type: "text" },
      href: { type: "multilink" },
      // Optional submenu. With children, the item becomes a dropdown trigger
      // (image mega-menu if cards have images, else a compact text dropdown).
      children: {
        type: "bloks",
        restrict_components: true,
        component_whitelist: ["nav_card"],
        description: "Optional submenu items (renders a dropdown).",
      },
    },
  },
  global_config: {
    is_root: true,
    is_nestable: false,
    schema: {
      nav_items: { type: "bloks", restrict_components: true, component_whitelist: ["nav_item"] },
      footer_links: { type: "bloks", restrict_components: true, component_whitelist: ["nav_item"] },
      contact_email: { type: "text" },
      logo_light: { type: "asset", filetypes: ["images"] },
      logo_dark: { type: "asset", filetypes: ["images"] },
      favicon: { type: "asset", filetypes: ["images"] },
    },
  },
  hero: {
    is_root: false,
    is_nestable: true,
    schema: {
      eyebrow: { type: "text" },
      headline: { type: "text" },
      subhead: { type: "textarea" },
      cta_label: { type: "text" },
      cta_href: { type: "multilink" },
      layout: {
        type: "option",
        default_value: "full",
        description: "Media placement: full-bleed background, or framed to the right.",
        options: [
          { _uid: uid(), name: "Full (background)", value: "full" },
          { _uid: uid(), name: "Right (split)", value: "split" },
        ],
      },
      media_ratio: {
        type: "option",
        default_value: "square",
        description: "Framed media aspect ratio on desktop (split layout).",
        options: [
          { _uid: uid(), name: "Square (1:1)", value: "square" },
          { _uid: uid(), name: "Landscape (4:3)", value: "landscape" },
          { _uid: uid(), name: "Portrait (3:4)", value: "portrait" },
        ],
      },
      hero_image: { type: "asset", filetypes: ["images"] },
      hero_video: { type: "asset", filetypes: ["videos"] },
      video_url: {
        type: "text",
        description: "Mux playback URL (https://stream.mux.com/<PLAYBACK_ID>.m3u8) or any .m3u8 URL. Takes priority over an image.",
      },
      video_poster: {
        type: "text",
        description: "Poster image URL, e.g. https://image.mux.com/<PLAYBACK_ID>/thumbnail.jpg",
      },
      autoplay: {
        type: "boolean",
        description: "Autoplay the framed video as a muted loop (split layout). Off = click-to-play with controls.",
      },
    },
  },
  rich_text: {
    is_root: false,
    is_nestable: true,
    schema: {
      heading: { type: "text" },
      last_updated: { type: "text" },
      content: { type: "richtext" },
    },
  },
  cta_band: {
    is_root: false,
    is_nestable: true,
    schema: {
      heading: { type: "text" },
      subhead: { type: "textarea" },
      cta_label: { type: "text" },
      cta_href: { type: "multilink" },
    },
  },
  contact_form: {
    is_root: false,
    is_nestable: true,
    schema: { heading: { type: "text" }, intro: { type: "textarea" } },
  },
  product_grid: {
    is_root: false,
    is_nestable: true,
    schema: {
      heading: { type: "text" },
      intro: { type: "textarea" },
      show_filter: { type: "boolean" },
      limit: { type: "number" },
    },
  },
  page: {
    is_root: true,
    is_nestable: false,
    schema: {
      body: {
        type: "bloks",
        restrict_components: true,
        component_whitelist: ["hero", "rich_text", "cta_band", "contact_form", "product_grid"],
      },
    },
  },
  category: {
    is_root: true,
    is_nestable: false,
    schema: {
      slug: { type: "text" },
      name: { type: "text" },
      kind: {
        type: "option",
        options: [
          { _uid: uid(), name: "Functional", value: "functional" },
          { _uid: uid(), name: "Target", value: "target" },
        ],
      },
      description: { type: "textarea" },
    },
  },
  product: {
    is_root: true,
    is_nestable: false,
    schema: {
      name: { type: "text" },
      analyte: { type: "text" },
      product_type: { type: "option", options: PRODUCT_TYPE_OPTIONS },
      categories: { type: "options", options: CATEGORY_OPTIONS },
      description: { type: "textarea" },
      price: { type: "text" },
      sku: { type: "text" },
      sample_type: { type: "text" },
      sensitivity: { type: "text" },
      format: { type: "text" },
      tests: { type: "text" },
      regulatory: { type: "text" },
      image: { type: "asset", filetypes: ["images"] },
      images: {
        type: "multiasset",
        filetypes: ["images"],
        description: "Product gallery (main + related). Shown as a left/right slider.",
      },
      info_sections: {
        type: "bloks",
        restrict_components: true,
        component_whitelist: ["info_section"],
        description: "Read-more documentation sections (assay characteristics, references, IFU, SDS, batch/lot).",
      },
      source_url: { type: "text" },
    },
  },
  info_section: {
    is_root: false,
    is_nestable: true,
    schema: {
      title: { type: "text" },
      content_html: { type: "textarea", description: "Section content (HTML), rendered in the read-more accordion." },
      document: { type: "asset", description: "Optional downloadable document (e.g. instructions PDF)." },
    },
  },
};

async function ensureComponents() {
  const existing = await mapi(`/components/`);
  const have = new Set<string>(
    (existing?.components ?? []).map((c: { name: string }) => c.name),
  );
  for (const [name, def] of Object.entries(COMPONENTS)) {
    if (have.has(name)) {
      console.log(`  component exists: ${name}`);
      continue;
    }
    await mapi(`/components/`, {
      method: "POST",
      body: JSON.stringify({
        component: {
          name,
          display_name: name.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),
          is_root: def.is_root,
          is_nestable: def.is_nestable,
          schema: def.schema,
        },
      }),
    });
    console.log(`  created component: ${name}`);
    await sleep(220);
  }
}

// --- Stories ---------------------------------------------------------------
const folderIds = new Map<string, number>();

async function ensureFolder(name: string, slug: string): Promise<number> {
  if (folderIds.has(slug)) return folderIds.get(slug)!;
  const found = await mapi(`/stories?with_slug=${encodeURIComponent(slug)}`);
  if (found?.stories?.length) {
    const id = found.stories[0].id;
    folderIds.set(slug, id);
    return id;
  }
  const created = await mapi(`/stories`, {
    method: "POST",
    body: JSON.stringify({ story: { name, slug, is_folder: true } }),
  });
  const id = created.story.id;
  folderIds.set(slug, id);
  console.log(`  folder: ${slug}`);
  await sleep(220);
  return id;
}

async function createStory(
  story: { name: string; slug: string; content: Record<string, unknown>; parent_id?: number },
) {
  const fullSlug = story.parent_id
    ? `${[...folderIds.entries()].find(([, v]) => v === story.parent_id)?.[0]}/${story.slug}`
    : story.slug;
  const found = await mapi(`/stories?with_slug=${encodeURIComponent(fullSlug)}`);
  if (found?.stories?.length) {
    console.log(`  skip (exists): ${fullSlug}`);
    return;
  }
  await mapi(`/stories`, {
    method: "POST",
    body: JSON.stringify({ story, publish: 1 }),
  });
  console.log(`  story: ${fullSlug}`);
  await sleep(220);
}

const navLink = (path: string, external = false) => ({
  url: external ? path : path,
  cached_url: external ? path : path,
  linktype: "url",
});

const navAsset = (filename: string, alt: string) => ({
  filename,
  alt,
  fieldtype: "asset",
  is_external_url: false,
});

async function seedStories() {
  // Global config -----------------------------------------------------------
  await createStory({
    name: "Global Config",
    slug: "global",
    content: {
      component: "global_config",
      contact_email: "info@alpinabiotech.com",
      nav_items: [
        {
          _uid: uid(),
          component: "nav_item",
          label: "Catalog",
          href: navLink("/catalog"),
          children: [
            { _uid: uid(), component: "nav_card", name: "All kits", one_liner: "Browse the full ELISA-kit catalog", image: navAsset("https://a.storyblok.com/f/294511166656138/1024x705/36b7faba02/alpina-biotech.avif", "ELISA assay plate with sample wells"), href: navLink("/catalog") },
            { _uid: uid(), component: "nav_card", name: "Drug ELISAs", one_liner: "Free drug-level assays for therapeutic drug monitoring", image: navAsset("https://a.storyblok.com/f/294511166656138/768x1024/defaa46413/a87ace-e8338974eb0e45e9b9c06293bafac645-mv2-jpg.jpg", "ELISA kit box with reagents"), href: navLink("/categories/drug-elisas") },
            { _uid: uid(), component: "nav_card", name: "Anti-Drug Antibody ELISAs", one_liner: "ADA / immunogenicity assays", image: navAsset("https://a.storyblok.com/f/294511166656138/950x900/d3fbc373d7/a87ace-48bf2911c9fa4735a9d6354ef9e28a08-mv2-png.png", "Anti-drug antibody standard curve"), href: navLink("/categories/anti-drug-antibody-elisas") },
          ],
        },
        { _uid: uid(), component: "nav_item", label: "About", href: navLink("/about") },
        { _uid: uid(), component: "nav_item", label: "Contact", href: navLink("/contact") },
      ],
      footer_links: [
        { _uid: uid(), component: "nav_item", label: "Imprint", href: navLink("/imprint") },
        { _uid: uid(), component: "nav_item", label: "Privacy Policy", href: navLink("/privacy-policy") },
        { _uid: uid(), component: "nav_item", label: "Terms & Conditions", href: navLink("/terms-and-conditions") },
        { _uid: uid(), component: "nav_item", label: "Shipping Policy", href: navLink("/shipping-policy") },
        { _uid: uid(), component: "nav_item", label: "Refund Policy", href: navLink("/refund-policy") },
        { _uid: uid(), component: "nav_item", label: "Accessibility", href: navLink("/accessibility-statement") },
      ],
    },
  });

  // Home --------------------------------------------------------------------
  await createStory({
    name: "Home",
    slug: "home",
    content: {
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
          cta_href: navLink("/catalog"),
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
          cta_href: navLink("/contact"),
        },
      ],
    },
  });

  // Catalog index (products live under the products/ folder; this is the
  // filterable listing page, kept off the folder slug to avoid a collision).
  await createStory({
    name: "Catalog",
    slug: "catalog",
    content: {
      component: "page",
      body: [
        {
          _uid: uid(),
          component: "hero",
          eyebrow: "Catalog",
          headline: "ELISA kits",
          subhead:
            "Filter by assay type or molecular target. All kits are For Research Use Only.",
          layout: "split",
        },
        {
          _uid: uid(),
          component: "product_grid",
          show_filter: true,
        },
      ],
    },
  });

  // About -------------------------------------------------------------------
  await createStory({
    name: "About",
    slug: "about",
    content: {
      component: "page",
      body: [
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
          cta_href: navLink("/contact"),
        },
      ],
    },
  });

  // Contact. No hero - the contact_form blok renders its own heading + lead on
  // the light base, matching the legal pages.
  await createStory({
    name: "Contact",
    slug: "contact",
    content: {
      component: "page",
      body: [
        {
          _uid: uid(),
          component: "contact_form",
          heading: "Request a quote or ask a question",
          lead: "Tell us the kit or analyte you need and your intended application. We typically reply within one business day.",
        },
      ],
    },
  });

  // Legal pages. Proper format: a single rich_text blok with its own heading on
  // the light prose base - NO hero (a full hero is for marketing pages).
  await createStory({
    name: "Imprint",
    slug: "imprint",
    content: {
      component: "page",
      body: [
        {
          _uid: uid(),
          component: "rich_text",
          heading: "Imprint",
          content: rt([
            "AlpinaBioTech GmbH",
            "Schauinslandstrasse 12, 76199 Karlsruhe, Germany",
            "Email: info@alpinabiotech.com",
            "Commercial Register: Mannheim, HRB 757253",
          ]),
        },
      ],
    },
  });

  const legalStubs = [
    ["Privacy Policy", "privacy-policy"],
    ["Terms & Conditions", "terms-and-conditions"],
    ["Refund Policy", "refund-policy"],
    ["Shipping Policy", "shipping-policy"],
    ["Accessibility Statement", "accessibility-statement"],
  ] as const;
  for (const [name, slug] of legalStubs) {
    await createStory({
      name,
      slug,
      content: {
        component: "page",
        body: [
          {
            _uid: uid(),
            component: "rich_text",
            heading: name,
            content: rt([
              `Add the full ${name.toLowerCase()} text here in the Storyblok editor.`,
            ]),
          },
        ],
      },
    });
  }

  // Categories --------------------------------------------------------------
  const catFolder = await ensureFolder("Categories", "categories");
  for (const c of catalog.categories) {
    await createStory({
      name: c.name,
      slug: c.slug,
      parent_id: catFolder,
      content: {
        component: "category",
        slug: c.slug,
        name: c.name,
        kind: c.kind,
        description: c.description,
      },
    });
  }

  // Products ----------------------------------------------------------------
  const prodFolder = await ensureFolder("Products", "products");
  for (const p of catalog.products) {
    const sp = p.specs || {};
    await createStory({
      name: p.name,
      slug: p.slug,
      parent_id: prodFolder,
      content: {
        component: "product",
        name: p.name,
        analyte: p.analyte,
        product_type: p.product_type,
        categories: p.category_slugs,
        description: p.description,
        price: p.price ?? "",
        sku: sp.sku ?? "",
        sample_type: sp.sample_type ?? "",
        sensitivity: sp.sensitivity ?? "",
        format: sp.format ?? "ELISA (enzyme immunoassay)",
        tests: sp.tests ?? "",
        regulatory: sp.regulatory ?? "RuO - Research Use Only",
        image: p.image_url ? { fieldtype: "asset", filename: p.image_url } : null,
        source_url: p.source_url ?? "",
      },
    });
  }
}

async function main() {
  console.log(`Seeding space ${SPACE} (${REGION})...`);
  console.log("Defining components...");
  await ensureComponents();
  console.log("Pushing stories...");
  // The /products and /categories folders are created before their children;
  // the index `page` stories use the same slugs, so create folders first then
  // skip if a page already claimed the slug.
  await seedStories();
  console.log(
    `\nDone. ${catalog.categories.length} categories + ${catalog.products.length} products pushed.`,
  );
  console.log("Set the space preview URL to https://localhost:3000/ and reload the editor.");
}

main().catch((err) => {
  console.error("Seed failed:", err.message || err);
  process.exit(1);
});
