// The `article` content type: a long-form article (markdown body). Dark header
// band (ARTICLE / date + title + teaser), hero image, then the body on the light
// base, with tags and related articles.
import { storyblokEditable, type SbBlokData } from "@storyblok/react/rsc";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ArticleBody from "@/components/site/ArticleBody";
import ShareBar from "@/components/site/ShareBar";
import { fetchArticles } from "@/lib/storyblok";

type Asset = { filename?: string | null; alt?: string | null };
type ArticleBlok = {
  _uid: string;
  component: string;
  title?: string;
  teaser?: string;
  author?: string;
  date?: string;
  tags?: string[];
  hero_image?: Asset;
  body?: string;
};

function formatDate(d?: string): string {
  if (!d) return "";
  const date = new Date(d.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default async function Article({
  blok,
  fullSlug,
}: {
  blok: ArticleBlok;
  fullSlug?: string;
}) {
  const date = formatDate(blok.date);
  const heroFile = blok.hero_image?.filename || undefined;

  const all = await fetchArticles(20);
  const related = all
    .filter((a) => a.full_slug !== fullSlug && a.content?.title !== blok.title)
    .slice(0, 2);

  return (
    <main {...storyblokEditable(blok as unknown as SbBlokData)}>
      {/* Header band */}
      <section
        style={{ background: "var(--void)", color: "var(--on-contrast)" }}
        className="px-6 pt-20 pb-12 md:pt-28 md:pb-16"
      >
        <div className="mx-auto max-w-3xl">
          <Link
            href="/articles"
            style={{ fontFamily: "var(--font-mono)", color: "var(--mist)" }}
            className="mb-8 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] transition-colors hover:text-[var(--on-contrast)]"
          >
            <ArrowLeft size={12} />
            All articles
          </Link>
          <p
            style={{ fontFamily: "var(--font-mono)", color: "var(--signal)" }}
            className="text-xs uppercase tracking-[0.14em]"
          >
            Article{date ? ` · ${date}` : ""}
          </p>
          <h1
            className="mt-3 text-3xl font-semibold leading-tight md:text-4xl lg:text-5xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {blok.title}
          </h1>
          {blok.teaser ? (
            <p className="mt-4 max-w-2xl text-lg leading-relaxed" style={{ color: "var(--mist)" }}>
              {blok.teaser}
            </p>
          ) : null}
          {blok.author ? (
            <p className="mt-4 text-sm" style={{ color: "var(--mist)" }}>
              {blok.author}
            </p>
          ) : null}
        </div>
      </section>

      {/* Body */}
      <section style={{ background: "var(--paper)", color: "var(--ink)" }} className="px-6 py-14 md:py-20">
        <div className="mx-auto max-w-3xl">
          {heroFile ? (
            <div className="mb-10 border p-4" style={{ background: "var(--paper-2)", borderColor: "var(--hair)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- SVG hero, no optimization needed */}
              <img src={heroFile} alt={blok.hero_image?.alt || blok.title || ""} className="mx-auto w-full" />
            </div>
          ) : null}

          {blok.body ? <ArticleBody markdown={blok.body} /> : null}

          {blok.tags && blok.tags.length ? (
            <div className="mt-12 flex flex-wrap gap-2">
              {blok.tags.map((t) => (
                <span
                  key={t}
                  className="border px-3 py-1 text-xs"
                  style={{ borderColor: "var(--hair)", color: "var(--ink-2)" }}
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}

          <ShareBar title={blok.title} />
        </div>

        {related.length ? (
          <div className="mx-auto mt-16 max-w-3xl border-t pt-10" style={{ borderColor: "var(--hair)" }}>
            <h2 className="text-lg font-semibold">More articles</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {related.map((a) => (
                <Link key={a.uuid} href={`/${a.full_slug}`} className="group flex flex-col">
                  {a.content?.hero_image?.filename ? (
                    <div
                      className="mb-3 flex aspect-[16/9] items-center justify-center overflow-hidden border p-3"
                      style={{ background: "var(--paper-2)", borderColor: "var(--hair)" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- SVG hero */}
                      <img
                        src={a.content.hero_image.filename}
                        alt={a.content.hero_image.alt || a.content.title || ""}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  ) : null}
                  <p
                    className="text-base font-semibold transition-colors group-hover:text-[var(--signal)]"
                    style={{ color: "var(--ink)" }}
                  >
                    {a.content?.title}
                  </p>
                  {a.content?.teaser ? (
                    <p className="mt-1 line-clamp-2 text-sm" style={{ color: "var(--ink-2)" }}>
                      {a.content.teaser}
                    </p>
                  ) : null}
                  <span
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium transition-colors group-hover:gap-2"
                    style={{ color: "var(--signal)" }}
                  >
                    Read more
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
