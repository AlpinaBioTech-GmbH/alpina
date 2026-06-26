// Create a new Storyblok space for AlpinaBioTech and capture its tokens.
//
// Usage: STORYBLOK_PERSONAL_ACCESS_TOKEN=... npm run create-space
//
// Uses your Storyblok Personal Access Token (account-level OAuth token) to:
//   1. POST a new space ("AlpinaBioTech") in the chosen region.
//   2. Read the space's delivery tokens (public + preview/draft).
//   3. Append STORYBLOK_SPACE_ID + tokens to .env.local.
// Then run `npm run seed` to push the content.
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { appendFileSync, readFileSync, existsSync } from "node:fs";

const PAT = process.env.STORYBLOK_PERSONAL_ACCESS_TOKEN?.trim();
const REGION = (process.env.STORYBLOK_REGION || process.env.NEXT_PUBLIC_STORYBLOK_REGION || "eu").toLowerCase();
const SPACE_NAME = process.env.STORYBLOK_SPACE_NAME || "AlpinaBioTech";

const MAPI_HOST: Record<string, string> = {
  eu: "https://mapi.storyblok.com",
  us: "https://api-us.storyblok.com",
  ap: "https://api-ap.storyblok.com",
  ca: "https://api-ca.storyblok.com",
  cn: "https://app.storyblokchina.com",
};

if (!PAT) {
  console.error(
    "Missing STORYBLOK_PERSONAL_ACCESS_TOKEN. Create one at\n" +
      "  https://app.storyblok.com/#/me/account?tab=token\n" +
      "and add it to .env.local, then re-run `npm run create-space`.",
  );
  process.exit(1);
}

const BASE = `${MAPI_HOST[REGION] ?? MAPI_HOST.eu}/v1`;

async function mapi(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: PAT!,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`MAPI ${res.status} ${path}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function upsertEnv(vars: Record<string, string>) {
  const path = ".env.local";
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const lines: string[] = [];
  for (const [k, v] of Object.entries(vars)) {
    if (new RegExp(`^${k}=`, "m").test(existing)) {
      console.log(`  (skip, already in .env.local) ${k}`);
      continue;
    }
    lines.push(`${k}=${v}`);
  }
  if (lines.length) {
    appendFileSync(
      path,
      `\n# --- Storyblok space (created ${SPACE_NAME}) ---\n${lines.join("\n")}\n`,
    );
    console.log(`  appended ${lines.length} vars to .env.local`);
  }
}

async function main() {
  console.log(`Creating Storyblok space "${SPACE_NAME}" in region ${REGION}...`);
  const created = await mapi(`/spaces/`, {
    method: "POST",
    body: JSON.stringify({ space: { name: SPACE_NAME } }),
  });
  const space = created.space;
  console.log(`  created space id ${space.id}`);

  // Delivery tokens (public + preview). New spaces auto-create them.
  const keys = await mapi(`/spaces/${space.id}/api_keys`);
  const list: { access: string; token: string }[] = keys.api_keys ?? [];
  const publicToken = list.find((k) => k.access === "public")?.token;
  const previewToken =
    list.find((k) => k.access === "private" || k.access === "preview")?.token ||
    publicToken;

  upsertEnv({
    STORYBLOK_SPACE_ID: String(space.id),
    NEXT_PUBLIC_STORYBLOK_REGION: REGION,
    ...(publicToken ? { NEXT_PUBLIC_STORYBLOK_TOKEN: publicToken } : {}),
    ...(previewToken ? { STORYBLOK_PREVIEW_TOKEN: previewToken } : {}),
    // The PAT doubles as the management credential for the seed/push.
    STORYBLOK_MANAGEMENT_TOKEN: PAT!,
  });

  console.log("\nDone. Next:");
  console.log("  npm run seed     # define components + push all content");
  console.log(
    `  Then set the space preview URL to https://localhost:3000/ at\n` +
      `  https://app.storyblok.com/#/me/spaces/${space.id}/settings`,
  );
}

main().catch((err) => {
  console.error("create-space failed:", err.message || err);
  process.exit(1);
});
