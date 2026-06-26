// Validate the feeds in data/feeds-seed.json and insert the working ones into
// the rss_feeds table (used by the article pipeline + /admin/feeds).
//
// For each feed: fetch the URL and check it is real RSS/Atom XML. If not (e.g.
// a homepage for a "generate" entry), try discovering the feed via the page's
// <link rel="alternate" type="application/rss+xml">. Null-URL entries (PubMed
// saved searches) are skipped - they must be minted manually.
//
//   npx tsx scripts/seed-feeds.ts
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { readFileSync } from "node:fs";
import { Client } from "pg";

type Feed = { name: string; url: string | null; category: string; status: string };
const feeds = (JSON.parse(readFileSync(new URL("../data/feeds-seed.json", import.meta.url), "utf8")) as { feeds: Feed[] }).feeds;

const UA = "Mozilla/5.0 (compatible; AlpinaBioTechFeedBot/1.0)";

async function fetchText(url: string, timeoutMs = 12000): Promise<{ ok: boolean; status: number; ct: string; body: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/atom+xml, application/xml, text/html, */*" }, redirect: "follow", signal: ctrl.signal });
    const ct = res.headers.get("content-type") || "";
    const body = await res.text();
    return { ok: res.ok, status: res.status, ct, body };
  } catch {
    return { ok: false, status: 0, ct: "", body: "" };
  } finally {
    clearTimeout(t);
  }
}

function looksLikeFeed(ct: string, body: string): boolean {
  if (/xml|rss|atom/i.test(ct)) {
    // content-type says xml, but make sure it's actually a feed not an error page
    return /<rss|<feed|<rdf:rdf|<\?xml/i.test(body.slice(0, 3000));
  }
  return /<rss[\s>]|<feed[\s>]|<rdf:RDF/i.test(body.slice(0, 3000));
}

function discoverFeedHref(html: string, baseUrl: string): string | null {
  // <link rel="alternate" type="application/rss+xml" href="...">
  const re = /<link[^>]+type=["'](?:application\/(?:rss|atom)\+xml)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const hrefM = /href=["']([^"']+)["']/i.exec(m[0]);
    if (hrefM) {
      try {
        return new URL(hrefM[1], baseUrl).href;
      } catch {
        /* skip */
      }
    }
  }
  return null;
}

type Resolved = { ok: true; url: string } | { ok: false; reason: string };

async function resolve(feed: Feed): Promise<Resolved> {
  if (!feed.url) return { ok: false, reason: "no url (manual saved-search)" };
  const r = await fetchText(feed.url);
  if (r.ok && looksLikeFeed(r.ct, r.body)) return { ok: true, url: feed.url };
  // Try discovery from whatever we got (often a homepage).
  if (r.body) {
    const href = discoverFeedHref(r.body, feed.url);
    if (href) {
      const r2 = await fetchText(href);
      if (r2.ok && looksLikeFeed(r2.ct, r2.body)) return { ok: true, url: href };
    }
  }
  return { ok: false, reason: r.status ? `not a feed (HTTP ${r.status})` : "unreachable" };
}

async function main() {
  const ok: { url: string; label: string; category: string }[] = [];
  const skipped: { name: string; reason: string }[] = [];

  for (const feed of feeds) {
    const res = await resolve(feed);
    if (res.ok) {
      ok.push({ url: res.url, label: feed.name, category: feed.category });
      console.log(`  OK   ${feed.name}${res.url !== feed.url ? ` (discovered: ${res.url})` : ""}`);
    } else {
      skipped.push({ name: feed.name, reason: res.reason });
      console.log(`  SKIP ${feed.name} - ${res.reason}`);
    }
  }

  console.log(`\n${ok.length} valid, ${skipped.length} skipped. Inserting into rss_feeds...`);

  const c = new Client({
    host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
    user: process.env.SUPABASE_DB_USER, database: process.env.SUPABASE_DB_NAME,
    password: process.env.SUPABASE_DB_PASSWORD, ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  let inserted = 0;
  for (const f of ok) {
    const r = await c.query(
      "insert into public.rss_feeds (url, label, category, enabled) values ($1,$2,$3,true) on conflict (url) do nothing",
      [f.url, f.label, f.category],
    );
    inserted += r.rowCount ?? 0;
  }
  const { rows } = await c.query("select count(*)::int n from rss_feeds where enabled");
  await c.end();
  console.log(`Inserted ${inserted} new feeds. rss_feeds now has ${rows[0].n} enabled.`);

  if (skipped.length) {
    console.log("\nSkipped (add manually in /admin/feeds if you can source a working RSS URL):");
    for (const s of skipped) console.log(`  - ${s.name}: ${s.reason}`);
  }
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
