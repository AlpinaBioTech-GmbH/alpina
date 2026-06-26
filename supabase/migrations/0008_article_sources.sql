-- Article-pipeline sources: managed RSS feeds, a reference-document library
-- (PDFs for first-person opinion pieces), and the opinion-topic queue derived
-- from those documents. Service-role only.
--
-- No feeds are seeded by default. Add them in /admin/feeds, or seed via
-- content.config.ts (rssSeed) + the seed script.

create table if not exists public.rss_feeds (
  id         uuid primary key default gen_random_uuid(),
  url        text not null unique,
  label      text not null,
  category   text not null default 'general',
  enabled    boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.rss_feeds enable row level security;

create table if not exists public.reference_documents (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  storage_path   text,
  source_url     text,
  byte_size      int,
  page_count     int,
  extracted_text text,
  summary        text,
  status         text not null default 'active' check (status in ('active','archived')),
  created_at     timestamptz not null default now()
);
alter table public.reference_documents enable row level security;

create table if not exists public.opinion_topics (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.reference_documents (id) on delete cascade,
  topic        text not null,
  angle        text not null,
  status       text not null default 'pending' check (status in ('pending','written','dismissed')),
  article_id   text,
  article_slug text,
  position     int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists opinion_topics_pending_idx on public.opinion_topics (status, position);
alter table public.opinion_topics enable row level security;

-- Private bucket for uploaded reference PDFs.
insert into storage.buckets (id, name, public)
values ('reference-docs', 'reference-docs', false)
on conflict (id) do nothing;
