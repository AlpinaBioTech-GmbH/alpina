// Resolve a Storyblok multilink field to an href + external flag, so nav,
// footer, and CTA links render consistently (internal -> next/link,
// external -> <a target="_blank" rel="noopener">).

export type SbLink = {
  url?: string;
  cached_url?: string;
  linktype?: string;
  email?: string;
};

export type ResolvedLink = { href: string; external: boolean };

export function resolveLink(link?: SbLink): ResolvedLink {
  if (!link) return { href: "#", external: false };

  if (link.linktype === "email" && link.email) {
    return { href: `mailto:${link.email}`, external: true };
  }

  const raw = link.url || link.cached_url || "";
  if (!raw) return { href: "#", external: false };

  const external = /^(https?:)?\/\//.test(raw) || link.linktype === "asset";
  if (external) return { href: raw, external: true };

  // Internal story/path - ensure a leading slash.
  return { href: raw.startsWith("/") ? raw : `/${raw}`, external: false };
}
