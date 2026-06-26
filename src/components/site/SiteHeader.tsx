// src/components/site/SiteHeader.tsx
// Global nav, fed by the global_config story. Translucent dark top bar over the
// hero. Desktop links inline; mobile collapses into <MobileNav/>. The primary
// CTA and the optional secondary link come from brand.config (chrome, not CMS).
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { resolveLink, type SbLink } from "@/lib/links";
import { brand } from "@/lib/config";
import DomainsMenu from "@/components/site/DomainsMenu";
import MobileNav from "@/components/site/MobileNav";
import { ThemeToggle } from "@/components/site/ThemeToggle";

type Asset = { filename?: string | null; alt?: string | null };
type NavCard = { name?: string; one_liner?: string; image?: Asset; href?: SbLink };
export type NavItem = {
  _uid?: string;
  label?: string;
  href?: SbLink;
  /** Optional dropdown cards. When present, this item is a mega-menu trigger. */
  children?: NavCard[];
};
export type GlobalConfig = {
  nav_items?: NavItem[];
  footer_links?: NavItem[];
  /** Contact email shown in the footer. */
  contact_email?: string;
  /** Light-colored mark for the dark theme. */
  logo_light?: Asset;
  /** Dark-colored mark for the light theme. */
  logo_dark?: Asset;
  /** Deprecated single logo (kept as a fallback for older content). */
  logo?: Asset;
  favicon?: Asset;
};

// The primary CTA is fixed chrome from brand.config, not a CMS nav item.
const CTA = brand.nav.primaryCta;
// Optional secondary link (e.g. a sister site). null hides it.
const SECONDARY = brand.nav.secondaryLink;

export default function SiteHeader({ config }: { config?: GlobalConfig | null }) {
  const navItems = config?.nav_items ?? [];
  const links = navItems.map((n) => ({
    label: n.label ?? "",
    ...resolveLink(n.href),
    children: (n.children ?? []).map((c) => ({
      name: c.name ?? "",
      one_liner: c.one_liner ?? "",
      image: c.image?.filename ?? "",
      alt: c.image?.alt ?? "",
      href: resolveLink(c.href).href,
    })),
  }));

  const secondary = SECONDARY
    ? {
        label: SECONDARY.label,
        href: SECONDARY.href,
        external: /^(https?:)?\/\//.test(SECONDARY.href),
      }
    : null;

  // Theme-aware logos: both render; CSS shows the one matching the active theme.
  const logoForDark = config?.logo_light?.filename || config?.logo?.filename;
  const logoForLight = config?.logo_dark?.filename || config?.logo?.filename;
  const hasLogo = Boolean(logoForDark || logoForLight);

  return (
    <header
      style={{
        // Dark frosted glass: a strong --void tint keeps the area behind the
        // header dark over the dark hero, while backdrop-blur softens whatever
        // scrolls underneath.
        background: "color-mix(in srgb, var(--void) 88%, transparent)",
        borderColor: "var(--steel)",
        color: "var(--on-contrast)",
      }}
      className="sticky top-0 z-50 border-b backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" aria-label={`${brand.name} home`} className="flex items-center">
          {hasLogo ? (
            <>
              {logoForDark && (
                <Image
                  src={logoForDark as string}
                  alt={config?.logo_light?.alt || brand.name}
                  width={90}
                  height={28}
                  priority
                  className="logo-for-dark"
                  style={{ height: "1.75rem", width: "auto" }}
                />
              )}
              {logoForLight && (
                <Image
                  src={logoForLight as string}
                  alt={config?.logo_dark?.alt || brand.name}
                  width={90}
                  height={28}
                  priority
                  className="logo-for-light"
                  style={{ height: "1.75rem", width: "auto" }}
                />
              )}
            </>
          ) : (
            <span
              style={{
                fontFamily: "var(--font-heading)",
                color: "var(--on-contrast)",
              }}
              className="text-xl font-extrabold tracking-tight"
            >
              {brand.name}
            </span>
          )}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) =>
            l.children.length > 0 ? (
              <DomainsMenu key={l.label} label={l.label} cards={l.children} />
            ) : (
              <Link
                key={l.href + l.label}
                href={l.href}
                style={{ fontFamily: "var(--font-mono)", color: "var(--mist)" }}
                className="text-xs uppercase tracking-[0.12em] transition-colors hover:text-[var(--on-contrast)]"
              >
                {l.label}
              </Link>
            ),
          )}

          {secondary && (
            <a
              href={secondary.href}
              {...(secondary.external ? { target: "_blank", rel: "noopener" } : {})}
              style={{ fontFamily: "var(--font-mono)", color: "var(--mist)" }}
              className="inline-flex items-center gap-0.5 text-xs uppercase tracking-[0.12em] transition-colors hover:text-[var(--on-contrast)]"
            >
              {secondary.label}
              {secondary.external && <ArrowUpRight size={12} />}
            </a>
          )}

          <Link
            href={CTA.href}
            style={{ background: "var(--signal)", color: "var(--on-signal)", fontFamily: "var(--font-mono)" }}
            className="inline-flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em]"
          >
            {CTA.label}
          </Link>

          <ThemeToggle className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--mist)] transition-colors hover:text-[var(--on-contrast)] [&_svg]:h-5 [&_svg]:w-5" />
        </nav>

        {/* Mobile */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--mist)] transition-colors hover:text-[var(--on-contrast)] [&_svg]:h-5 [&_svg]:w-5" />
          <MobileNav links={links} cta={CTA} secondary={secondary} />
        </div>
      </div>
    </header>
  );
}
