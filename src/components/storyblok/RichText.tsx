// src/components/storyblok/RichText.tsx
// Generic long-form rich-text section: legal pages (privacy / imprint / terms)
// and any prose content.
import {
  storyblokEditable,
  renderRichText,
  type SbBlokData,
} from "@storyblok/react/rsc";

type Richtext = Parameters<typeof renderRichText>[0];
type RichTextBlok = {
  _uid: string;
  component: string;
  heading?: string;
  last_updated?: string;
  content?: Richtext;
};

export default function RichText({ blok }: { blok: RichTextBlok }) {
  const html = blok.content ? renderRichText(blok.content) : "";
  const updated = blok.last_updated
    ? new Date(blok.last_updated.replace(" ", "T")).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <section
      {...storyblokEditable(blok as unknown as SbBlokData)}
      style={{ background: "var(--paper)", color: "var(--ink-2)" }}
      className="px-6 py-16 md:py-20"
    >
      <div className="mx-auto max-w-3xl">
        {(blok.heading || updated) && (
          <div className="mb-8">
            {blok.heading && (
              <h2
                style={{ fontFamily: "var(--font-heading)", color: "var(--ink)" }}
                className="text-3xl leading-tight md:text-4xl"
              >
                {blok.heading}
              </h2>
            )}
            {updated && (
              <p
                style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}
                className="mt-3 text-xs uppercase tracking-[0.12em]"
              >
                Last updated: {updated}
              </p>
            )}
          </div>
        )}
        {html && (
          <div
            className="space-y-4 leading-relaxed [&_a]:underline [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[var(--ink)] [&_h2]:font-[family-name:var(--font-heading)] [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_li]:pl-1"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </section>
  );
}
