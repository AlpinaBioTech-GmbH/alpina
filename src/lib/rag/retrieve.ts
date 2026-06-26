// src/lib/rag/retrieve.ts
// Semantic retrieval for the assistant. Embeds the query, finds the closest
// chunks via the match_kb_chunks RPC, and attaches their document titles.
// Degrades gracefully (returns []) when Supabase or Voyage are not configured.
import { getSupabaseAdmin } from "@/lib/supabase/service";
import { embedQuery, toVectorLiteral } from "./voyage";
import { RETRIEVAL_TOP_K, RETRIEVAL_MIN_SIMILARITY } from "./config";

export type RetrievedChunk = {
  content: string;
  title: string;
  url: string | null;
  similarity: number;
};

export async function retrieveContext(query: string): Promise<RetrievedChunk[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];

  // No embeddings key means no semantic search; degrade to empty context.
  if (!process.env.VOYAGE_API_KEY) return [];

  let vec: number[];
  try {
    vec = await embedQuery(query);
  } catch (e) {
    console.error("query embedding failed:", e);
    return [];
  }

  const { data, error } = await db.rpc("match_kb_chunks", {
    query_embedding: toVectorLiteral(vec),
    match_count: RETRIEVAL_TOP_K,
    similarity_threshold: RETRIEVAL_MIN_SIMILARITY,
  });
  if (error) {
    console.error("match_kb_chunks failed:", error.message);
    return [];
  }

  const rows = (data as { content: string; document_id: string; similarity: number }[]) ?? [];
  if (rows.length === 0) return [];

  // Attach human-readable document titles + URLs for citations.
  const ids = [...new Set(rows.map((r) => r.document_id))];
  const { data: docs } = await db
    .from("kb_documents")
    .select("id, title, source_url")
    .in("id", ids);
  const byId = new Map(
    ((docs as { id: string; title: string; source_url: string | null }[]) ?? []).map(
      (d) => [d.id, d],
    ),
  );

  return rows.map((r) => {
    const doc = byId.get(r.document_id);
    return {
      content: r.content,
      title: doc?.title ?? "Source",
      url: doc?.source_url ?? null,
      similarity: r.similarity,
    };
  });
}
