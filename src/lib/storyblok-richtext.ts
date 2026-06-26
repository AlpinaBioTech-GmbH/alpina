// Deterministic markdown → Storyblok richtext converter. Covers exactly the
// vocabulary the writer prompt emits: ##/### headings, paragraphs, **bold**,
// *italic*, [text](url) links, "- " bullet lists, "> " blockquotes and "---"
// horizontal rules.
import { stripLongDashes } from "@/lib/strip-dashes";

// Minimal Storyblok richtext node shape (a permissive doc tree).
export interface SbRichText {
  type: string;
  attrs?: Record<string, unknown>;
  content?: SbRichText[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

interface TextNode {
  type: "text";
  text: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

function inlineNodes(md: string): TextNode[] {
  const nodes: TextNode[] = [];
  // Tokenize links first so bold/italic inside link text still get marks.
  const linkRe = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(md)) !== null) {
    if (m.index > last) nodes.push(...emphasisNodes(md.slice(last, m.index)));
    for (const inner of emphasisNodes(m[1])) {
      nodes.push({
        ...inner,
        marks: [
          ...(inner.marks ?? []),
          { type: "link", attrs: { href: m[2], target: "_blank" } },
        ],
      });
    }
    last = m.index + m[0].length;
  }
  if (last < md.length) nodes.push(...emphasisNodes(md.slice(last)));
  return nodes.filter((n) => n.text.length > 0);
}

function emphasisNodes(md: string): TextNode[] {
  const nodes: TextNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    if (m.index > last) nodes.push({ type: "text", text: md.slice(last, m.index) });
    if (m[1] !== undefined) nodes.push({ type: "text", text: m[1], marks: [{ type: "bold" }] });
    else nodes.push({ type: "text", text: m[2], marks: [{ type: "italic" }] });
    last = m.index + m[0].length;
  }
  if (last < md.length) nodes.push({ type: "text", text: md.slice(last) });
  return nodes;
}

function paragraph(md: string): SbRichText {
  return { type: "paragraph", content: inlineNodes(md) as unknown as SbRichText[] };
}

export function markdownToRichtext(markdown: string): SbRichText {
  const content: SbRichText[] = [];
  // Defense in depth: publishArticle sanitizes already, but any other caller
  // gets the same deterministic no-long-dashes guarantee.
  const lines = stripLongDashes(markdown).replace(/\r\n/g, "\n").split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }
    if (/^---+$/.test(line)) {
      content.push({ type: "horizontal_rule" });
      i++;
    } else if (line.startsWith("### ")) {
      content.push({
        type: "heading",
        attrs: { level: 3 },
        content: inlineNodes(line.slice(4)) as unknown as SbRichText[],
      });
      i++;
    } else if (line.startsWith("## ")) {
      content.push({
        type: "heading",
        attrs: { level: 2 },
        content: inlineNodes(line.slice(3)) as unknown as SbRichText[],
      });
      i++;
    } else if (line.startsWith("# ")) {
      // Page already renders the title as h1; demote stray h1s.
      content.push({
        type: "heading",
        attrs: { level: 2 },
        content: inlineNodes(line.slice(2)) as unknown as SbRichText[],
      });
      i++;
    } else if (/^[-*] /.test(line)) {
      const items: SbRichText[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i].trim())) {
        items.push({
          type: "list_item",
          content: [paragraph(lines[i].trim().slice(2))],
        });
        i++;
      }
      content.push({ type: "bullet_list", content: items });
    } else if (line.startsWith("> ")) {
      const quoted: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoted.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      content.push({
        type: "blockquote",
        content: quoted.filter(Boolean).map(paragraph),
      });
    } else {
      // Merge consecutive non-empty plain lines into one paragraph.
      const para: string[] = [line];
      i++;
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^(#{1,3} |[-*] |> |---)/.test(lines[i].trim())
      ) {
        para.push(lines[i].trim());
        i++;
      }
      content.push(paragraph(para.join(" ")));
    }
  }
  return { type: "doc", content };
}
