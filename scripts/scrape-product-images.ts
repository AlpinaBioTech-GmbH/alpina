// Scrape each product page's media gallery (main + related images, in order)
// from the live site and write data/product-images.json:
//   { "<slug>": ["a87ace_...~mv2.jpg", "a87ace_...~mv2.png", ...] }
// The gallery is the JSON array of {id,url,fullUrl} items where id === url.
import { readFileSync, writeFileSync } from "node:fs";

const catalog = JSON.parse(readFileSync(new URL("../data/products.json", import.meta.url), "utf8")) as {
  products: { slug: string }[];
};

// Logo + social/decorative ids to never treat as product images.
const EXCLUDE = new Set([
  "a87ace_82bc09088e7e415286eef5d4a8ff844f~mv2.jpg", // logo
]);

function galleryIds(html: string): string[] {
  const re = /"id":"(a87ace_[a-f0-9]+~mv2\.[a-z0-9]+)","url":"\1","fullUrl"/g;
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const id = m[1];
    if (EXCLUDE.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

async function main() {
  const result: Record<string, string[]> = {};
  for (const { slug } of catalog.products) {
    try {
      const res = await fetch(`https://www.alpinabiotech.com/product-page/${slug}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      const html = await res.text();
      const ids = galleryIds(html);
      result[slug] = ids;
      console.log(`${slug}: ${ids.length} image(s)`);
    } catch (e) {
      console.error(`${slug}: FAILED ${(e as Error).message}`);
      result[slug] = [];
    }
  }
  writeFileSync(new URL("../data/product-images.json", import.meta.url), JSON.stringify(result, null, 2));

  const all = new Set(Object.values(result).flat());
  const counts = Object.values(result).map((a) => a.length);
  console.log(`\nDone. ${Object.keys(result).length} products, ${all.size} distinct images.`);
  console.log(`Images per product: min ${Math.min(...counts)}, max ${Math.max(...counts)}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
