// src/lib/rag/parse.ts
// Extract plain text from uploaded documents. PDF via unpdf (serverless-safe
// pdf.js build), DOCX via mammoth. Old binary .doc is not supported.
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

export type ParsedDoc = { text: string };

export async function parseDocument(
  buffer: ArrayBuffer,
  filename: string,
): Promise<ParsedDoc> {
  const name = filename.toLowerCase();

  if (name.endsWith(".pdf")) {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    // mergePages: true returns a single concatenated string.
    const { text } = await extractText(pdf, { mergePages: true });
    return { text: text.trim() };
  }

  if (name.endsWith(".docx")) {
    const { value } = await mammoth.extractRawText({
      buffer: Buffer.from(buffer),
    });
    return { text: value.trim() };
  }

  if (name.endsWith(".txt") || name.endsWith(".md")) {
    return { text: new TextDecoder().decode(buffer).trim() };
  }

  throw new Error(
    "Unsupported file type. Upload a PDF, DOCX, TXT, or MD file (legacy .doc is not supported).",
  );
}
