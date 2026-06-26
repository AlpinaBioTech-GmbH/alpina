// A single ELISA-kit product card for catalog grids.
import Link from "next/link";
import { type ProductItem } from "@/lib/catalog";

export default function ProductCard({ product }: { product: ProductItem }) {
  const typeLabel =
    product.productType === "ADA ELISA" ? "ADA ELISA" : "Drug ELISA";
  return (
    <Link
      href={`/${product.fullSlug}`}
      className="group flex flex-col rounded-none border p-5 transition-colors hover:border-[var(--signal)]"
      style={{ background: "var(--paper-2)", borderColor: "var(--hair)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="rounded-none px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide"
          style={{
            background: "var(--signal)",
            color: "var(--on-signal)",
          }}
        >
          {typeLabel}
        </span>
        {product.sku ? (
          <span
            className="text-xs"
            style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}
          >
            {product.sku}
          </span>
        ) : null}
      </div>
      <h3
        className="mt-3 text-base font-semibold leading-snug"
        style={{ color: "var(--ink)" }}
      >
        {product.name}
      </h3>
      {product.analyte ? (
        <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
          Analyte: {product.analyte}
        </p>
      ) : null}
      <span
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium transition-colors group-hover:gap-2"
        style={{ color: "var(--signal)" }}
      >
        View kit
      </span>
    </Link>
  );
}
