// Scrape each product's "read more" info sections (ASSAY CHARACTERISTICS,
// REFERENCES, INSTRUCTIONS FOR USE, Safety Data Sheet, BATCH/LOT INFORMATION,
// ...) from the live site. Each section is {id,title,description(HTML),index}.
// Writes data/product-sections.json:
//   { "<slug>": [ { "title": "...", "html": "...", "pdfs": ["...pdf"] } ] }
import { readFileSync, writeFileSync } from "node:fs";

const catalog = JSON.parse(readFileSync(new URL("../data/products.json", import.meta.url), "utf8")) as {
  products: { slug: string }[];
};

const SECTION_RE =
  /"id":"[0-9a-f-]+","title":"((?:[^"\\]|\\.)*)","description":"((?:[^"\\]|\\.)*)","index":(\d+)/g;
const PDF_RE = /https?:\/\/[a-z0-9-]+\.usrfiles\.com\/ugd\/[a-z0-9_]+\.pdf/g;

type Section = { title: string; html: string; index: number; pdfs: string[] };

function extract(html: string): Section[] {
  const seen = new Set<string>();
  const out: Section[] = [];
  let m: RegExpExecArray | null;
  while ((m = SECTION_RE.exec(html))) {
    let title: string, desc: string;
    try {
      title = JSON.parse(`"${m[1]}"`);
      desc = JSON.parse(`"${m[2]}"`);
    } catch {
      continue;
    }
    const index = Number(m[3]);
    const key = `${title}#${index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const pdfs = [...desc.matchAll(PDF_RE)].map((x) => x[0]);
    out.push({ title, html: desc, index, pdfs });
  }
  return out.sort((a, b) => a.index - b.index);
}

async function main() {
  const result: Record<string, { title: string; html: string; pdfs: string[] }[]> = {};
  const titles = new Map<string, number>();
  const pdfs = new Set<string>();
  for (const { slug } of catalog.products) {
    try {
      const res = await fetch(`https://www.alpinabiotech.com/product-page/${slug}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      const html = await res.text();
      const sections = extract(html).map((s) => ({ title: s.title, html: s.html, pdfs: s.pdfs }));
      result[slug] = sections;
      for (const s of sections) {
        titles.set(s.title, (titles.get(s.title) ?? 0) + 1);
        s.pdfs.forEach((p) => pdfs.add(p));
      }
      console.log(`${slug}: ${sections.length} sections (${sections.reduce((n, s) => n + s.pdfs.length, 0)} pdfs)`);
    } catch (e) {
      console.error(`${slug}: FAILED ${(e as Error).message}`);
      result[slug] = [];
    }
  }
  writeFileSync(new URL("../data/product-sections.json", import.meta.url), JSON.stringify(result, null, 2));
  console.log("\nSection titles seen:", [...titles.entries()].map(([t, n]) => `${t} (${n})`).join(", "));
  console.log(`Distinct PDFs: ${pdfs.size}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
