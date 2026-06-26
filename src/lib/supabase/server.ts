// Supabase client for Server Components, Server Actions, and Route Handlers.
// Uses the publishable key + the request's auth cookies (via next/headers), so
// calls run as the logged-in user. Token refreshes are written back through
// setAll; in a Server Component context cookie writes throw, which we swallow
// because proxy.ts refreshes the session for every /admin request.
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { publicApiKey } from "@/lib/supabase/keys";

export async function getSupabaseServer() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const publishable = publicApiKey()!;

  return createServerClient(url, publishable, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component: cookies are read-only here.
          // proxy.ts handles the refresh write, so this is safe to ignore.
        }
      },
    },
  });
}

// Alias used by some ported modules.
export const authClient = getSupabaseServer;
