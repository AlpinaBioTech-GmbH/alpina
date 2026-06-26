// src/lib/rag/voyage.ts
// Voyage AI embeddings client. Anthropic has no embeddings model, so we use
// Voyage (Anthropic's recommended partner) for semantic RAG.
// POST https://api.voyageai.com/v1/embeddings  (Bearer auth)
import { EMBEDDING_MODEL, EMBEDDING_DIM, VOYAGE_MAX_BATCH } from "./config";

const ENDPOINT = "https://api.voyageai.com/v1/embeddings";

type VoyageResponse = {
  data: { embedding: number[]; index: number }[];
};

async function embed(
  input: string[],
  inputType: "query" | "document",
): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("VOYAGE_API_KEY is not set.");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input,
      input_type: inputType,
      output_dimension: EMBEDDING_DIM,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Voyage embeddings failed (${res.status}): ${detail}`);
  }

  const json = (await res.json()) as VoyageResponse;
  // Preserve input order.
  return json.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/** Embed many document chunks, batched to stay within request limits. */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += VOYAGE_MAX_BATCH) {
    const batch = texts.slice(i, i + VOYAGE_MAX_BATCH);
    out.push(...(await embed(batch, "document")));
  }
  return out;
}

/** Embed a single search query (input_type=query improves retrieval). */
export async function embedQuery(text: string): Promise<number[]> {
  const [vec] = await embed([text], "query");
  return vec;
}

/** pgvector accepts the bracketed-array text form on insert and RPC args. */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
