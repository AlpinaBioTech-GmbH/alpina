// Client-side filterable product grid for the all-products page. Filters by
// assay type (drug / ADA) and by category (target/functional).
"use client";

import { useMemo, useState } from "react";
import ProductCard from "@/components/site/ProductCard";
import { type ProductItem, type CategoryItem } from "@/lib/catalog";
import { cn } from "@/lib/utils";

type TypeFilter = "all" | "drug ELISA" | "ADA ELISA";

export default function ProductFilter({
  products,
  categories,
}: {
  products: ProductItem[];
  categories: CategoryItem[];
}) {
  const [type, setType] = useState<TypeFilter>("all");
  const [cat, setCat] = useState<string>("all");

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const typeOk = type === "all" || p.productType === type;
      const catOk = cat === "all" || p.categories.includes(cat);
      return typeOk && catOk;
    });
  }, [products, type, cat]);

  const typeOptions: { value: TypeFilter; label: string }[] = [
    { value: "all", label: "All kits" },
    { value: "drug ELISA", label: "Drug ELISAs" },
    { value: "ADA ELISA", label: "ADA ELISAs" },
  ];

  const chip = (active: boolean) =>
    cn(
      "rounded-none border px-3 py-1 text-sm transition-colors",
      active
        ? "border-[var(--signal)] text-[var(--signal)]"
        : "border-[var(--hair)] text-[var(--ink-2)] hover:border-[var(--ink-2)]",
    );

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {typeOptions.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setType(o.value)}
              className={chip(type === o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCat("all")}
            className={chip(cat === "all")}
          >
            All targets
          </button>
          {categories
            .filter((c) => c.kind === "target")
            .map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => setCat(c.slug)}
                className={chip(cat === c.slug)}
              >
                {c.name}
              </button>
            ))}
        </div>
      </div>

      <p className="mb-4 text-sm" style={{ color: "var(--ink-2)" }}>
        {filtered.length} {filtered.length === 1 ? "kit" : "kits"}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <ProductCard key={p.uuid} product={p} />
        ))}
      </div>
    </div>
  );
}
