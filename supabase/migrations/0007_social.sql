-- Social connections + per-post audit rows. Service-role only (RLS ON, no
-- public policies). One row per platform connection; exactly one *_posts row
-- per run (posted winner, or one skipped/failed row).
--
-- Provider model: company accounts ('linkedin','twitter','instagram') plus
-- optional personal cross-post accounts ('linkedin_member','twitter_member').

create table if not exists public.social_credentials (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null unique check (provider in
                  ('linkedin','twitter','instagram','linkedin_member','twitter_member')),
  access_token  text not null,
  refresh_token text,
  expires_at    timestamptz,
  author_urn    text not null,     -- LinkedIn org/person URN / X user id / IG user id
  scope         text,
  display_name  text,
  auto_enabled  boolean not null default true,   -- per-platform master switch
  connected_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.social_credentials enable row level security;

create table if not exists public.linkedin_posts (
  id              uuid primary key default gen_random_uuid(),
  content_type    text not null check (content_type in ('article','offering','feature','project','newsletter')),
  content_id      text not null,
  content_slug    text,
  url             text not null,
  image_url       text,
  pillar          text,
  commentary      text not null,
  hashtags        text[] not null default '{}',
  status          text not null default 'queued' check (status in ('queued','posted','failed','skipped')),
  validator_notes text,
  linkedin_urn    text,
  linkedin_url    text,
  error           text,
  posted_at       timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists linkedin_posts_created_idx on public.linkedin_posts (created_at desc);
alter table public.linkedin_posts enable row level security;

create table if not exists public.twitter_posts (
  id              uuid primary key default gen_random_uuid(),
  content_type    text not null check (content_type in ('article','offering','feature','project','newsletter')),
  content_id      text not null,
  content_slug    text,
  url             text not null,
  image_url       text,
  pillar          text,
  text            text not null,
  hashtags        text[] not null default '{}',
  status          text not null default 'queued' check (status in ('queued','posted','failed','skipped')),
  validator_notes text,
  tweet_id        text,
  tweet_url       text,
  error           text,
  posted_at       timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists twitter_posts_created_idx on public.twitter_posts (created_at desc);
alter table public.twitter_posts enable row level security;

create table if not exists public.instagram_posts (
  id              uuid primary key default gen_random_uuid(),
  content_type    text not null check (content_type in ('article','offering','feature','project','newsletter')),
  content_id      text not null,
  content_slug    text,
  url             text not null,            -- grounding item URL (link-in-bio target; never in the caption)
  pillar          text,
  caption         text not null,
  hashtags        text[] not null default '{}',
  slides          jsonb not null default '[]',  -- [{ kicker?, title, body? }], last = slogan/CTA slide
  status          text not null default 'queued' check (status in ('queued','posted','failed','skipped')),
  validator_notes text,
  ig_media_id     text,
  permalink       text,
  error           text,
  posted_at       timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists instagram_posts_created_idx on public.instagram_posts (created_at desc);
alter table public.instagram_posts enable row level security;
