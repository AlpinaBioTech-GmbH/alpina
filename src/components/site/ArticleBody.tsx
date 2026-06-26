// Long-form article body: renders the article's Markdown with prose styling
// (headings, paragraphs, lists, links, blockquotes, tables). Internal links use
// next/link; external links open in a new tab.
"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ArticleBody({ markdown }: { markdown: string }) {
  return (
    <div
      className="max-w-none text-base leading-relaxed [&_a]:text-[var(--signal)] [&_a]:underline [&_blockquote]:my-5 [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--signal)] [&_blockquote]:pl-4 [&_blockquote]:italic [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:font-[family-name:var(--font-heading)] [&_h2]:text-[var(--ink)] [&_h3]:mt-8 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-[var(--ink)] [&_li]:mt-1.5 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-4 [&_strong]:font-semibold [&_strong]:text-[var(--ink)] [&_table]:mt-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[var(--hair)] [&_td]:px-3 [&_td]:py-1.5 [&_th]:border [&_th]:border-[var(--hair)] [&_th]:bg-[var(--paper-2)] [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6"
      style={{ color: "var(--ink-2)" }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const url = href ?? "";
            const external = /^https?:\/\//.test(url);
            if (external) {
              return (
                <a href={url} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              );
            }
            return <Link href={url || "#"}>{children}</Link>;
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
