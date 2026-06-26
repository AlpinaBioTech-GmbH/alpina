-- Extensions. pgvector powers the assistant knowledge-base similarity search
-- (kb_chunks.embedding + match_kb_chunks). On Supabase it is available; this
-- enables it. If pgvector is unavailable the assistant degrades to no-context
-- answers rather than failing.
create extension if not exists vector;
