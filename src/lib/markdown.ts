// src/lib/markdown.ts
// Shared helpers for rendering assistant messages.
export type Source = { title: string; url: string | null };

/** Turn inline [Title] citations into Markdown links when the URL is known. */
export function linkifyCitations(text: string, sources: Source[] = []): string {
  let out = text;
  for (const s of sources) {
    if (!s.url) continue;
    // Literal replace (titles can contain regex-special characters).
    out = out.split(`[${s.title}]`).join(`[${s.title}](${s.url})`);
  }
  return out;
}
