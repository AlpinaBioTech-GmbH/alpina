// The `product_grid` section blok. Two modes:
//  - show_filter: full filterable catalog (used on the /products index).
//  - otherwise: a few featured kits + a "View all products" link (home page).
import { storyblokEditable, type SbBlokData } from "@storyblok/react/rsc";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ProductCard from "@/components/site/ProductCard";
import ProductFilter from "@/components/site/ProductFilter";
import { fetchProducts, fetchCategories } from "@/lib/catalog";

type ProductGridBlok = {
  _uid: string;
  component: string;
  heading?: string;
  intro?: string;
  show_filter?: boolean;
  limit?: number | string;
};

export default async function ProductGrid({ blok }: { blok: ProductGridBlok }) {
  const products = await fetchProducts();
  const categories = blok.show_filter ? await fetchCategories() : [];
  const limit = Number(blok.limit) || 6;

  return (
    <section
      {...storyblokEditable(blok as unknown as SbBlokData)}
      style={{ background: "var(--paper)", color: "var(--ink)" }}
      className="px-6 py-14 md:py-20"
    >
      <div className="mx-auto max-w-5xl">
        {blok.heading ? (
          <h2
            className="text-2xl font-semibold md:text-3xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {blok.heading}
          </h2>
        ) : null}
        {blok.intro ? (
          <p className="mt-2 max-w-2xl text-base" style={{ color: "var(--ink-2)" }}>
            {blok.intro}
          </p>
        ) : null}

        <div className="mt-8">
          {blok.show_filter ? (
            <ProductFilter products={products} categories={categories} />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {products.slice(0, limit).map((p) => (
                  <ProductCard key={p.uuid} product={p} />
                ))}
              </div>
              <Link
                href="/catalog"
                className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:gap-2.5"
                style={{ color: "var(--signal)" }}
              >
                View all products
                <ArrowRight size={15} />
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
