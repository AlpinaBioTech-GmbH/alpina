// src/components/Markdown.tsx
// Renders assistant message text as Markdown (bold, lists, links), linkifying
// [Title] citations against the known sources. Shared by the public widget and
// the admin conversation detail page.
"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { linkifyCitations, type Source } from "@/lib/markdown";
import { cn } from "@/lib/utils";

export function Markdown({
  text,
  sources = [],
  className,
  onInternalLink,
}: {
  text: string;
  sources?: Source[];
  className?: string;
  // When provided, internal (/...) links call this instead of navigating
  // directly, so the caller can run an exit animation first.
  onInternalLink?: (href: string) => void;
}) {
  return (
    <div
      className={cn(
        "space-y-2 [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded-none [&_code]:bg-black/10 [&_code]:px-1 [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const url = href ?? "";
            // Internal site links navigate in the same tab. If the caller passed
            // onInternalLink it handles navigation (e.g. animate-then-navigate);
            // otherwise use a plain client-side Link. External links: new tab.
            if (url.startsWith("/")) {
              if (onInternalLink) {
                return (
                  <a
                    href={url}
                    onClick={(e) => {
                      e.preventDefault();
                      onInternalLink(url);
                    }}
                  >
                    {children}
                  </a>
                );
              }
              return <Link href={url}>{children}</Link>;
            }
            return (
              <a href={url} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {linkifyCitations(text, sources)}
      </ReactMarkdown>
    </div>
  );
}
