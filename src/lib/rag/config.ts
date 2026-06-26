// src/lib/rag/config.ts
// Central knobs for the assistant's retrieval-augmented generation (RAG).
// Keep EMBEDDING_DIM in sync with the vector(N) column in the SQL migration.

// Embeddings (Voyage AI).
export const EMBEDDING_MODEL = "voyage-3.5";
export const EMBEDDING_DIM = 1024; // voyage-3.5 default; matches vector(1024)
export const VOYAGE_MAX_BATCH = 96; // texts per embeddings request (limit is 1000)

// Chunking (character-based, paragraph-aware).
export const CHUNK_SIZE = 1600; // ~400 tokens
export const CHUNK_OVERLAP = 200;

// Retrieval.
export const RETRIEVAL_TOP_K = 6;
export const RETRIEVAL_MIN_SIMILARITY = 0.2;

// Generation (Claude). One place to change the assistant model. Haiku 4.5 is
// the cost-sensitive default for a public, RAG-grounded widget; bump to
// "claude-sonnet-4-6" for higher answer quality.
export const DEFAULT_ASSISTANT_MODEL = "claude-haiku-4-5";
