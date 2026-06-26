// src/lib/rag/chunk.ts
// Paragraph-aware character chunking with overlap. Good enough for marketing
// copy and short documents; keeps related sentences together.
import { CHUNK_SIZE, CHUNK_OVERLAP } from "./config";

export function chunkText(
  raw: string,
  { size = CHUNK_SIZE, overlap = CHUNK_OVERLAP } = {},
): string[] {
  const text = raw.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return [];
  if (text.length <= size) return [text];

  // Split on paragraph boundaries, then pack paragraphs into chunks.
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    // Start the next chunk with a tail overlap for context continuity.
    current = overlap > 0 ? trimmed.slice(-overlap) : "";
  };

  for (const para of paragraphs) {
    // A single oversized paragraph is hard-split by length.
    if (para.length > size) {
      if (current.trim()) flush();
      for (let i = 0; i < para.length; i += size - overlap) {
        chunks.push(para.slice(i, i + size).trim());
      }
      current = "";
      continue;
    }
    if ((current + "\n\n" + para).length > size) flush();
    current = current ? `${current}\n\n${para}` : para;
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.filter((c) => c.length > 0);
}
