// src/components/storyblok/CtaBand.tsx
// Reusable CTA band. Dark surface with the single signal accent on the action.
import { storyblokEditable } from "@storyblok/react/rsc";
import Link from "next/link";
import { resolveLink, type SbLink } from "@/lib/links";

type CtaBandBlok = {
  _uid: string;
  component: string;
  heading?: string;
  body?: string;
  cta_label?: string;
  cta_href?: SbLink;
};

export default function CtaBand({ blok }: { blok: CtaBandBlok }) {
  const { href, external } = resolveLink(blok.cta_href);

  return (
    <section
      {...storyblokEditable(blok)}
      style={{ background: "var(--void)", color: "var(--on-contrast)" }}
      className="px-6 py-20 md:py-24"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          {blok.heading && (
            <h2
              style={{ fontFamily: "var(--font-heading)", color: "var(--on-contrast)" }}
              className="text-3xl leading-tight md:text-4xl"
            >
              {blok.heading}
            </h2>
          )}
          {blok.body && (
            <p style={{ color: "var(--mist)" }} className="mt-4 text-lg leading-relaxed">
              {blok.body}
            </p>
          )}
        </div>

        {blok.cta_label && (
          <Link
            href={href}
            {...(external ? { target: "_blank", rel: "noopener" } : {})}
            style={{ background: "var(--signal)", color: "var(--on-signal)", fontFamily: "var(--font-mono)" }}
            className="inline-flex shrink-0 items-center self-start px-6 py-3 text-sm font-semibold uppercase tracking-[0.08em] md:self-auto"
          >
            {blok.cta_label}
          </Link>
        )}
      </div>
    </section>
  );
}
