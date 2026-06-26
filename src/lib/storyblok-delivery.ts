// Component-free Storyblok delivery reads for non-Next contexts (the article
// pipeline CLI, cron, scripts). The main lib/storyblok.ts registers the React
// component map, which transitively imports `server-only` (via the image
// helper) and so cannot load under plain `tsx`. These helpers hit the delivery
// CDN directly - published version only, which is what those contexts want.
//
// In a Next request, keep using lib/storyblok.ts (draftMode-aware + cached).

const REGION_HOST: Record<string, string> = {
  eu: "https://api.storyblok.com",
  us: "https://api-us.storyblok.com",
  ap: "https://api-ap.storyblok.com",
  ca: "https://api-ca.storyblok.com",
  cn: "https://app.storyblokchina.com",
};

export type DeliveryStory = {
  uuid: string;
  name: string;
  slug: string;
  full_slug: string;
  content: Record<string, unknown>;
};

function deliveryBase(): { host: string; token: string } | null {
  const token = process.env.NEXT_PUBLIC_STORYBLOK_TOKEN;
  if (!token) return null;
  const region = (process.env.NEXT_PUBLIC_STORYBLOK_REGION || "eu").toLowerCase();
  return { host: REGION_HOST[region] ?? REGION_HOST.eu, token };
}

/** List published stories under a slug prefix. Returns [] when unconfigured. */
export async function fetchStoriesRaw(
  startsWith: string,
  options: Record<string, string | number> = {},
): Promise<DeliveryStory[]> {
  const base = deliveryBase();
  if (!base) return [];
  const params = new URLSearchParams({
    token: base.token,
    version: "published",
    starts_with: startsWith,
    resolve_links: "url",
    per_page: "100",
  });
  for (const [k, v] of Object.entries(options)) params.set(k, String(v));
  const res = await fetch(`${base.host}/v2/cdn/stories?${params.toString()}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { stories?: DeliveryStory[] };
  return data.stories ?? [];
}

/** Fetch a single published story by slug. Returns null when unconfigured/404. */
export async function fetchStoryRaw(slug: string): Promise<DeliveryStory | null> {
  const base = deliveryBase();
  if (!base) return null;
  const params = new URLSearchParams({
    token: base.token,
    version: "published",
    resolve_links: "url",
  });
  const res = await fetch(`${base.host}/v2/cdn/stories/${slug}?${params.toString()}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { story?: DeliveryStory };
  return data.story ?? null;
}
