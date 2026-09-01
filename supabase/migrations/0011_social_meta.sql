-- Free-form per-provider metadata on social connections. First use: caching
-- the LinkedIn administered-orgs list (page names), because the
-- /rest/organizations name lookup has a small APPLICATION DAY quota and the
-- admin page-selector was burning it on every load (falling back to
-- "Organization <id>" labels once throttled).

alter table public.social_credentials
  add column if not exists meta jsonb;
