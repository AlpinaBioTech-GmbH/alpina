// Articles index. A dedicated route (not a Storyblok page) so it doesn't collide
// with the `articles/` folder that holds the article stories. Lists published
// `article` stories; each links to /articles/<slug> (rendered by the catch-all).
import type { Metadata } from "next";
import { fetchArticles } from "@/lib/storyblok";
import { brand } from "@/lib/config";
import ArticleList from "@/components/site/ArticleList";

// This route has no Storyblok story, so the OG generator gets an explicit
// title/eyebrow instead of a ?slug= (mirrors the H1 below).
const OG_TITLE = "Notes on immunoassays and drug monitoring";
const ogImageUrl = `/api/og?eyebrow=${encodeURIComponent("Articles")}&title=${encodeURIComponent(OG_TITLE)}`;

const description = `Insights on ELISA, therapeutic drug monitoring, and immunogenicity from ${brand.name}.`;

export const metadata: Metadata = {
  title: "Articles",
  description,
  openGraph: {
    title: "Articles",
    description,
    images: [{ url: ogImageUrl, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Articles",
    description,
    images: [ogImageUrl],
  },
};

export default async function ArticlesIndex() {
  const articles = await fetchArticles(100);

  return (
    <main>
      <section
        style={{ background: "var(--void)", color: "var(--on-contrast)" }}
        className="px-6 pt-20 pb-12 md:pt-28 md:pb-16"
      >
        <div className="mx-auto max-w-5xl">
          <p
            style={{ fontFamily: "var(--font-mono)", color: "var(--signal)" }}
            className="text-xs uppercase tracking-[0.14em]"
          >
            Articles
          </p>
          <h1
            className="mt-3 text-3xl font-semibold leading-tight md:text-4xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Notes on immunoassays and drug monitoring
          </h1>
          <p className="mt-3 max-w-2xl text-base" style={{ color: "var(--mist)" }}>
            Background on ELISA methods, therapeutic drug monitoring, anti-drug
            antibodies, biosimilars, and assay validation.
          </p>
        </div>
      </section>

      <section style={{ background: "var(--paper)", color: "var(--ink)" }} className="px-6 py-14 md:py-20">
        <div className="mx-auto max-w-5xl">
          {articles.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--ink-2)" }}>
              No articles published yet.
            </p>
          ) : (
            <ArticleList articles={articles} />
          )}
        </div>
      </section>
    </main>
  );
}
