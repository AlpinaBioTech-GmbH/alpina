// src/components/storyblok/NewsTeaser.tsx
// Home news teaser and the /news index listing. Pulls the latest news_article
// stories in code. On the index (load_more on) it shows an initial batch with a
// "Load more headlines" button; the home teaser just shows max_items with an
// "All news" link. Mobile renders a list, not a slider.
import { storyblokEditable } from "@storyblok/react/rsc";
import Link from "next/link";
import { fetchNewsArticles } from "@/lib/storyblok";
import { toNewsListItems } from "@/lib/newsItems";
import NewsList from "@/components/site/NewsList";

type NewsTeaserBlok = {
  _uid: string;
  component: string;
  heading?: string;
  max_items?: number | string;
  load_more?: boolean;
  hide_all_link?: boolean;
};

export default async function NewsTeaser({ blok }: { blok: NewsTeaserBlok }) {
  const initial = Number(blok.max_items) || 3;
  // With load_more we fetch the full set and reveal in batches client-side;
  // otherwise just the initial batch.
  const articles = await fetchNewsArticles(blok.load_more ? 100 : initial);
  const items = await toNewsListItems(articles);

  return (
    <section
      {...storyblokEditable(blok)}
      style={{ background: "var(--paper)", color: "var(--ink)" }}
      className="px-6 py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex items-baseline justify-between">
          <h2
            style={{ fontFamily: "var(--font-heading)", color: "var(--ink)" }}
            className="text-3xl leading-tight md:text-4xl"
          >
            {blok.heading || "News & Research"}
          </h2>
          {!blok.hide_all_link && (
            <Link
              href="/news"
              style={{ fontFamily: "var(--font-mono)", color: "var(--signal)" }}
              className="text-xs uppercase tracking-[0.12em]"
            >
              All news →
            </Link>
          )}
        </div>

        {items.length === 0 ? (
          <p
            style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}
            className="mt-10 text-sm uppercase tracking-[0.12em] opacity-70"
          >
            {/* No news_article stories published yet - populate in Storyblok. */}
            No articles published yet
          </p>
        ) : (
          <div className="mt-12">
            <NewsList
              items={items}
              initialCount={initial}
              loadMore={Boolean(blok.load_more)}
              filterable={Boolean(blok.load_more)}
            />
          </div>
        )}
      </div>
    </section>
  );
}
