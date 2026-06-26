-- Admin allowlist for the /admin area (magic-link auth). Authorization checks
-- this table server-side; the ADMIN_EMAILS env var is an additional bootstrap
-- allowlist so a fresh deploy is not locked out before this table is seeded.
--
-- No admin is seeded by default. After running migrations, add the owner:
--   insert into public.admin_users (email, role, name)
--   values ('you@example.com', 'owner', 'Your Name');
-- (or just set ADMIN_EMAILS=you@example.com to bootstrap, then add via /admin/admins)

create table if not exists public.admin_users (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  email       text not null unique,
  role        text not null default 'admin',   -- 'admin' | 'owner'
  name        text
);

alter table public.admin_users enable row level security;
