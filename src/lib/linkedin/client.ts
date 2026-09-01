// LinkedIn REST API client. Posts as the organization page via the Community
// Management API product. That product must be the ONLY product on the
// developer app — it cannot coexist with "Sign In with LinkedIn using OpenID
// Connect" or "Share on LinkedIn", so the member scopes (openid / profile /
// w_member_social) are unavailable here and there is no personal-URN fallback:
// the connecting member must administer the company page.
import { serviceClient } from "@/lib/supabase/service";
import { brand } from "@/lib/config";

const OAUTH_BASE = "https://www.linkedin.com/oauth/v2";
const API_BASE = "https://api.linkedin.com";

export type LinkedinAccountKind = "organization" | "member";

// A LinkedIn connection is tied to a developer app. The org page uses the
// Community Management API app (sole-product); personal-profile posting needs a
// SEPARATE app with Sign In with OpenID Connect + Share on LinkedIn, since those
// products cannot coexist with Community Management on the same app.
export interface LinkedinAccount {
  provider: "linkedin" | "linkedin_member";
  kind: LinkedinAccountKind;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
  label: string;
}

function orgAccount(): LinkedinAccount {
  return {
    provider: "linkedin",
    kind: "organization",
    clientId: process.env.LINKEDIN_CLIENT_ID ?? "",
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
    redirectUri: process.env.LINKEDIN_REDIRECT_URI ?? "",
    scopes:
      process.env.LINKEDIN_SCOPES ??
      "rw_organization_admin w_organization_social r_organization_social",
    label: "LinkedIn page",
  };
}

function memberAccount(): LinkedinAccount {
  return {
    provider: "linkedin_member",
    kind: "member",
    clientId: process.env.LINKEDIN_MEMBER_CLIENT_ID ?? "",
    clientSecret: process.env.LINKEDIN_MEMBER_CLIENT_SECRET ?? "",
    redirectUri: process.env.LINKEDIN_MEMBER_REDIRECT_URI ?? "",
    scopes: process.env.LINKEDIN_MEMBER_SCOPES ?? "openid profile w_member_social",
    label: "LinkedIn profile",
  };
}

export function linkedinAccount(kind: LinkedinAccountKind = "organization"): LinkedinAccount {
  return kind === "member" ? memberAccount() : orgAccount();
}

function apiVersion(): string {
  // LinkedIn sunsets API versions ~12 months after release (426
  // NONEXISTENT_VERSION); bump this default when that happens.
  return process.env.LINKEDIN_VERSION ?? "202606";
}

function restHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "LinkedIn-Version": apiVersion(),
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };
}

export interface LinkedinConnection {
  accessToken: string;
  authorUrn: string;
  autoEnabled: boolean;
  expiresAt: string | null;
  expired: boolean;
  displayName: string | null;
}

export async function getConnection(
  account: LinkedinAccount = orgAccount(),
): Promise<LinkedinConnection | null> {
  const db = serviceClient();
  if (!db) return null;
  const { data: row } = await db
    .from("social_credentials")
    .select("*")
    .eq("provider", account.provider)
    .maybeSingle();
  if (!row) return null;

  let accessToken = row.access_token as string;
  let expiresAt = row.expires_at as string | null;

  // Refresh when the token expires in < 1 hour and a refresh token exists.
  const expiringSoon = expiresAt && new Date(expiresAt).getTime() - Date.now() < 3600_000;
  if (expiringSoon && row.refresh_token) {
    try {
      const refreshed = await refreshToken(row.refresh_token, account);
      accessToken = refreshed.access_token;
      expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await db
        .from("social_credentials")
        .update({
          access_token: accessToken,
          refresh_token: refreshed.refresh_token ?? row.refresh_token,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("provider", account.provider);
    } catch (err) {
      console.warn("[linkedin] token refresh failed:", err);
    }
  }

  return {
    accessToken,
    authorUrn: row.author_urn,
    autoEnabled: row.auto_enabled,
    expiresAt,
    expired: Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now()),
    displayName: row.display_name,
  };
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
}

async function refreshToken(
  refresh: string,
  account: LinkedinAccount = orgAccount(),
): Promise<TokenResponse> {
  const res = await fetch(`${OAUTH_BASE}/accessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refresh,
      client_id: account.clientId,
      client_secret: account.clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`LinkedIn refresh failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export function authUrl(state: string, account: LinkedinAccount = orgAccount()): string {
  // Org scopes: rw_organization_admin is what the Community Management API grants
  // (the read-only r_organization_admin is not separately authorizable) and
  // organizationAcls needs the rw_ form. Member scopes: openid profile w_member_social.
  const params = new URLSearchParams({
    response_type: "code",
    client_id: account.clientId,
    redirect_uri: account.redirectUri,
    scope: account.scopes,
    state,
  });
  return `${OAUTH_BASE}/authorization?${params}`;
}

export async function exchangeCode(
  code: string,
  account: LinkedinAccount = orgAccount(),
): Promise<TokenResponse> {
  const res = await fetch(`${OAUTH_BASE}/accessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: account.clientId,
      client_secret: account.clientSecret,
      redirect_uri: account.redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`LinkedIn token exchange failed (${res.status}): ${await res.text()}`);
  return res.json();
}

/**
 * Resolve the posting author for a connection.
 *  - "member": the connected person's own URN, via OpenID `/v2/userinfo`.
 *  - "organization": the first APPROVED ADMINISTRATOR org the member can post
 *    for. With Community Management API (org scopes, no `openid`) there is no
 *    personal-URN fallback — the member must administer a page.
 */
export async function discoverAuthor(
  accessToken: string,
  kind: LinkedinAccountKind = "organization",
): Promise<{ authorUrn: string; displayName: string | null }> {
  if (kind === "member") {
    const res = await fetch(`${API_BASE}/v2/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`LinkedIn userinfo failed (${res.status}): ${await res.text()}`);
    }
    const me = await res.json();
    return { authorUrn: `urn:li:person:${me.sub}`, displayName: me.name ?? null };
  }
  const res = await fetch(
    `${API_BASE}/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED`,
    { headers: restHeaders(accessToken) },
  );
  if (!res.ok) {
    throw new Error(`LinkedIn organizationAcls failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  const orgUrn: string | undefined = data.elements?.[0]?.organization;
  if (!orgUrn) {
    throw new Error(
      `No administered LinkedIn organization found — the connecting member must be an approved admin of the ${brand.name} company page.`,
    );
  }
  return { authorUrn: orgUrn, displayName: `Organization ${orgUrn.split(":").pop()}` };
}

export async function saveCredentials(
  fields: {
    accessToken: string;
    refreshToken?: string;
    expiresAt: string | null;
    authorUrn: string;
    scope?: string;
    displayName: string | null;
  },
  provider: "linkedin" | "linkedin_member" = "linkedin",
): Promise<void> {
  const db = serviceClient();
  if (!db) throw new Error("Supabase not configured");
  const { error } = await db.from("social_credentials").upsert(
    {
      provider,
      access_token: fields.accessToken,
      refresh_token: fields.refreshToken ?? null,
      expires_at: fields.expiresAt,
      author_urn: fields.authorUrn,
      scope: fields.scope ?? null,
      display_name: fields.displayName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider" },
  );
  if (error) throw new Error(`saving LinkedIn credentials failed: ${error.message}`);
}

/** Escape LinkedIn "little text" reserved characters in commentary. */
export function escapeLittleText(text: string): string {
  return text.replace(/[\\|{}@[\]()<>~_*]/g, (c) => `\\${c}`);
}

export async function uploadImage(
  accessToken: string,
  ownerUrn: string,
  bytes: Uint8Array,
): Promise<string> {
  const init = await fetch(`${API_BASE}/rest/images?action=initializeUpload`, {
    method: "POST",
    headers: restHeaders(accessToken),
    body: JSON.stringify({ initializeUploadRequest: { owner: ownerUrn } }),
  });
  if (!init.ok) throw new Error(`LinkedIn image init failed (${init.status}): ${await init.text()}`);
  const { value } = await init.json();
  const put = await fetch(value.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: bytes as unknown as BodyInit,
  });
  if (!put.ok) throw new Error(`LinkedIn image upload failed (${put.status})`);
  return value.image as string;
}

export async function createPost(opts: {
  accessToken: string;
  authorUrn: string;
  commentary: string;
  imageUrn?: string;
  imageAlt?: string;
}): Promise<{ urn: string; url: string }> {
  const body: Record<string, unknown> = {
    author: opts.authorUrn,
    commentary: escapeLittleText(opts.commentary),
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
  if (opts.imageUrn) {
    body.content = { media: { id: opts.imageUrn, altText: opts.imageAlt ?? "" } };
  }
  const res = await fetch(`${API_BASE}/rest/posts`, {
    method: "POST",
    headers: restHeaders(opts.accessToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LinkedIn post failed (${res.status}): ${await res.text()}`);
  const urn = res.headers.get("x-restli-id") ?? "";
  return { urn, url: urn ? `https://www.linkedin.com/feed/update/${urn}` : "" };
}
