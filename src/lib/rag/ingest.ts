// src/lib/rag/ingest.ts
// Turn a document's text into embedded, searchable chunks. Used by the upload,
// note, and Storyblok-sync admin actions. All DB access is via the service/
// secret-key client (RLS bypass).
import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkText } from "./chunk";
import { embedDocuments, toVectorLiteral } from "./voyage";

const INSERT_BATCH = 100;

/**
 * (Re)build the chunk + embedding rows for an existing kb_documents row.
 * Replaces any prior chunks for that document. Updates the document status.
 */
export async function ingestDocumentText(
  db: SupabaseClient,
  documentId: string,
  text: string,
): Promise<{ chunkCount: number }> {
  try {
    const chunks = chunkText(text);

    // Replace existing chunks (idempotent re-index).
    await db.from("kb_chunks").delete().eq("document_id", documentId);

    if (chunks.length === 0) {
      await db
        .from("kb_documents")
        .update({ status: "ready", chunk_count: 0, error: null, updated_at: new Date().toISOString() })
        .eq("id", documentId);
      return { chunkCount: 0 };
    }

    const embeddings = await embedDocuments(chunks);

    const rows = chunks.map((content, i) => ({
      document_id: documentId,
      content,
      embedding: toVectorLiteral(embeddings[i]),
      token_count: Math.round(content.length / 4),
      metadata: { index: i },
    }));

    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      const { error } = await db
        .from("kb_chunks")
        .insert(rows.slice(i, i + INSERT_BATCH));
      if (error) throw new Error(error.message);
    }

    await db
      .from("kb_documents")
      .update({
        status: "ready",
        chunk_count: chunks.length,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    return { chunkCount: chunks.length };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ingestion failed.";
    await db
      .from("kb_documents")
      .update({ status: "error", error: message, updated_at: new Date().toISOString() })
      .eq("id", documentId);
    throw e;
  }
}

/** Create a kb_documents row in 'pending' state and return its id. */
export async function createDocument(
  db: SupabaseClient,
  input: {
    source_type: "upload" | "note" | "storyblok";
    title: string;
    storyblok_uuid?: string | null;
    storage_path?: string | null;
    source_url?: string | null;
  },
): Promise<string> {
  const { data, error } = await db
    .from("kb_documents")
    .insert({
      source_type: input.source_type,
      title: input.title,
      storyblok_uuid: input.storyblok_uuid ?? null,
      storage_path: input.storage_path ?? null,
      source_url: input.source_url ?? null,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}
