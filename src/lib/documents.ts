// Reference-document library: PDFs uploaded (or fetched by URL) into the
// private `reference-docs` Storage bucket, text-extracted with unpdf, then
// analyzed by Claude into a summary plus a queue of opinion/debate angles
// (opinion_topics) that the article pipeline writes one per run.
//
// Native Anthropic PDF blocks are capped at ~100 pages; large papers are why
// extraction happens server-side.
import { extractText, getDocumentProxy } from "unpdf";
import type Anthropic from "@anthropic-ai/sdk";
import { serviceClient } from "@/lib/supabase/service";
import { MODELS, todayLine, forcedToolCall } from "@/lib/anthropic/client";
import { content } from "@/lib/config";

export const DOCUMENTS_BUCKET = "reference-docs";
const EXTRACT_CAP = 400_000; // chars stored
const ANALYZE_CAP = 100_000; // chars sent to Claude

/** Long documents: sample head + tail so late chapters inform the analysis too. */
function analysisExcerpt(text: string): string {
  if (text.length <= ANALYZE_CAP) return text;
  const head = text.slice(0, Math.floor(ANALYZE_CAP * 0.8));
  const tail = text.slice(-Math.floor(ANALYZE_CAP * 0.2));
  return `${head}\n\n[... document truncated ...]\n\n${tail}`;
}

export interface ReferenceDocument {
  id: string;
  title: string;
  storage_path: string | null;
  source_url: string | null;
  byte_size: number | null;
  page_count: number | null;
  summary: string | null;
  status: string;
  created_at: string;
}

export interface OpinionTopic {
  id: string;
  document_id: string;
  topic: string;
  angle: string;
  status: string;
  article_id: string | null;
  article_slug: string | null;
  position: number;
}

async function extractPdfText(bytes: Uint8Array): Promise<{ text: string; pages: number }> {
  const pdf = await getDocumentProxy(bytes);
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  return { text: (text as string).slice(0, EXTRACT_CAP), pages: totalPages };
}

/**
 * Register a document from Storage (browser-uploaded) or by fetching a
 * public URL server-side (URL-fetched PDFs are stored in the bucket too).
 * Extracts text and creates the row; analysis is a separate step.
 */
export async function registerDocument(opts: {
  path?: string;
  sourceUrl?: string;
  title: string;
  byteSize?: number;
}): Promise<{ id: string }> {
  const db = serviceClient();
  if (!db) throw new Error("Supabase not configured");

  let bytes: Uint8Array;
  let storagePath = opts.path ?? null;

  if (opts.path) {
    const { data, error } = await db.storage.from(DOCUMENTS_BUCKET).download(opts.path);
    if (error || !data) throw new Error(`download from storage failed: ${error?.message}`);
    bytes = new Uint8Array(await data.arrayBuffer());
  } else if (opts.sourceUrl) {
    const res = await fetch(opts.sourceUrl, { redirect: "follow" });
    if (!res.ok) throw new Error(`fetching PDF failed (${res.status})`);
    bytes = new Uint8Array(await res.arrayBuffer());
    storagePath = `url/${Date.now()}-${opts.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}.pdf`;
    const { error: upErr } = await db.storage
      .from(DOCUMENTS_BUCKET)
      .upload(storagePath, bytes, { contentType: "application/pdf" });
    if (upErr) console.warn("[documents] storing URL-fetched PDF failed:", upErr.message);
  } else {
    throw new Error("registerDocument needs path or sourceUrl");
  }

  const { text, pages } = await extractPdfText(bytes);
  if (text.trim().length < 200) {
    throw new Error("could not extract meaningful text from the PDF (scanned image-only document?)");
  }

  const { data, error } = await db
    .from("reference_documents")
    .insert({
      title: opts.title,
      storage_path: storagePath,
      source_url: opts.sourceUrl ?? null,
      byte_size: opts.byteSize ?? bytes.byteLength,
      page_count: pages,
      extracted_text: text,
    })
    .select("id")
    .single();
  if (error) throw new Error(`saving document failed: ${error.message}`);
  return { id: data.id as string };
}

interface Analysis {
  title: string;
  summary: string;
  topics: { topic: string; angle: string }[];
}

const SUBMIT_ANALYSIS_TOOL: Anthropic.Tool = {
  name: "submit_analysis",
  description: "Submit the document analysis exactly once.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Clean document title." },
      summary: { type: "string", description: "2-3 sentence factual summary of the document." },
      topics: {
        type: "array",
        items: {
          type: "object",
          properties: {
            topic: { type: "string", description: "Short opinion-article topic (a headline-able theme)." },
            angle: {
              type: "string",
              description:
                "2-3 sentences: the claim, the strongest counterpoint, and why it matters for the reader.",
            },
          },
          required: ["topic", "angle"],
        },
        description: "5-7 distinct opinion/debate angles.",
      },
    },
    required: ["title", "summary", "topics"],
  },
};

/** Analyze a document into summary + opinion-topic queue (replaces pending topics). */
export async function analyzeDocument(documentId: string): Promise<{ topics: number }> {
  const db = serviceClient();
  if (!db) throw new Error("Supabase not configured");
  const { data: doc, error } = await db
    .from("reference_documents")
    .select("id, title, extracted_text")
    .eq("id", documentId)
    .single();
  if (error || !doc) throw new Error(`document not found: ${error?.message}`);

  const w = content.writer;
  const system = `You are the editorial strategist for ${w.publication}. Audience: ${w.audience}.

Given a reference document, produce:
1. A clean title and a 2-3 sentence factual summary.
2. 5-7 DISTINCT opinion/debate angles for first-person articles by ${w.opinionAuthorName}. Each angle must name a genuine point of debate in or around the document (a claim someone could reasonably push back on), the strongest counterargument, and the reader-relevant stake. Angles must not overlap; favor specific, contestable takes over generic praise.

${todayLine()}`;

  const analysis = await forcedToolCall<Analysis>({
    model: MODELS.editor,
    system,
    messages: [
      {
        role: "user",
        content: `DOCUMENT: ${doc.title}\n\nEXTRACTED TEXT (may be truncated):\n${analysisExcerpt(doc.extracted_text as string)}\n\nSubmit the analysis via submit_analysis.`,
      },
    ],
    tool: SUBMIT_ANALYSIS_TOOL,
    maxTokens: 4096,
  });

  await db
    .from("reference_documents")
    .update({ title: analysis.title || doc.title, summary: analysis.summary })
    .eq("id", documentId);

  // Replace this document's still-pending topics; keep written/dismissed history.
  await db.from("opinion_topics").delete().eq("document_id", documentId).eq("status", "pending");
  const rows = (analysis.topics ?? []).slice(0, 7).map((t, i) => ({
    document_id: documentId,
    topic: t.topic,
    angle: t.angle,
    position: i,
  }));
  if (rows.length > 0) {
    const { error: insErr } = await db.from("opinion_topics").insert(rows);
    if (insErr) throw new Error(`saving topics failed: ${insErr.message}`);
  }
  return { topics: rows.length };
}

/** Next pending opinion topic with its document context, for the pipeline. */
export async function nextPendingTopic(): Promise<
  | (OpinionTopic & { documentTitle: string; documentText: string; documentSourceUrl: string | null })
  | null
> {
  try {
    const db = serviceClient();
    if (!db) return null;
    const { data: topic } = await db
      .from("opinion_topics")
      .select("*")
      .eq("status", "pending")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!topic) return null;
    const { data: doc } = await db
      .from("reference_documents")
      .select("title, extracted_text, source_url, status")
      .eq("id", topic.document_id)
      .single();
    if (!doc || doc.status !== "active") return null;
    return {
      ...(topic as OpinionTopic),
      documentTitle: doc.title as string,
      documentText: analysisExcerpt((doc.extracted_text as string) ?? ""),
      documentSourceUrl: (doc.source_url as string) ?? null,
    };
  } catch {
    return null;
  }
}

export async function markTopicWritten(
  topicId: string,
  article: { id: string; slug: string },
): Promise<void> {
  try {
    const db = serviceClient();
    if (!db) return;
    await db
      .from("opinion_topics")
      .update({ status: "written", article_id: article.id, article_slug: article.slug })
      .eq("id", topicId);
  } catch (err) {
    console.error("[documents] markTopicWritten failed:", err);
  }
}
