// RSS lead fetching for the article pipeline. Feeds are managed in the
// rss_feeds table (admin /admin/feeds); the content.rssSeed list is the
// fallback when the table is empty or unreachable. Dependency-free parse:
// plain RSS 2.0 <item> blocks via regexes. One dead feed must never abort
// a run — every feed fetch is individually try/caught.
import { serviceClient } from "@/lib/supabase/service";
import { content } from "@/lib/config";

export interface Lead {
  title: string;
  url: string;
  source: string;
  publishedAt: string; // ISO
}

// Seed feeds from the content config (editable per-brand). Empty by default.
const DEFAULT_FEEDS: string[] = content.rssSeed.map((f) => f.url);

// Some institution sites and WAF-fronted WordPress feeds reject header-less requests.
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/rss+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1]) : "";
}

function parseFeed(xml: string, feedUrl: string): Lead[] {
  const source = new URL(feedUrl).hostname.replace(/^www\./, "");
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  const leads: Lead[] = [];
  for (const item of items) {
    const title = tag(item, "title");
    const url = tag(item, "link");
    const pubDate = tag(item, "pubDate") || tag(item, "dc:date");
    if (!title || !url) continue;
    const parsed = new Date(pubDate);
    if (isNaN(parsed.getTime())) continue;
    leads.push({ title, url, source, publishedAt: parsed.toISOString() });
  }
  return leads;
}

async function feedUrls(): Promise<string[]> {
  try {
    const db = serviceClient();
    if (!db) return DEFAULT_FEEDS;
    const { data, error } = await db.from("rss_feeds").select("url").eq("enabled", true);
    if (error || !data || data.length === 0) return DEFAULT_FEEDS;
    return data.map((r) => r.url as string);
  } catch {
    return DEFAULT_FEEDS;
  }
}

export async function fetchLeads(
  opts: { sinceHours?: number; limit?: number } = {},
): Promise<Lead[]> {
  const sinceHours = opts.sinceHours ?? 24 * 8;
  const limit = opts.limit ?? 60;
  const cutoff = Date.now() - sinceHours * 3600_000;
  const feeds = await feedUrls();

  const perFeed = await Promise.all(
    feeds.map(async (feedUrl) => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 15_000);
        try {
          const res = await fetch(feedUrl, { headers: BROWSER_HEADERS, signal: ctrl.signal });
          if (!res.ok) return [];
          const xml = await res.text();
          return parseFeed(xml, feedUrl)
            .filter((l) => new Date(l.publishedAt).getTime() >= cutoff)
            .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
        } finally {
          clearTimeout(t);
        }
      } catch {
        return [];
      }
    }),
  );

  // Interleave feeds round-robin so a prolific feed can't crowd out the rest,
  // then dedupe by URL and cap.
  const seen = new Set<string>();
  const leads: Lead[] = [];
  const maxLen = Math.max(0, ...perFeed.map((f) => f.length));
  for (let i = 0; i < maxLen && leads.length < limit; i++) {
    for (const feed of perFeed) {
      const lead = feed[i];
      if (!lead || seen.has(lead.url)) continue;
      seen.add(lead.url);
      leads.push(lead);
      if (leads.length >= limit) break;
    }
  }
  return leads;
}
