-- Public AI assistant: single-row config + knowledge base (documents + embedded
-- chunks) + cosine-similarity search RPC. All access is server-side via the
-- service role. RLS ON with no anon policies.
--
-- Embeddings use Voyage (voyage-3.5), 1024 dimensions. If you change the
-- embedding model/dimension, update vector(1024) here AND EMBEDDING_DIM in
-- src/lib/rag/config.ts, then re-embed.

-- --- Assistant config (single row, id = 'default') ------------------------
create table if not exists public.assistant_config (
  id                     text primary key default 'default',
  updated_at             timestamptz not null default now(),
  enabled                boolean not null default true,
  system_prompt          text not null default '',
  preset_questions       jsonb not null default '[]'::jsonb,   -- string[]
  excluded_slug_prefixes jsonb not null default '[]'::jsonb,   -- Storyblok prefixes skipped on sync
  model                  text not null default 'claude-haiku-4-5'
);

-- Generic seed. The app re-seeds the prompt/questions from brand.config on
-- first admin save; edit there, not here.
insert into public.assistant_config (id, system_prompt, preset_questions)
values (
  'default',
  'You are the assistant for this website. Answer using only the provided context. If the context does not contain the answer, say so plainly and suggest contacting the team. Be concise, accurate, and friendly.',
  '["What does this company do?", "How do I get in touch?", "What are your latest articles about?"]'::jsonb
)
on conflict (id) do nothing;

-- --- Knowledge base: documents + chunks -----------------------------------
create table if not exists public.kb_documents (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  source_type    text not null,                    -- 'storyblok' | 'upload' | 'note'
  title          text not null,
  storyblok_uuid text,                             -- when source_type = 'storyblok'
  source_url     text,                             -- citation link (Storyblok page URL)
  storage_path   text,                             -- when source_type = 'upload'
  status         text not null default 'pending',  -- 'pending' | 'ready' | 'error'
  error          text,
  chunk_count    integer not null default 0
);

create table if not exists public.kb_chunks (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  document_id  uuid not null references public.kb_documents(id) on delete cascade,
  content      text not null,
  embedding    vector(1024),
  token_count  integer,
  metadata     jsonb not null default '{}'::jsonb
);

-- HNSW cosine index. High recall by default (no probes/lists tuning), and
-- correct at any corpus size - unlike IVFFlat, which on a small corpus with the
-- default probes=1 scans a single cluster and returns few/wrong matches.
create index if not exists kb_chunks_embedding_idx
  on public.kb_chunks
  using hnsw (embedding vector_cosine_ops);

create index if not exists kb_chunks_document_id_idx
  on public.kb_chunks (document_id);

-- --- Similarity search RPC (signature is referenced by lib/rag/retrieve.ts) -
create or replace function public.match_kb_chunks(
  query_embedding vector(1024),
  match_count int default 6,
  similarity_threshold float default 0.0
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float,
  metadata jsonb
)
language sql stable
as $$
  select
    c.id,
    c.document_id,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity,
    c.metadata
  from public.kb_chunks c
  where c.embedding is not null
    and 1 - (c.embedding <=> query_embedding) >= similarity_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

alter table public.assistant_config enable row level security;
alter table public.kb_documents     enable row level security;
alter table public.kb_chunks        enable row level security;
