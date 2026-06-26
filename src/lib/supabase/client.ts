// Supabase browser client (for "use client" components). Cookie handling is
// automatic. Used by the login page to send the magic link.
"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicApiKey } from "@/lib/supabase/keys";

export function getSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    publicApiKey()!,
  );
}

// Alias used by some ported modules.
export const browserClient = getSupabaseBrowser;
