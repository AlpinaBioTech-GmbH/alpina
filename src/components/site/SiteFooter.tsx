// src/components/site/SiteFooter.tsx
// Global footer: wordmark, nav repeat, optional secondary link, legal links,
// the tagline, and the contact email. Fed by global_config. Dark surface to
// bookend the page.
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { resolveLink } from "@/lib/links";
import { brand } from "@/lib/config";
import type { GlobalConfig } from "@/components/site/SiteHeader";
import NewsletterForm from "@/components/site/NewsletterForm";

export default function SiteFooter({ config }: { config?: GlobalConfig | null }) {
  const email = config?.contact_email?.trim() || brand.contact.email;
  const nav = (config?.nav_items ?? []).map((n) => ({
    label: n.label ?? "",
    ...resolveLink(n.href),
  }));
  const legal = (config?.footer_links ?? []).map((n) => ({
    label: n.label ?? "",
    ...resolveLink(n.href),
  }));
  const secondary = brand.nav.secondaryLink
    ? {
        label: brand.nav.secondaryLink.label,
        href: brand.nav.secondaryLink.href,
        external: /^(https?:)?\/\//.test(brand.nav.secondaryLink.href),
      }
    : null;

  return (
    <footer
      style={{ background: "var(--void)", color: "var(--mist)", borderColor: "var(--steel)" }}
      className="border-t px-6 py-16"
    >
      <div className="mx-auto max-w-6xl">
        {/* Newsletter signup band */}
        <div
          style={{ borderColor: "var(--steel)" }}
          className="mb-12 flex flex-col gap-5 border-b pb-12 md:flex-row md:items-center md:justify-between"
        >
          <div className="max-w-md">
            <p
              style={{ fontFamily: "var(--font-heading)", color: "var(--on-contrast)" }}
              className="text-xl font-bold"
            >
              Stay in the loop
            </p>
            <p className="mt-1 text-sm">
              A monthly digest of our latest articles, straight to your inbox.{" "}
              <Link href="/newsletter" className="underline underline-offset-2 hover:text-[var(--signal)]">
                Browse past issues
              </Link>
              .
            </p>
          </div>
          <NewsletterForm />
        </div>

        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div>
            <span
              style={{ fontFamily: "var(--font-heading)", color: "var(--on-contrast)" }}
              className="text-2xl font-extrabold tracking-tight"
            >
              {brand.name}
            </span>
            <p
              style={{ fontFamily: "var(--font-mono)" }}
              className="mt-4 text-xs uppercase tracking-[0.12em]"
            >
              {brand.tagline}
            </p>
            <a
              href={`mailto:${email}`}
              style={{ color: "var(--on-contrast)" }}
              className="mt-2 inline-block text-sm hover:text-[var(--signal)]"
            >
              {email}
            </a>
          </div>

          {/* Nav repeat */}
          <nav className="flex flex-col gap-3">
            {nav.map((l) => (
              <Link
                key={l.href + l.label}
                href={l.href}
                style={{ fontFamily: "var(--font-mono)" }}
                className="text-xs uppercase tracking-[0.12em] hover:text-[var(--on-contrast)]"
              >
                {l.label}
              </Link>
            ))}
            {secondary && (
              <a
                href={secondary.href}
                {...(secondary.external ? { target: "_blank", rel: "noopener" } : {})}
                style={{ fontFamily: "var(--font-mono)" }}
                className="inline-flex items-center gap-0.5 text-xs uppercase tracking-[0.12em] hover:text-[var(--on-contrast)]"
              >
                {secondary.label}
                {secondary.external && <ArrowUpRight size={12} />}
              </a>
            )}
          </nav>
        </div>

        {/* Legal row */}
        <div
          style={{ borderColor: "var(--steel)" }}
          className="mt-12 flex flex-col gap-4 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between"
        >
          <p>© {new Date().getFullYear()} {brand.legalName}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {legal.map((l) => (
              <Link
                key={l.href + l.label}
                href={l.href}
                className="hover:text-[var(--on-contrast)]"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
