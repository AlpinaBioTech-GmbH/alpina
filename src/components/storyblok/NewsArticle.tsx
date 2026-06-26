// src/components/storyblok/NewsArticle.tsx
// A news article page (content type). Dark header band (NEWS · date + title),
// then the article body on the machined light base.
import {
  storyblokEditable,
  renderRichText,
  type SbBlokData,
} from "@storyblok/react/rsc";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ArticleVideo from "@/components/site/ArticleVideo";
import ShareBar from "@/components/site/ShareBar";
import NewsList from "@/components/site/NewsList";
import { fetchNewsArticles } from "@/lib/storyblok";
import { toNewsListItems, rankRelated, formatNewsDate } from "@/lib/newsItems";
import { orderedTags, tagLabel } from "@/lib/newsTags";
import { lqip } from "@/lib/storyblokImage";

type Richtext = Parameters<typeof renderRichText>[0];
type NewsArticleBlok = {
  _uid: string;
  component: string;
  title?: string;
  date?: string;
  excerpt?: string;
  image?: { filename?: string | null; alt?: string | null };
  tags?: string[];
  video_url?: string;
  video_poster?: string;
  body?: Richtext;
};

export default async function NewsArticle({ blok }: { blok: NewsArticleBlok }) {
  const bodyHtml = blok.body ? renderRichText(blok.body) : "";
  const hasImage = Boolean(blok.image?.filename);
  const tagLabels = orderedTags(blok.tags).map(tagLabel);
  const heroBlur = hasImage ? await lqip(blok.image!.filename) : undefined;

  // Related "More headlines": the two most relevant articles, ranked by shared
  // tags, then newest first.
  const pool = (await fetchNewsArticles(100)).filter((a) => a.content.title !== blok.title);
  const current = { uuid: "__current__", full_slug: "", content: { tags: blok.tags } };
  const relatedItems = await toNewsListItems(rankRelated(current, pool).slice(0, 2));

  return (
    <main {...storyblokEditable(blok as unknown as SbBlokData)}>
      <section
        style={{ background: "var(--void)", color: "var(--on-contrast)" }}
        className="px-6 pt-20 pb-14 md:pt-28 md:pb-16"
      >
        <div className="mx-auto max-w-3xl">
          <Link
            href="/news"
            style={{ fontFamily: "var(--font-mono)", color: "var(--mist)" }}
            className="mb-8 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] transition-colors hover:text-[var(--on-contrast)]"
          >
            <ArrowLeft size={12} />
            All news
          </Link>
          <p
            style={{ fontFamily: "var(--font-mono)", color: "var(--signal)" }}
            className="mb-5 text-xs uppercase tracking-[0.12em]"
          >
            News{blok.date ? ` · ${formatNewsDate(blok.date)}` : ""}
          </p>
          {blok.title && (
            <h1
              style={{ fontFamily: "var(--font-heading)" }}
              className="text-3xl leading-[1.1] md:text-5xl"
            >
              {blok.title}
            </h1>
          )}
          {tagLabels.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {tagLabels.map((t) => (
                <span
                  key={t}
                  style={{ fontFamily: "var(--font-mono)", color: "var(--mist)", borderColor: "var(--hair)" }}
                  className="border px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.12em]"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <section
        style={{ background: "var(--paper)", color: "var(--ink-2)" }}
        className="px-6 py-16 md:py-20"
      >
        <div className="mx-auto max-w-3xl">
          {hasImage && (
            <Image
              src={blok.image!.filename as string}
              alt={blok.image?.alt || blok.title || ""}
              width={1200}
              height={630}
              priority
              sizes="(min-width: 768px) 768px, 100vw"
              placeholder={heroBlur ? "blur" : "empty"}
              blurDataURL={heroBlur}
              className="mb-10 h-auto w-full object-cover"
            />
          )}
          {bodyHtml ? (
            <div
              className="space-y-5 text-lg leading-relaxed [&_a]:underline [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_li]:pl-1 [&_li]:marker:text-[var(--signal)]"
              style={{ color: "var(--ink-2)" }}
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          ) : (
            blok.excerpt && (
              <p className="text-lg leading-relaxed" style={{ color: "var(--ink-2)" }}>
                {blok.excerpt}
              </p>
            )
          )}

          {/* Video plays inline at the foot of the article; fullscreen via the
              native control. */}
          {blok.video_url && (
            <div className="mt-12">
              <ArticleVideo
                videoSrc={blok.video_url}
                poster={blok.video_poster || blok.image?.filename || undefined}
                posterAlt={blok.image?.alt || blok.title || "Play video"}
              />
            </div>
          )}

          <ShareBar title={blok.title} />
        </div>
      </section>

      {/* More headlines: related by shared tags, newest first. */}
      {relatedItems.length > 0 && (
        <section
          style={{ background: "var(--paper-2)", color: "var(--ink)", borderColor: "var(--hair)" }}
          className="border-t px-6 py-16 md:py-20"
        >
          <div className="mx-auto max-w-5xl">
            <p
              style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}
              className="mb-8 text-xs uppercase tracking-[0.12em]"
            >
              More headlines
            </p>
            <NewsList items={relatedItems} columns={2} />
          </div>
        </section>
      )}
    </main>
  );
}
