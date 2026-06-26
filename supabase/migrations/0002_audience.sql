-- Audience capture: contact-form submissions + newsletter signups.
-- RLS ON, no anon policies. All writes happen server-side via the service role
-- inside Server Actions / route handlers. Editorial content lives in Storyblok.

create table if not exists public.contact_submissions (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  name         text not null,
  company      text,
  email        text not null,
  role         text,
  interest     text,                  -- validated app-side with Zod
  message      text not null,
  source_page  text,                  -- which page the form was on
  user_agent   text
);

create table if not exists public.newsletter_subscribers (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  email       text not null unique,
  source_page text
);

alter table public.contact_submissions    enable row level security;
alter table public.newsletter_subscribers enable row level security;
