-- Assistant conversation logging + visitor analytics.
--
-- Privacy note: this stores personal data (geo, device, hashed IP) and sets a
-- persistent first-party cookie, so disclose it in your privacy/cookie notice
-- and set a retention policy that suits your obligations. IP is stored hashed.

-- One row per assistant answer, with analytics + soft-delete (archive).
create table if not exists public.assistant_conversations (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  ip_hash        text,                 -- hashed, not the raw IP
  question       text not null,
  answer         text not null,
  sources        jsonb not null default '[]'::jsonb,  -- [{title, url}]
  model          text,
  input_tokens   integer,
  output_tokens  integer,
  summary        text,                 -- one-line summary
  intent         text,                 -- short label, e.g. "Pricing"
  worth_followup boolean not null default false,
  archived       boolean not null default false,
  archived_at    timestamptz,
  -- visitor correlation + per-message context
  visitor_id     text,
  country        text,
  city           text,
  page_path      text,
  context        jsonb not null default '{}'::jsonb
);

create index if not exists assistant_conversations_created_at_idx
  on public.assistant_conversations (created_at desc);
create index if not exists assistant_conversations_archived_idx
  on public.assistant_conversations (archived, created_at desc);
create index if not exists assistant_conversations_visitor_idx
  on public.assistant_conversations (visitor_id);

-- Per-visitor snapshot + aggregates (keyed by the first-party visitor cookie).
create table if not exists public.assistant_visitors (
  visitor_id         text primary key,
  first_seen         timestamptz not null default now(),
  last_seen          timestamptz not null default now(),
  ip_hash            text,
  -- Geo (from Vercel edge headers)
  country            text,
  region             text,
  city               text,
  latitude           text,
  longitude          text,
  geo_timezone       text,
  -- Device / browser (parsed user-agent)
  user_agent         text,
  browser            text,
  browser_version    text,
  os                 text,
  os_version         text,
  device_type        text,
  device_vendor      text,
  device_model       text,
  -- Locale / context
  languages          text,
  accept_language    text,
  client_timezone    text,
  screen             text,
  viewport           text,
  device_pixel_ratio numeric,
  landing_page       text,
  referrer           text,
  utm                jsonb not null default '{}'::jsonb,
  conversation_count integer not null default 0
);

create index if not exists assistant_visitors_last_seen_idx
  on public.assistant_visitors (last_seen desc);

alter table public.assistant_conversations enable row level security;
alter table public.assistant_visitors      enable row level security;
