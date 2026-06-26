-- Run log for every content automation (articles, newsletter, and each social
-- platform). Service-role only (RLS ON, no public policies). The draft column
-- persists the generated article so a failed publish can be recovered from the
-- admin without regenerating.

create table if not exists public.pipeline_runs (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('articles','newsletter','linkedin','twitter','instagram')),
  trigger        text not null default 'manual' check (trigger in ('cron','manual')),
  status         text not null default 'running' check (status in ('running','success','error')),
  outcome        text,            -- 'published' | 'draft' | 'posted' | 'skipped' | 'failed' | 'sent'
  leads_count    int,
  article_id     text,            -- Storyblok story id (text, no FK)
  article_slug   text,
  article_title  text,
  editor_score   int,
  approved       boolean,
  revision_count int default 0,
  attempts       jsonb not null default '[]',  -- [{ attempt, score, approved, notes }]
  notes          text,
  draft          jsonb,           -- persisted DraftArticle for recovery
  started_at     timestamptz not null default now(),
  finished_at    timestamptz
);

create index if not exists pipeline_runs_kind_idx on public.pipeline_runs (kind, started_at desc);
alter table public.pipeline_runs enable row level security;
