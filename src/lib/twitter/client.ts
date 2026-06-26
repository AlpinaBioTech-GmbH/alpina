// X (Twitter) API v2 client, OAuth 2.0 + PKCE. Access tokens live ~2 hours
// and X rotates the refresh token on every refresh, so getConnection()
// refreshes on every call and persists the new refresh token BEFORE the
// access token is used. A failed refresh returns null ("reconnect required").
import { createHash, randomBytes } from "node:crypto";
import { serviceClient } from "@/lib/supabase/service";
import { siteUrl } from "@/lib/site";

const AUTH_BASE = "https://x.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.x.com/2/oauth2/token";
const API_BASE = "https://api.x.com/2";

export const TWITTER_SCOPES = "tweet.read tweet.write users.read offline.access";

export type TwitterProvider = "twitter" | "twitter_member";

export interface TwitterAccount {
  provider: TwitterProvider;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

// The company account uses the primary X app env. The personal ("member")
// account reuses the SAME app by default (X allows multiple authorized users and
// multiple callback URLs per app); the TWITTER_MEMBER_* vars only need setting if
// a separate app is used. The member redirect URI defaults to its callback route.
export function twitterAccount(kind: "primary" | "member" = "primary"): TwitterAccount {
  if (kind === "member") {
    return {
      provider: "twitter_member",
      clientId: process.env.TWITTER_MEMBER_CLIENT_ID ?? process.env.TWITTER_CLIENT_ID ?? "",
      clientSecret: process.env.TWITTER_MEMBER_CLIENT_SECRET ?? process.env.TWITTER_CLIENT_SECRET ?? "",
      redirectUri: process.env.TWITTER_MEMBER_REDIRECT_URI ?? `${siteUrl()}/api/auth/twitter-member/callback`,
    };
  }
  return {
    provider: "twitter",
    clientId: process.env.TWITTER_CLIENT_ID ?? "",
    clientSecret: process.env.TWITTER_CLIENT_SECRET ?? "",
    redirectUri: process.env.TWITTER_REDIRECT_URI ?? "",
  };
}

export interface TwitterConnection {
  accessToken: string;
  userId: string;
  autoEnabled: boolean;
  displayName: string | null;
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function authUrl(
  state: string,
  challenge: string,
  account: TwitterAccount = twitterAccount(),
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: account.clientId,
    redirect_uri: account.redirectUri,
    scope: TWITTER_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${AUTH_BASE}?${params}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

function basicAuthHeader(account: TwitterAccount): string {
  return `Basic ${Buffer.from(`${account.clientId}:${account.clientSecret}`).toString("base64")}`;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Classifies token-endpoint failures so the refresh flow can react correctly:
 * - "terminal": the refresh token is dead (invalid_grant/invalid_request) — a
 *   genuine reconnect is required.
 * - "transient": network error, timeout, 408/429/5xx, or any unrecognised code
 *   — safe to retry; never raise a false "reconnect" alarm.
 */
export class XTokenError extends Error {
  constructor(
    public kind: "terminal" | "transient",
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "XTokenError";
  }
}

async function tokenRequest(body: URLSearchParams, account: TwitterAccount): Promise<TokenResponse> {
  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: basicAuthHeader(account),
      },
      body,
    });
  } catch (err) {
    // Never reached X (DNS/timeout/connection): the stored refresh token is
    // untouched, so retrying is safe.
    throw new XTokenError(
      "transient",
      0,
      `X token request network error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (res.ok) return res.json();
  const text = await res.text();
  let code = "";
  try {
    code = String(JSON.parse(text)?.error ?? "");
  } catch {
    // non-JSON error body — leave code empty (treated as transient below)
  }
  const terminal = code === "invalid_grant" || code === "invalid_request";
  throw new XTokenError(
    terminal ? "terminal" : "transient",
    res.status,
    `X token request failed (${res.status}, ${code || "unknown"}): ${text}`,
  );
}

export async function exchangeCode(
  code: string,
  verifier: string,
  account: TwitterAccount = twitterAccount(),
): Promise<TokenResponse> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: account.redirectUri,
      client_id: account.clientId,
      code_verifier: verifier,
    }),
    account,
  );
}

export async function fetchMe(accessToken: string): Promise<{ id: string; name: string; username: string }> {
  const res = await fetch(`${API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`X users/me failed (${res.status}): ${await res.text()}`);
  return (await res.json()).data;
}

export async function saveCredentials(
  fields: {
    accessToken: string;
    refreshToken?: string;
    expiresAt: string | null;
    userId: string;
    scope?: string;
    displayName: string | null;
  },
  provider: TwitterProvider = "twitter",
): Promise<void> {
  const db = serviceClient();
  if (!db) throw new Error("Supabase not configured");
  const { error } = await db.from("social_credentials").upsert(
    {
      provider,
      access_token: fields.accessToken,
      refresh_token: fields.refreshToken ?? null,
      expires_at: fields.expiresAt,
      author_urn: fields.userId,
      scope: fields.scope ?? null,
      display_name: fields.displayName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider" },
  );
  if (error) throw new Error(`saving X credentials failed: ${error.message}`);
}

export type XFailureKind = "terminal" | "transient" | "persist-critical";

// getConnection() keeps its `| null` signature so callers stay simple; when it
// returns null it records WHY here, which the pipeline consumes to emit an
// accurate skip reason (and decide whether to alert). Cleared on success.
let lastConnectionFailure: { kind: XFailureKind; detail: string } | null = null;

export function consumeXFailure(): { kind: XFailureKind; detail: string } | null {
  const failure = lastConnectionFailure;
  lastConnectionFailure = null;
  return failure;
}

/**
 * Always refreshes (tokens live ~2h). Transient refresh errors are retried; the
 * rotated (single-use) refresh token is persisted with retries before the new
 * access token is returned. Returns null on any failure and records the cause
 * via consumeXFailure(): a dead token ("terminal") and a lost-rotated-token
 * ("persist-critical") need a reconnect; "transient" just skips this run.
 */
export async function getConnection(
  account: TwitterAccount = twitterAccount(),
): Promise<TwitterConnection | null> {
  lastConnectionFailure = null;
  const db = serviceClient();
  if (!db) return null;
  const { data: row } = await db
    .from("social_credentials")
    .select("*")
    .eq("provider", account.provider)
    .maybeSingle();
  if (!row || !row.refresh_token) return null; // never connected → caller says so

  // Refresh with bounded backoff. X rotates the refresh token only on a
  // SUCCESSFUL refresh, so re-sending the same token after a transient failure
  // is safe.
  let refreshed: TokenResponse | null = null;
  const backoffs = [400, 1200];
  for (let attempt = 0; ; attempt++) {
    try {
      refreshed = await tokenRequest(
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: row.refresh_token,
          client_id: account.clientId,
        }),
        account,
      );
      break;
    } catch (err) {
      const kind = err instanceof XTokenError ? err.kind : "transient";
      const detail = err instanceof Error ? err.message : String(err);
      if (kind === "transient" && attempt < backoffs.length) {
        await sleep(backoffs[attempt]);
        continue;
      }
      console.warn(`[twitter] refresh failed (${kind}) after ${attempt + 1} attempt(s):`, detail);
      lastConnectionFailure = { kind, detail };
      return null;
    }
  }
  if (!refreshed) return null; // unreachable (loop only exits via break/return)

  // Persist the rotated token before using the access token. If this write
  // fails, the token X just issued is lost and the stored one is now spent —
  // the connection is bricked, so surface it as critical (reconnect required).
  const update = {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token ?? row.refresh_token,
    expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  let persisted = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await db.from("social_credentials").update(update).eq("provider", account.provider);
    if (!error) {
      persisted = true;
      break;
    }
    console.warn(`[twitter] persisting rotated token failed (attempt ${attempt + 1}):`, error.message);
    if (attempt < 2) await sleep(300 * (attempt + 1));
  }
  if (!persisted) {
    console.error(
      "[twitter] CRITICAL: rotated refresh token could not be persisted; connection likely bricked, reconnect required",
    );
    lastConnectionFailure = { kind: "persist-critical", detail: "rotated X refresh token could not be saved" };
    return null;
  }

  return {
    accessToken: refreshed.access_token,
    userId: row.author_urn,
    autoEnabled: row.auto_enabled,
    displayName: row.display_name,
  };
}

export async function createTweet(
  accessToken: string,
  text: string,
): Promise<{ id: string; url: string }> {
  const res = await fetch(`${API_BASE}/tweets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`X tweet failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()).data;
  return { id: data.id, url: `https://x.com/i/web/status/${data.id}` };
}
