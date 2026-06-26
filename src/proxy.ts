// Next.js 16 Proxy (formerly middleware). Runs on /admin routes only:
//   1. Refreshes the Supabase session, writing rotated auth cookies back.
//   2. Redirects unauthenticated visitors to the login page.
//
// This is authentication only. Authorization (the email allowlist) is enforced
// in the admin layout via requireAdmin(), because the proxy must not be the
// sole gate (see Next.js 16 proxy docs: verify in the server component too).
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Paths under /admin reachable without a session.
const PUBLIC_ADMIN_PATHS = ["/admin/login"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { pathname } = request.nextUrl;
  if (PUBLIC_ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    return response;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without Supabase env there is no session to check. Let the request through
  // rather than 500; the admin pages themselves surface the misconfiguration.
  if (!url || !publishable) return response;

  const supabase = createServerClient(url, publishable, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        // No-cache headers so a CDN never serves one user's tokens to another.
        if (headers) {
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (pathname === "/admin") {
      const rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = "/admin/login";
      return NextResponse.rewrite(rewriteUrl);
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
