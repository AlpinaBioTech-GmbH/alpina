-- Per-recipient email events from the Resend webhook, deduplicated so counts
-- are unique-per-recipient (one open per person, one click per person+link;
-- link_url is '' for non-click events so the unique constraint stays plain
-- columns, which PostgREST upserts can target). Powers /admin/newsletter.
-- Clicks on Resend's hosted unsubscribe link measure people leaving, not
-- engaging, so every click aggregate excludes them (raw events stay stored).

create table if not exists public.newsletter_email_events (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  broadcast_id text not null,
  event_type   text not null
    check (event_type in ('delivered','delivery_delayed','opened','clicked','bounced','complained','failed')),
  recipient    text not null,
  link_url     text not null default '',
  occurred_at  timestamptz,
  constraint newsletter_email_events_dedup_key
    unique (broadcast_id, event_type, recipient, link_url)
);

create index if not exists newsletter_email_events_broadcast_idx
  on public.newsletter_email_events (broadcast_id);
create index if not exists newsletter_email_events_recipient_idx
  on public.newsletter_email_events (recipient);

alter table public.newsletter_email_events enable row level security;

-- Aggregations for the admin performance pages (called with the service key).
-- count(distinct recipient): non-click events are already unique per person,
-- and clicked has one row per person+link, so distinct avoids overcounting
-- people who clicked several links.
create or replace function public.newsletter_broadcast_stats(ids text[])
returns table (broadcast_id text, event_type text, n bigint)
language sql stable
as $$
  select broadcast_id, event_type, count(distinct recipient)
  from public.newsletter_email_events
  where broadcast_id = any(ids)
    and not (event_type = 'clicked' and link_url ilike '%unsubscribe.resend.com%')
  group by 1, 2;
$$;

create or replace function public.newsletter_link_stats(bid text)
returns table (link_url text, clicks bigint)
language sql stable
as $$
  select link_url, count(*)
  from public.newsletter_email_events
  where broadcast_id = bid and event_type = 'clicked' and link_url <> ''
    and link_url not ilike '%unsubscribe.resend.com%'
  group by 1
  order by 2 desc;
$$;

-- Hourly first-activity series per issue. Dedup keeps only the first event
-- per person(+link), and we take min(occurred_at) per recipient + type so the
-- cumulative sum is exact unique people (clickers of 2 links count once).
create or replace function public.newsletter_event_series(ids text[])
returns table (bucket_start timestamptz, event_type text, n bigint)
language sql stable
as $$
  select date_trunc('hour', t.first_at) as bucket_start, t.event_type, count(*) as n
  from (
    select recipient, event_type,
           min(coalesce(occurred_at, created_at)) as first_at
    from public.newsletter_email_events
    where broadcast_id = any(ids) and event_type in ('opened', 'clicked')
      and not (event_type = 'clicked' and link_url ilike '%unsubscribe.resend.com%')
    group by recipient, event_type
  ) t
  group by 1, 2
  order by 1;
$$;

-- Signups vs unsubscribes per bucket ('week' or 'month') for the growth chart.
create or replace function public.newsletter_subscriber_growth(bucket text)
returns table (bucket_start timestamptz, signups bigint, unsubscribes bigint)
language sql stable
as $$
  with s as (
    select date_trunc(bucket, created_at) as b, count(*) as n
    from public.newsletter_subscribers group by 1
  ), u as (
    select date_trunc(bucket, unsubscribed_at) as b, count(*) as n
    from public.newsletter_subscribers
    where unsubscribed_at is not null group by 1
  )
  select coalesce(s.b, u.b) as bucket_start,
         coalesce(s.n, 0) as signups,
         coalesce(u.n, 0) as unsubscribes
  from s full outer join u on s.b = u.b
  order by 1;
$$;
