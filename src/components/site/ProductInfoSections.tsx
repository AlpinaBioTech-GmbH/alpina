// Product documentation, migrated from the product page. Rendering rules:
//  - Text sections (e.g. assay characteristics) render as normal sections.
//  - References renders as a borderless, collapsed accordion (just a margin).
//  - Sections with a document render as download buttons in a Downloads area.
import { Download } from "lucide-react";

export type InfoSection = {
  title?: string;
  content_html?: string;
  document?: { filename?: string | null } | null;
};

// Light sanitize: admin-controlled CMS HTML (p/a/table only), but strip anything
// executable as defense in depth.
function sanitize(html: string): string {
  return html
    .replace(/<\/?(script|style|iframe|object|embed)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
}

// Sentence case: "INSTRUCTIONS FOR USE" -> "Instructions for use".
function sentence(s: string): string {
  return s.toLowerCase().replace(/^\p{L}/u, (c) => c.toUpperCase());
}

// Shorter labels for the download buttons.
function downloadLabel(title: string): string {
  if (/instructions for use/i.test(title)) return "Instructions";
  return sentence(title);
}

const PROSE =
  "max-w-none text-sm leading-relaxed [&_a]:text-[var(--signal)] [&_a]:underline [&_p]:mt-3 [&_table]:mt-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[var(--hair)] [&_td]:px-3 [&_td]:py-1.5 [&_th]:border [&_th]:border-[var(--hair)] [&_th]:bg-[var(--paper-2)] [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left";

export default function ProductInfoSections({
  sections,
}: {
  sections: InfoSection[];
}) {
  const items = (sections || []).filter((s) => s?.title);
  const docs = items.filter((s) => s.document?.filename);
  const refs = items.find(
    (s) => /references/i.test(s.title || "") && !s.document?.filename,
  );
  const normal = items.filter((s) => !s.document?.filename && s !== refs);
  if (!normal.length && !refs && docs.length === 0) return null;

  const refsHtml = refs ? sanitize(refs.content_html || "") : "";

  return (
    <>
      {/* Normal text sections (assay characteristics, ...) */}
      {normal.map((s, n) => {
        const html = sanitize(s.content_html || "");
        if (!html) return null;
        return (
          <div key={`n${n}`} className="mt-10">
            <h2 className="text-lg font-semibold">{sentence(s.title!)}</h2>
            <div
              className={`mt-3 ${PROSE}`}
              style={{ color: "var(--ink-2)" }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        );
      })}

      {/* References: borderless, collapsed accordion */}
      {refsHtml ? (
        <details className="group mt-10 mb-2">
          <summary
            className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold uppercase tracking-wide marker:hidden"
            style={{ color: "var(--ink-2)" }}
          >
            References
            <span
              aria-hidden
              className="text-base leading-none transition-transform group-open:rotate-45"
              style={{ color: "var(--signal)" }}
            >
              +
            </span>
          </summary>
          <div
            className={`mt-3 ${PROSE}`}
            style={{ color: "var(--ink-2)" }}
            dangerouslySetInnerHTML={{ __html: refsHtml }}
          />
        </details>
      ) : null}

      {/* Downloads: one button per document */}
      {docs.length > 0 ? (
        <div className="mt-10">
          <h2 className="text-lg font-semibold">Downloads</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {docs.map((s, n) => (
              <a
                key={`d${n}`}
                href={s.document!.filename!}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 border px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] transition-colors hover:border-[var(--signal)] hover:text-[var(--signal)]"
                style={{ borderColor: "var(--hair)", color: "var(--ink)" }}
              >
                <Download size={15} />
                {downloadLabel(s.title!)}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
