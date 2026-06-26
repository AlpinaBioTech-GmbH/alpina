// Server-only Supabase client using the SECRET key (bypasses RLS). NEVER import
// this into a client component - the secret key must never reach the browser.
// Returns null when env isn't configured, so callers can degrade gracefully.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { secretApiKey, supabaseUrl } from "@/lib/supabase/keys";

let cached: SupabaseClient | null = null;

/**
 * Elevated client for operational tables (contact_submissions, kb_*,
 * pipeline_runs, social_credentials, *_posts, ...). Returns null when env vars
 * are missing so builds and pages degrade gracefully instead of crashing.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached) return cached;
  const url = supabaseUrl();
  const key = secretApiKey();
  if (!url || !key) return null;
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

// Alias used by ported SAV modules.
export const serviceClient = getSupabaseAdmin;
