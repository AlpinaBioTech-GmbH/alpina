// Articles list: tag filter + full-width cards (image on the left) + a load-more
// button after the first batch.
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Article = {
  uuid: string;
  full_slug: string;
  content: {
    title?: string;
    teaser?: string;
    date?: string;
    tags?: string[];
    hero_image?: { filename?: string | null; alt?: string | null };
  };
};

const BATCH = 4;

function formatDate(d?: string): string {
  if (!d) return "";
  const date = new Date(d.replace(" ", "T"));
  return Number.isNaN(date.getTime())
    ? d
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function ArticleList({ articles }: { articles: Article[] }) {
  const [tag, setTag] = useState<string>("all");
  const [count, setCount] = useState(BATCH);

  const tags = useMemo(() => {
    const s = new Set<string>();
    articles.forEach((a) => (a.content.tags || []).forEach((t) => s.add(t)));
    return [...s].sort();
  }, [articles]);

  const filtered = useMemo(
    () => (tag === "all" ? articles : articles.filter((a) => (a.content.tags || []).includes(tag))),
    [articles, tag],
  );
  const visible = filtered.slice(0, count);

  const pick = (t: string) => {
    setTag(t);
    setCount(BATCH);
  };

  const chip = (active: boolean) =>
    cn(
      "rounded-none border px-3 py-1 text-sm transition-colors",
      active
        ? "border-[var(--signal)] text-[var(--signal)]"
        : "border-[var(--hair)] text-[var(--ink-2)] hover:border-[var(--ink-2)]",
    );

  return (
    <div>
      <div className="mb-8 flex flex-wrap gap-2">
        <button type="button" onClick={() => pick("all")} className={chip(tag === "all")}>
          All
        </button>
        {tags.map((t) => (
          <button key={t} type="button" onClick={() => pick(t)} className={chip(tag === t)}>
            {t}
          </button>
        ))}
      </div>

      <p className="mb-6 text-sm" style={{ color: "var(--ink-2)" }}>
        {filtered.length} {filtered.length === 1 ? "article" : "articles"}
      </p>

      <div className="flex flex-col gap-6">
        {visible.map((a) => {
          const hero = a.content.hero_image?.filename;
          return (
            <Link
              key={a.uuid}
              href={`/${a.full_slug}`}
              className="group flex flex-col gap-5 border p-5 transition-colors hover:border-[var(--signal)] sm:flex-row"
              style={{ background: "var(--paper-2)", borderColor: "var(--hair)" }}
            >
              {hero ? (
                <div
                  className="flex aspect-[16/9] shrink-0 items-center justify-center overflow-hidden border p-3 sm:aspect-[4/3] sm:w-56"
                  style={{ background: "var(--paper)", borderColor: "var(--hair)" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- SVG hero */}
                  <img
                    src={hero}
                    alt={a.content.hero_image?.alt || a.content.title || ""}
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : null}

              <div className="flex min-w-0 flex-col">
                {a.content.date ? (
                  <span
                    className="text-xs uppercase tracking-wide"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}
                  >
                    {formatDate(a.content.date)}
                  </span>
                ) : null}
                <h2
                  className="mt-2 text-lg font-semibold leading-snug transition-colors group-hover:text-[var(--signal)]"
                  style={{ color: "var(--ink)" }}
                >
                  {a.content.title}
                </h2>
                {a.content.teaser ? (
                  <p className="mt-2 line-clamp-3 text-sm" style={{ color: "var(--ink-2)" }}>
                    {a.content.teaser}
                  </p>
                ) : null}
                {a.content.tags && a.content.tags.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {a.content.tags.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="border px-2 py-0.5 text-[0.7rem]"
                        style={{ borderColor: "var(--hair)", color: "var(--ink-2)" }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
                <span
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium transition-colors group-hover:gap-2"
                  style={{ color: "var(--signal)" }}
                >
                  Read more
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {count < filtered.length ? (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() => setCount((c) => c + BATCH)}
            className="border px-6 py-3 text-sm font-semibold uppercase tracking-[0.08em] transition-colors hover:border-[var(--signal)] hover:text-[var(--signal)]"
            style={{ borderColor: "var(--hair)", color: "var(--ink)" }}
          >
            Load more
          </button>
        </div>
      ) : null}
    </div>
  );
}
