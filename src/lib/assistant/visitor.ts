// src/lib/assistant/visitor.ts
// Gathers details about a "Talk to AI" visitor (geo from Vercel edge headers,
// parsed user-agent, locale, client context) and records a per-visitor snapshot
// keyed by the first-party visitor cookie. IP is only ever stored hashed.
import { UAParser } from "ua-parser-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export const VISITOR_COOKIE = "assistant_vid";
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// Trim untrusted client/header strings to a sane length.
function s(v: unknown, max = 256): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function decode(v: string | null): string | null {
  if (!v) return v;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

export type ClientContext = {
  url?: string;
  path?: string;
  referrer?: string | null;
  screen?: string;
  viewport?: string;
  device_pixel_ratio?: number;
  timezone?: string;
  languages?: string | null;
  utm?: Record<string, string>;
};

export type VisitorSnapshot = Record<string, unknown>;

export type VisitorCapture = {
  snapshot: VisitorSnapshot;
  conversation: {
    country: string | null;
    city: string | null;
    page_path: string | null;
    context: Record<string, unknown>;
  };
};

/** Build the visitor snapshot + per-conversation context from a request. */
export function buildVisitor(
  headers: Headers,
  ctx: ClientContext,
  ipHash: string,
): VisitorCapture {
  const country = s(headers.get("x-vercel-ip-country"));
  const region = s(headers.get("x-vercel-ip-country-region"));
  const city = s(decode(headers.get("x-vercel-ip-city")));
  const latitude = s(headers.get("x-vercel-ip-latitude"));
  const longitude = s(headers.get("x-vercel-ip-longitude"));
  const geoTimezone = s(headers.get("x-vercel-ip-timezone"));
  const acceptLanguage = s(headers.get("accept-language"));
  const referer = s(headers.get("referer"));
  const uaString = headers.get("user-agent") ?? "";

  const ua = new UAParser(uaString).getResult();

  const dpr =
    typeof ctx.device_pixel_ratio === "number" ? ctx.device_pixel_ratio : null;
  const utm = ctx.utm && typeof ctx.utm === "object" ? ctx.utm : {};

  const snapshot: VisitorSnapshot = {
    ip_hash: ipHash,
    country,
    region,
    city,
    latitude,
    longitude,
    geo_timezone: geoTimezone,
    user_agent: s(uaString, 512),
    browser: s(ua.browser.name),
    browser_version: s(ua.browser.version),
    os: s(ua.os.name),
    os_version: s(ua.os.version),
    device_type: s(ua.device.type) ?? "desktop",
    device_vendor: s(ua.device.vendor),
    device_model: s(ua.device.model),
    languages: s(ctx.languages, 256),
    accept_language: acceptLanguage,
    client_timezone: s(ctx.timezone),
    screen: s(ctx.screen, 32),
    viewport: s(ctx.viewport, 32),
    device_pixel_ratio: dpr,
    landing_page: s(ctx.path, 512),
    referrer: s(ctx.referrer ?? referer, 512),
    utm,
  };

  return {
    snapshot,
    conversation: {
      country,
      city,
      page_path: s(ctx.path, 512),
      context: {
        url: s(ctx.url, 512),
        referrer: s(ctx.referrer ?? referer, 512),
        screen: s(ctx.screen, 32),
        viewport: s(ctx.viewport, 32),
        device_pixel_ratio: dpr,
        timezone: s(ctx.timezone),
        languages: s(ctx.languages, 256),
        browser: s(ua.browser.name),
        os: s(ua.os.name),
        device_type: s(ua.device.type) ?? "desktop",
        utm,
      },
    },
  };
}

/**
 * Upsert the visitor by hand so first_seen is preserved and conversation_count
 * increments. Best-effort: low concurrency per visitor (the widget blocks while
 * a request is in flight).
 */
export async function recordVisitor(
  db: SupabaseClient,
  visitorId: string,
  snapshot: VisitorSnapshot,
): Promise<void> {
  const now = new Date().toISOString();
  const { data: existing } = await db
    .from("assistant_visitors")
    .select("conversation_count")
    .eq("visitor_id", visitorId)
    .maybeSingle();

  if (existing) {
    await db
      .from("assistant_visitors")
      .update({
        ...snapshot,
        last_seen: now,
        conversation_count:
          ((existing as { conversation_count: number }).conversation_count ?? 0) + 1,
      })
      .eq("visitor_id", visitorId);
  } else {
    await db.from("assistant_visitors").insert({
      visitor_id: visitorId,
      first_seen: now,
      last_seen: now,
      conversation_count: 1,
      ...snapshot,
    });
  }
}
