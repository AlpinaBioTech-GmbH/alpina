// Instagram API with Instagram Login (Business account, no Facebook Page).
// Content Publishing: child containers -> carousel container -> poll FINISHED
// -> publish. Long-lived 60-day tokens, refreshed programmatically when close
// to expiry. JPEG-only image ingestion happens via our signed slide route.
import { createHmac } from "node:crypto";
import { serviceClient } from "@/lib/supabase/service";
import { siteUrl } from "@/lib/site";

const GRAPH = "https://graph.instagram.com/v23.0";
const GRAPH_BARE = "https://graph.instagram.com";

export const INSTAGRAM_SCOPES = "instagram_business_basic,instagram_business_content_publish";

export interface InstagramConnection {
  accessToken: string;
  userId: string; // IG user id (stored in author_urn)
  autoEnabled: boolean;
  expiresAt: string | null;
  expired: boolean;
  displayName: string | null;
}

export function authUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID ?? "",
    redirect_uri: process.env.INSTAGRAM_REDIRECT_URI ?? "",
    response_type: "code",
    scope: INSTAGRAM_SCOPES,
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${params}`;
}

export async function exchangeCode(
  code: string,
): Promise<{ accessToken: string; userId: string; expiresAt: string }> {
  // Short-lived token first…
  const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID ?? "",
      client_secret: process.env.INSTAGRAM_APP_SECRET ?? "",
      grant_type: "authorization_code",
      redirect_uri: process.env.INSTAGRAM_REDIRECT_URI ?? "",
      code,
    }),
  });
  if (!shortRes.ok) throw new Error(`IG code exchange failed (${shortRes.status}): ${await shortRes.text()}`);
  const short = await shortRes.json();

  // …then exchange for the long-lived (60-day) token.
  const longRes = await fetch(
    `${GRAPH_BARE}/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_APP_SECRET}&access_token=${short.access_token}`,
  );
  if (!longRes.ok) throw new Error(`IG long-lived exchange failed (${longRes.status}): ${await longRes.text()}`);
  const long = await longRes.json();

  return {
    accessToken: long.access_token,
    userId: String(short.user_id),
    expiresAt: new Date(Date.now() + (long.expires_in ?? 5_184_000) * 1000).toISOString(),
  };
}

export async function fetchMe(accessToken: string): Promise<{ username: string }> {
  const res = await fetch(`${GRAPH}/me?fields=username&access_token=${accessToken}`);
  if (!res.ok) throw new Error(`IG /me failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function saveCredentials(fields: {
  accessToken: string;
  expiresAt: string | null;
  userId: string;
  displayName: string | null;
}): Promise<void> {
  const db = serviceClient();
  if (!db) throw new Error("Supabase not configured");
  const { error } = await db.from("social_credentials").upsert(
    {
      provider: "instagram",
      access_token: fields.accessToken,
      refresh_token: null, // IG long-lived tokens refresh in place
      expires_at: fields.expiresAt,
      author_urn: fields.userId,
      scope: INSTAGRAM_SCOPES,
      display_name: fields.displayName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider" },
  );
  if (error) throw new Error(`saving Instagram credentials failed: ${error.message}`);
}

export async function getConnection(): Promise<InstagramConnection | null> {
  const db = serviceClient();
  if (!db) return null;
  const { data: row } = await db
    .from("social_credentials")
    .select("*")
    .eq("provider", "instagram")
    .maybeSingle();
  if (!row) return null;

  let accessToken = row.access_token as string;
  let expiresAt = row.expires_at as string | null;

  // Refresh when < 7 days remain (token must be older than 24h; if connect
  // was very recent the expiry is far away anyway, so this holds).
  const daysLeft = expiresAt ? (new Date(expiresAt).getTime() - Date.now()) / 86_400_000 : null;
  if (daysLeft != null && daysLeft < 7 && daysLeft > -1) {
    try {
      const res = await fetch(
        `${GRAPH_BARE}/refresh_access_token?grant_type=ig_refresh_token&access_token=${accessToken}`,
      );
      if (res.ok) {
        const refreshed = await res.json();
        accessToken = refreshed.access_token;
        expiresAt = new Date(Date.now() + (refreshed.expires_in ?? 5_184_000) * 1000).toISOString();
        await db
          .from("social_credentials")
          .update({ access_token: accessToken, expires_at: expiresAt, updated_at: new Date().toISOString() })
          .eq("provider", "instagram");
      } else {
        console.warn("[instagram] token refresh failed:", await res.text());
      }
    } catch (err) {
      console.warn("[instagram] token refresh threw:", err);
    }
  }

  return {
    accessToken,
    userId: row.author_urn,
    autoEnabled: row.auto_enabled,
    expiresAt,
    expired: Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now()),
    displayName: row.display_name,
  };
}

// ── Signed slide URLs ────────────────────────────────────────────────────────

function signingSecret(): string {
  const explicit = process.env.IG_SLIDE_SIGNING_SECRET ?? process.env.CRON_SECRET;
  if (explicit) return explicit;
  // No secret configured. A "dev-secret" signature is only safe against a local
  // dev host — against a real site it is guaranteed to 401 against the deployed
  // route, which validates with the real secret. This is exactly the silent
  // failure that breaks Instagram when the signing environment lacks the
  // secret, so fail loudly with an actionable message.
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/.test(siteUrl())) {
    return "dev-secret";
  }
  throw new Error(
    `IG_SLIDE_SIGNING_SECRET (or CRON_SECRET) is not set, but slide URLs target ${siteUrl()}. ` +
      "The signer must use the SAME secret as the deployed /api/ig/slide route, or every slide " +
      "fetch returns 401. Set IG_SLIDE_SIGNING_SECRET in this environment to match production.",
  );
}

export function slideSignature(postId: string, index: number): string {
  return createHmac("sha256", signingSecret()).update(`${postId}:${index}`).digest("hex").slice(0, 32);
}

export function slideUrl(postId: string, index: number): string {
  return `${siteUrl()}/api/ig/slide?post=${postId}&i=${index}&sig=${slideSignature(postId, index)}`;
}

// ── Publishing ───────────────────────────────────────────────────────────────

async function graphPost(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(`${GRAPH}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`IG ${path} failed (${res.status}): ${JSON.stringify(data).slice(0, 400)}`);
  }
  return data;
}

async function waitForContainer(containerId: string, accessToken: string): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${GRAPH}/${containerId}?fields=status_code&access_token=${accessToken}`);
    const data = await res.json().catch(() => ({}));
    const status = data.status_code as string | undefined;
    if (status === "FINISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`IG container ${containerId} status ${status}`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`IG container ${containerId} not FINISHED after 60s`);
}

export async function publishCarousel(opts: {
  accessToken: string;
  igUserId: string;
  imageUrls: string[];
  caption: string;
}): Promise<{ mediaId: string; permalink: string | null }> {
  const { accessToken, igUserId, imageUrls, caption } = opts;
  if (imageUrls.length === 0) throw new Error("no slides to publish");

  let containerId: string;
  if (imageUrls.length === 1) {
    const single = await graphPost(`/${igUserId}/media`, {
      image_url: imageUrls[0],
      caption,
      access_token: accessToken,
    });
    containerId = String(single.id);
  } else {
    const children: string[] = [];
    for (const url of imageUrls.slice(0, 10)) {
      const child = await graphPost(`/${igUserId}/media`, {
        image_url: url,
        is_carousel_item: "true",
        access_token: accessToken,
      });
      children.push(String(child.id));
    }
    const carousel = await graphPost(`/${igUserId}/media`, {
      media_type: "CAROUSEL",
      children: children.join(","),
      caption,
      access_token: accessToken,
    });
    containerId = String(carousel.id);
  }

  await waitForContainer(containerId, accessToken);
  const published = await graphPost(`/${igUserId}/media_publish`, {
    creation_id: containerId,
    access_token: accessToken,
  });
  const mediaId = String(published.id);

  let permalink: string | null = null;
  try {
    const res = await fetch(`${GRAPH}/${mediaId}?fields=permalink&access_token=${accessToken}`);
    if (res.ok) permalink = (await res.json()).permalink ?? null;
  } catch {
    // permalink is cosmetic
  }
  return { mediaId, permalink };
}
