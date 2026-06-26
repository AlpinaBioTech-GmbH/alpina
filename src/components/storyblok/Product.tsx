// The `product` content type: an ELISA-kit detail page. Dark header band with
// the kit name + analyte, a specifications table, the intended-use text, and a
// request-a-quote form. All kits are Research Use Only.
import {
  storyblokEditable,
  type SbBlokData,
} from "@storyblok/react/rsc";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import QuoteDrawer from "@/components/site/QuoteDrawer";
import ProductGallery from "@/components/site/ProductGallery";
import ProductInfoSections, { type InfoSection } from "@/components/site/ProductInfoSections";
import { fetchCategories } from "@/lib/catalog";

type Asset = { filename?: string | null; alt?: string | null };
type ProductBlok = {
  _uid: string;
  component: string;
  name?: string;
  analyte?: string;
  product_type?: string;
  categories?: string[];
  description?: string;
  price?: string;
  sku?: string;
  sample_type?: string;
  sensitivity?: string;
  format?: string;
  tests?: string;
  regulatory?: string;
  image?: Asset;
  images?: Asset[];
  info_sections?: InfoSection[];
  source_url?: string;
};

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div
      className="grid grid-cols-[10rem_1fr] gap-3 border-b py-2.5 text-sm"
      style={{ borderColor: "var(--hair)" }}
    >
      <dt style={{ color: "var(--ink-2)" }}>{label}</dt>
      <dd style={{ color: "var(--ink)" }}>{value}</dd>
    </div>
  );
}

export default async function Product({ blok }: { blok: ProductBlok }) {
  const isAda = blok.product_type === "ADA ELISA";
  const typeLabel = isAda ? "Anti-drug antibody (ADA) ELISA" : "Drug-level ELISA";

  const allCats = await fetchCategories();
  const catName = (slug: string) =>
    allCats.find((c) => c.slug === slug)?.name ?? slug;
  const cats = blok.categories ?? [];
  const hasGallery = (blok.images?.length ?? 0) > 0;

  return (
    <main {...storyblokEditable(blok as unknown as SbBlokData)}>
      {/* Header band */}
      <section
        style={{ background: "var(--void)", color: "var(--on-contrast)" }}
        className="px-6 pt-20 pb-12 md:pt-28 md:pb-14"
      >
        <div className="mx-auto max-w-3xl">
          <Link
            href="/catalog"
            style={{ fontFamily: "var(--font-mono)", color: "var(--mist)" }}
            className="mb-8 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] transition-colors hover:text-[var(--on-contrast)]"
          >
            <ArrowLeft size={12} />
            All products
          </Link>
          <p
            style={{ fontFamily: "var(--font-mono)", color: "var(--signal)" }}
            className="text-xs uppercase tracking-[0.14em]"
          >
            {typeLabel}
          </p>
          <h1
            className="mt-3 text-3xl font-semibold leading-tight md:text-4xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {blok.name}
          </h1>
          {blok.analyte ? (
            <p className="mt-2 text-lg" style={{ color: "var(--mist)" }}>
              Analyte: {blok.analyte}
            </p>
          ) : null}
        </div>
      </section>

      {/* Body */}
      <section
        style={{ background: "var(--paper)", color: "var(--ink)" }}
        className="px-6 py-14 md:py-20"
      >
        <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-[1fr_22rem]">
          {/* Right column: image slider, then the quote panel below it. Sticks
              to the top on wide screens so it stays visible while the
              specifications scroll. On mobile it sits above the content. */}
          <aside className="space-y-8 md:col-start-2 md:row-start-1 md:self-start md:sticky md:top-24">
            {hasGallery ? (
              <ProductGallery images={blok.images!} title={blok.name} />
            ) : null}
            <QuoteDrawer productName={blok.name} sku={blok.sku} />
          </aside>

          {/* Content + documentation */}
          <div className="min-w-0 md:col-start-1 md:row-start-1">
            {blok.description ? (
              <div className="max-w-prose">
                <h2 className="text-lg font-semibold">Description</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed" style={{ color: "var(--ink-2)" }}>
                  {blok.description}
                </p>
              </div>
            ) : null}

            <h2 className="mt-10 text-lg font-semibold">Specifications</h2>
            <dl className="mt-3">
              <Row label="Catalog no." value={blok.sku} />
              <Row label="Analyte" value={blok.analyte} />
              <Row label="Assay type" value={typeLabel} />
              <Row label="Sample type" value={blok.sample_type} />
              <Row label="Sensitivity" value={blok.sensitivity} />
              <Row label="Format" value={blok.format} />
              <Row label="Tests per kit" value={blok.tests} />
              <Row label="Regulatory" value={blok.regulatory || "For Research Use Only (RuO)"} />
            </dl>

            {cats.length ? (
              <div className="mt-8 flex flex-wrap gap-2">
                {cats.map((slug) => (
                  <Link
                    key={slug}
                    href={`/categories/${slug}`}
                    className="rounded-none border px-3 py-1 text-xs transition-colors hover:border-[var(--signal)] hover:text-[var(--signal)]"
                    style={{ borderColor: "var(--hair)", color: "var(--ink-2)" }}
                  >
                    {catName(slug)}
                  </Link>
                ))}
              </div>
            ) : null}

            {blok.info_sections && blok.info_sections.length > 0 ? (
              <ProductInfoSections sections={blok.info_sections} />
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
