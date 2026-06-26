// API key resolution. Supabase's new key system (2025+) replaces the legacy
// JWT keys: sb_publishable_... supersedes the anon key, sb_secret_...
// supersedes service_role (legacy keys deprecated end of 2026). Both are
// drop-in replacements in supabase-js/@supabase/ssr. We prefer the new names
// and fall back to the legacy ones so either works.
//
// NEXT_PUBLIC_ references are kept as literal expressions so the bundler can
// inline them in client code.

/** Client-safe key: publishable (preferred) or legacy anon. */
export function publicApiKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/** Server-only elevated key: secret (preferred) or legacy service_role. */
export function secretApiKey(): string | undefined {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/** Project URL (public). */
export function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
}
