// The `article_teaser` section: shows the latest N articles with a link to the
// full /articles index. Used on the home page.
import { storyblokEditable, type SbBlokData } from "@storyblok/react/rsc";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { fetchArticles } from "@/lib/storyblok";

type ArticleTeaserBlok = {
  _uid: string;
  component: string;
  heading?: string;
  intro?: string;
  max_items?: number | string;
};

export default async function ArticleTeaser({ blok }: { blok: ArticleTeaserBlok }) {
  const limit = Number(blok.max_items) || 3;
  const articles = await fetchArticles(limit);
  if (articles.length === 0) return null;

  return (
    <section
      {...storyblokEditable(blok as unknown as SbBlokData)}
      style={{ background: "var(--paper)", color: "var(--ink)" }}
      className="px-6 py-14 md:py-20"
    >
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2
              className="text-2xl font-semibold md:text-3xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {blok.heading || "Latest articles"}
            </h2>
            {blok.intro ? (
              <p className="mt-2 max-w-2xl text-base" style={{ color: "var(--ink-2)" }}>
                {blok.intro}
              </p>
            ) : null}
          </div>
          <Link
            href="/articles"
            className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:gap-2.5"
            style={{ color: "var(--signal)" }}
          >
            All articles
            <ArrowRight size={15} />
          </Link>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => {
            const hero = a.content.hero_image?.filename;
            return (
              <Link
                key={a.uuid}
                href={`/${a.full_slug}`}
                className="group flex flex-col border p-5 transition-colors hover:border-[var(--signal)]"
                style={{ background: "var(--paper-2)", borderColor: "var(--hair)" }}
              >
                {hero ? (
                  <div
                    className="mb-4 flex aspect-[16/9] items-center justify-center overflow-hidden border p-3"
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
                <h3
                  className="text-base font-semibold leading-snug transition-colors group-hover:text-[var(--signal)]"
                  style={{ color: "var(--ink)" }}
                >
                  {a.content.title}
                </h3>
                {a.content.teaser ? (
                  <p className="mt-2 line-clamp-3 text-sm" style={{ color: "var(--ink-2)" }}>
                    {a.content.teaser}
                  </p>
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
