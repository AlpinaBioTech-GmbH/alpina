-- Newsletter: subscriber lifecycle + monthly issues.
-- RLS ON, no policies (service-role only), same as the rest of the schema.
-- Subscribers gain an unsubscribe lifecycle (synced back from Resend via the
-- /api/webhooks/resend contact.* events) and the Resend contact mirror id.
-- newsletter_issues holds one row per covered month: the machine-generated
-- digest (AI intro + article refs), the exact sent HTML, and the Resend
-- broadcast id the KPI events join on. period is UNIQUE so a double send of
-- the same month is impossible even under concurrent cron invocations.

alter table public.newsletter_subscribers
  add column if not exists status            text not null default 'subscribed',
  add column if not exists unsubscribed_at   timestamptz,
  add column if not exists resend_contact_id text,
  add column if not exists updated_at        timestamptz not null default now();

do $$ begin
  alter table public.newsletter_subscribers
    add constraint newsletter_subscribers_status_check
    check (status in ('subscribed', 'unsubscribed'));
exception when duplicate_object then null; end $$;

create index if not exists newsletter_subscribers_status_idx
  on public.newsletter_subscribers (status);

create table if not exists public.newsletter_issues (
  id                     uuid primary key default gen_random_uuid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  period                 date not null unique,   -- first day of the covered month
  slug                   text not null unique,   -- 'YYYY-MM', the public archive slug
  status                 text not null default 'sending'
    check (status in ('sending', 'sent', 'failed', 'skipped')),
  title                  text not null,          -- e.g. 'AlpinaBioTech Digest - July 2026'
  subject                text,
  preview_text           text,
  content                jsonb,                  -- { intro_paragraphs, closing_line, articles: [...] }
  email_html             text,                   -- exact broadcast HTML snapshot
  model                  text,                   -- composer model id
  article_count          int,
  sent_at                timestamptz,
  resend_broadcast_id    text,
  audience_size_at_send  int,
  last_error             text,
  notes                  text
);

create index if not exists newsletter_issues_status_idx
  on public.newsletter_issues (status);

alter table public.newsletter_issues enable row level security;
