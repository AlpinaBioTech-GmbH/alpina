// The `category` content type: a category landing page (e.g. "TNF-alpha" or
// "Drug ELISAs"). Header band + the products tagged to this category.
import { storyblokEditable, type SbBlokData } from "@storyblok/react/rsc";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ProductCard from "@/components/site/ProductCard";
import { fetchProductsByCategory } from "@/lib/catalog";

type CategoryBlok = {
  _uid: string;
  component: string;
  slug?: string;
  name?: string;
  kind?: string;
  description?: string;
};

export default async function Category({ blok }: { blok: CategoryBlok }) {
  const products = blok.slug ? await fetchProductsByCategory(blok.slug) : [];

  return (
    <main {...storyblokEditable(blok as unknown as SbBlokData)}>
      <section
        style={{ background: "var(--void)", color: "var(--on-contrast)" }}
        className="px-6 pt-20 pb-12 md:pt-28 md:pb-14"
      >
        <div className="mx-auto max-w-5xl">
          <Link
            href="/catalog"
            style={{ fontFamily: "var(--font-mono)", color: "var(--mist)" }}
            className="mb-8 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] transition-colors hover:text-[var(--on-contrast)]"
          >
            <ArrowLeft size={12} />
            All products
          </Link>
          <h1
            className="text-3xl font-semibold leading-tight md:text-4xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {blok.name}
          </h1>
          {blok.description ? (
            <p className="mt-3 max-w-2xl text-base" style={{ color: "var(--mist)" }}>
              {blok.description}
            </p>
          ) : null}
        </div>
      </section>

      <section
        style={{ background: "var(--paper)", color: "var(--ink)" }}
        className="px-6 py-14 md:py-20"
      >
        <div className="mx-auto max-w-5xl">
          <p className="mb-6 text-sm" style={{ color: "var(--ink-2)" }}>
            {products.length} {products.length === 1 ? "kit" : "kits"}
          </p>
          {products.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <ProductCard key={p.uuid} product={p} />
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--ink-2)" }}>
              No kits in this category yet.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
