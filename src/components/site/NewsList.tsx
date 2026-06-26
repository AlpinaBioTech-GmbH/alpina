// src/components/site/NewsList.tsx
// News headlines as a responsive list: a compact vertical list on mobile and a
// card grid on widescreen, with an optional "Load more headlines" button that
// reveals the rest in batches. Optionally shows a tag filter bar.
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { NEWS_TAGS } from "@/lib/newsTags";
import { brand } from "@/lib/config";

export type NewsListItem = {
  id: string;
  href: string;
  external: boolean;
  title: string;
  date: string;
  excerpt?: string;
  image?: { src: string; alt: string } | null;
  blurDataURL?: string;
  tags?: string[];
};

function linkProps(external: boolean) {
  return external ? { target: "_blank", rel: "noopener" } : {};
}

function TagChips({ tags }: { tags?: string[] }) {
  if (!tags?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span
          key={t}
          style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)", borderColor: "var(--hair)" }}
          className="border px-1.5 py-0.5 text-[0.6rem] uppercase tracking-[0.1em]"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function Placeholder() {
  return (
    <span
      style={{ fontFamily: "var(--font-mono)", color: "var(--mist)" }}
      className="absolute inset-0 flex items-center justify-center text-[0.65rem] uppercase tracking-[0.12em] opacity-70"
    >
      {brand.name}
    </span>
  );
}

export default function NewsList({
  items,
  initialCount = items.length,
  loadMore = false,
  columns = 3,
  filterable = false,
}: {
  items: NewsListItem[];
  initialCount?: number;
  loadMore?: boolean;
  columns?: 2 | 3;
  filterable?: boolean;
}) {
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [visible, setVisible] = useState(
    loadMore ? Math.min(initialCount, items.length) : items.length,
  );

  // Tag chips, in canonical order, limited to tags actually present.
  const tagChips = filterable
    ? NEWS_TAGS.map((t) => t.label).filter((label) => items.some((a) => a.tags?.includes(label)))
    : [];

  const filtered = activeTag ? items.filter((a) => a.tags?.includes(activeTag)) : items;
  const limit = loadMore ? visible : filtered.length;
  const shown = filtered.slice(0, limit);
  const remaining = filtered.length - shown.length;
  const gridCols = columns === 2 ? "md:grid-cols-2" : "md:grid-cols-3";
  // Desktop cards only render at md+ (the mobile list shows below md), so the
  // image never needs to be wider than its grid column there.
  const cardSizes =
    columns === 2 ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 33vw, 100vw";

  const selectTag = (tag: string | null) => {
    setActiveTag(tag);
    setVisible(loadMore ? Math.min(initialCount, items.length) : items.length);
  };

  return (
    <div>
      {tagChips.length > 1 && (
        <div className="mb-10 flex flex-wrap gap-2">
          {[null, ...tagChips].map((tag) => {
            const active = activeTag === tag;
            return (
              <button
                key={tag ?? "all"}
                type="button"
                onClick={() => selectTag(tag)}
                aria-pressed={active}
                style={{
                  fontFamily: "var(--font-mono)",
                  borderColor: active ? "var(--signal)" : "var(--hair)",
                  background: active ? "var(--signal)" : "transparent",
                  color: active ? "var(--on-contrast)" : "var(--ink-2)",
                }}
                className="border px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.12em] transition-colors hover:border-[var(--signal)]"
              >
                {tag ?? "All"}
              </button>
            );
          })}
        </div>
      )}

      {/* Mobile: compact vertical list */}
      <ul className="flex flex-col md:hidden" style={{ borderColor: "var(--hair)" }}>
        {shown.map((a) => (
          <li key={a.id} className="border-t first:border-t-0" style={{ borderColor: "var(--hair)" }}>
            <Link
              href={a.href}
              {...linkProps(a.external)}
              className="group flex items-start gap-4 py-5"
            >
              <div
                style={{ borderColor: "var(--hair)", background: "var(--void)" }}
                className="relative aspect-video w-28 shrink-0 overflow-hidden border"
              >
                {a.image ? (
                  <Image
                    src={a.image.src}
                    alt={a.image.alt}
                    width={224}
                    height={126}
                    sizes="112px"
                    placeholder={a.blurDataURL ? "blur" : "empty"}
                    blurDataURL={a.blurDataURL}
                    className="absolute inset-0 h-full w-full object-cover transition duration-200 group-hover:brightness-90"
                  />
                ) : (
                  <Placeholder />
                )}
              </div>
              <div className="min-w-0 flex-1">
                {a.date && (
                  <p
                    style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}
                    className="text-[0.65rem] uppercase tracking-[0.12em]"
                  >
                    {a.date}
                  </p>
                )}
                <h3
                  style={{ fontFamily: "var(--font-heading)", color: "var(--ink)" }}
                  className="mt-1 text-base leading-snug"
                >
                  {a.title}
                  {a.external && (
                    <ArrowUpRight size={12} className="ml-1 inline align-middle" />
                  )}
                </h3>
                <TagChips tags={a.tags} />
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Widescreen: card grid */}
      <div className={`hidden gap-6 md:grid ${gridCols}`}>
        {shown.map((a) => (
          <Link
            key={a.id}
            href={a.href}
            {...linkProps(a.external)}
            className="group flex h-full flex-col"
          >
            <div
              style={{ borderColor: "var(--hair)", background: "var(--void)" }}
              className="relative mb-5 aspect-video w-full overflow-hidden border"
            >
              {a.image ? (
                <Image
                  src={a.image.src}
                  alt={a.image.alt}
                  width={640}
                  height={360}
                  sizes={cardSizes}
                  placeholder={a.blurDataURL ? "blur" : "empty"}
                  blurDataURL={a.blurDataURL}
                  className="absolute inset-0 h-full w-full object-cover transition duration-200 group-hover:brightness-90"
                />
              ) : (
                <Placeholder />
              )}
            </div>
            {a.date && (
              <p
                style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}
                className="text-[0.7rem] uppercase tracking-[0.12em]"
              >
                {a.date}
              </p>
            )}
            <h3
              style={{ fontFamily: "var(--font-heading)", color: "var(--ink)" }}
              className="mt-3 text-lg leading-snug"
            >
              {a.title}
            </h3>
            {a.excerpt && (
              <p style={{ color: "var(--ink-2)" }} className="mt-2 flex-1 text-sm leading-relaxed">
                {a.excerpt}
              </p>
            )}
            <TagChips tags={a.tags} />
            <span
              style={{ fontFamily: "var(--font-mono)", color: "var(--signal)" }}
              className="mt-4 inline-flex items-center gap-0.5 text-xs uppercase tracking-[0.12em]"
            >
              Read
              {a.external && <ArrowUpRight size={12} />}
            </span>
          </Link>
        ))}
      </div>

      {loadMore && remaining > 0 && (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => Math.min(v + initialCount, items.length))}
            style={{ fontFamily: "var(--font-mono)", color: "var(--ink)", borderColor: "var(--hair)" }}
            className="border px-6 py-3 text-xs uppercase tracking-[0.12em] transition-colors hover:border-[var(--signal)] hover:text-[var(--signal)]"
          >
            Load more headlines ({remaining})
          </button>
        </div>
      )}
    </div>
  );
}
