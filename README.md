# AlpinaBioTech

The AlpinaBioTech website: a Storyblok-driven ELISA-kit catalog with a request-a-quote
flow, built on the `web-template` starter (Next.js 16, React 19, Tailwind 4, shadcn,
Supabase, Storyblok, dark/light themes). Includes the full content model and admin
features carried over from the starter (AI assistant, content tooling) - all optional.

## What's here

- **Product catalog** - 37 ELISA kits across 12 categories (drug-level ELISAs for
  therapeutic drug monitoring and anti-drug antibody / ADA ELISAs), modelled as
  Storyblok `product` and `category` content types.
  - `/catalog` - filterable index (by assay type and molecular target)
  - `/products/<slug>` - kit detail (specs table + request-a-quote form)
  - `/categories/<slug>` - kits for a target (TNF-alpha, VEGF, EGFR, HER2, ...)
- **Pages** - home, about, contact, imprint, and legal-page stubs, all in Storyblok.
- **Request a quote** - the product/contact forms write to Supabase (`contact_submissions`)
  and email via Resend. No cart/checkout (matches the current site).
- **Inherited from the starter** - admin area, Claude assistant + RAG, article/social
  pipelines. All optional and dormant until their env vars are set.

## Content model (Storyblok)

| Content type   | Where it lives        | Rendered by                              |
|----------------|-----------------------|------------------------------------------|
| `product`      | `products/<slug>`     | `src/components/storyblok/Product.tsx`    |
| `category`     | `categories/<slug>`   | `src/components/storyblok/Category.tsx`   |
| `product_grid` | blok on `page`        | `src/components/storyblok/ProductGrid.tsx`|
| `page`         | top-level slugs       | `src/components/storyblok/Page.tsx`       |
| `global_config`| `global`              | header/footer nav                         |

Catalog fetching + filtering: `src/lib/catalog.ts`.

## Quick start

```bash
npm install
cp .env.example .env.local     # set Storyblok + Supabase (+ Resend for emails)
npm run certs                  # local HTTPS for the Storyblok Visual Editor (mkcert)
npm run dev                    # https://localhost:3000
```

`npm run dev:http` runs plain HTTP if you do not need the Visual Editor.

## Storyblok space + content

The catalog content was scraped into `data/products.json` and pushed to a Storyblok
space. To recreate the space and content from scratch:

```bash
# 1. Put your Storyblok Personal Access Token in .env.local:
#    STORYBLOK_PERSONAL_ACCESS_TOKEN=...
npm run create-space          # creates the space, writes tokens + space id to .env.local
npm run seed                  # defines component schemas, pushes categories + products + pages
```

If you already have a space (space id + management token in `.env.local`), skip
`create-space` and just `npm run seed`. The seed is idempotent: it skips stories that
already exist. Storyblok auto-creates an empty `home` story on space creation; if your
home page is blank, run `npx tsx scripts/fix-home.ts` to populate + publish it.

After seeding, set the space **preview URL** to `https://localhost:3000/`.

## Rebrand / edit

- `brand.config.ts` - name, tagline, contact, company registration, ImmunoGuide link.
- `content.config.ts` - assistant/writer voice (only if you use those features).
- `src/app/globals.css` (bottom block) - the medical-blue brand accent.
- Content itself lives in Storyblok: edit pages, products, and nav in the Visual Editor.

## Deploy (Vercel)

Import the repo, set the env vars from `.env.example` (Storyblok + Supabase + Resend at
minimum), and deploy. The catalog is served from Storyblok at request time.
