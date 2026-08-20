// One sent newsletter issue, rendered in site chrome from its content jsonb
// (not the email HTML). 404s for unknown or unsent slugs.
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getSentIssueBySlug, listIssues } from "@/lib/newsletter/issue";
import { periodLabel } from "@/lib/newsletter/digest";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const issue = await getSentIssueBySlug(slug);
  if (!issue) return { title: "Newsletter" };
  return {
    title: issue.title,
    description: issue.preview_text ?? undefined,
  };
}

function articleDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function NewsletterIssuePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const issue = await getSentIssueBySlug(slug);
  if (!issue || !issue.content) notFound();

  // Prev/next sent issues for footer navigation.
  const all = await listIssues({ sentOnly: true });
  const idx = all.findIndex((i) => i.id === issue.id);
  const newer = idx > 0 ? all[idx - 1] : null;
  const older = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;

  return (
    <main>
      <section
        style={{ background: "var(--void)", color: "var(--on-contrast)" }}
        className="px-6 pt-20 pb-12 md:pt-28 md:pb-16"
      >
        <div className="mx-auto max-w-3xl">
          <p
            style={{ fontFamily: "var(--font-mono)", color: "var(--signal)" }}
            className="text-xs uppercase tracking-[0.14em]"
          >
            <Link href="/newsletter" className="hover:underline">
              Newsletter
            </Link>{" "}
            / {periodLabel(issue.period)}
          </p>
          <h1
            className="mt-3 text-3xl font-semibold leading-tight md:text-4xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {issue.title}
          </h1>
        </div>
      </section>

      <section style={{ background: "var(--paper)", color: "var(--ink)" }} className="px-6 py-14 md:py-20">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-col gap-4">
            {issue.content.intro_paragraphs.map((p, i) => (
              <p key={i} className="text-base leading-relaxed">
                {p}
              </p>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-8">
            {issue.content.articles.map((a) => (
              <div key={a.url} className="border-t pt-8" style={{ borderColor: "var(--hair)" }}>
                {a.heroUrl ? (
                  <Link href={a.url}>
                    <Image
                      src={a.heroUrl}
                      alt={a.heroAlt}
                      width={768}
                      height={432}
                      className="mb-4 h-auto w-full border"
                      style={{ borderColor: "var(--hair)" }}
                    />
                  </Link>
                ) : null}
                {a.tags.length ? (
                  <p
                    className="mb-2 text-xs uppercase tracking-[0.1em]"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}
                  >
                    {a.tags.join(" / ")}
                  </p>
                ) : null}
                <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                  <Link href={a.url} className="hover:text-[var(--signal)]">
                    {a.title}
                  </Link>
                </h2>
                <p className="mt-1 text-xs" style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}>
                  {articleDate(a.date)}
                </p>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ink-2)" }}>
                  {a.teaser}
                </p>
                <Link
                  href={a.url}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.1em]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--signal)" }}
                >
                  Read the article <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>

          {issue.content.closing_line ? (
            <p className="mt-10 border-t pt-8 text-base leading-relaxed" style={{ borderColor: "var(--hair)" }}>
              {issue.content.closing_line}
            </p>
          ) : null}

          {(newer || older) && (
            <div
              className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t pt-8 text-sm"
              style={{ borderColor: "var(--hair)" }}
            >
              {older ? (
                <Link
                  href={`/newsletter/${older.slug}`}
                  className="inline-flex items-center gap-1.5 hover:text-[var(--signal)]"
                >
                  <ArrowLeft size={14} /> {periodLabel(older.period)}
                </Link>
              ) : (
                <span />
              )}
              {newer ? (
                <Link
                  href={`/newsletter/${newer.slug}`}
                  className="inline-flex items-center gap-1.5 hover:text-[var(--signal)]"
                >
                  {periodLabel(newer.period)} <ArrowRight size={14} />
                </Link>
              ) : (
                <span />
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
