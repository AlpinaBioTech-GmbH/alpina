// Public newsletter archive: every sent monthly digest. A dedicated DB-driven
// route (issues are machine-generated snapshots in newsletter_issues, not
// Storyblok stories). Static route, so no collision with the [[...slug]]
// catch-all; revalidated explicitly after each send.
import type { Metadata } from "next";
import Link from "next/link";
import { listIssues } from "@/lib/newsletter/issue";
import { periodLabel } from "@/lib/newsletter/digest";
import { brand } from "@/lib/config";

export const revalidate = 3600;

const description = `The ${brand.name} monthly digest: new articles on ELISA methods, therapeutic drug monitoring, and immunogenicity, delivered by email.`;

export const metadata: Metadata = {
  title: "Newsletter",
  description,
};

export default async function NewsletterArchivePage() {
  const issues = await listIssues({ sentOnly: true });

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
            Newsletter
          </p>
          <h1
            className="mt-3 text-3xl font-semibold leading-tight md:text-4xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            The monthly digest
          </h1>
          <p className="mt-3 max-w-2xl text-base" style={{ color: "var(--mist)" }}>
            A summary of every article we published, once a month. Subscribe via
            the form in the footer.
          </p>
        </div>
      </section>

      <section style={{ background: "var(--paper)", color: "var(--ink)" }} className="px-6 py-14 md:py-20">
        <div className="mx-auto max-w-5xl">
          {issues.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--ink-2)" }}>
              No issues yet: the first digest goes out after the next full month
              of articles.
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {issues.map((issue) => (
                <Link
                  key={issue.id}
                  href={`/newsletter/${issue.slug}`}
                  className="block border p-6 transition-colors hover:border-[var(--signal)]"
                  style={{ borderColor: "var(--hair)" }}
                >
                  <p
                    style={{ fontFamily: "var(--font-mono)", color: "var(--signal)" }}
                    className="text-xs uppercase tracking-[0.14em]"
                  >
                    {periodLabel(issue.period)}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                    {issue.title}
                  </h2>
                  {issue.content?.intro_paragraphs?.[0] ? (
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed" style={{ color: "var(--ink-2)" }}>
                      {issue.content.intro_paragraphs[0]}
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs" style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}>
                    {issue.article_count} article{issue.article_count === 1 ? "" : "s"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
