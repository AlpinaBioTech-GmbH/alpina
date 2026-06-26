// Daily LinkedIn pipeline. Invariant: the compose→validate loop touches no DB;
// the caller writes exactly one row per run — the posted winner, or one
// `skipped` row carrying the last draft and the validator's reason.
import { serviceClient } from "@/lib/supabase/service";
import {
  startRun,
  finishRun,
  markLatestFailedRunRecovered,
  type RunAttempt,
  type RunTrigger,
} from "@/lib/runs";
import {
  buildCatalog,
  excludeItems,
  imageUrlFor,
  type CatalogItem,
} from "@/lib/social/catalog";
import { pickPillar, type Pillar } from "@/lib/social/pillars";
import { assembleLinkedinText } from "@/lib/social/format";
import { composeLinkedinPost } from "@/lib/anthropic/linkedin-composer";
import { validateLinkedinPost } from "@/lib/linkedin/validator";
import {
  getConnection,
  uploadImage,
  createPost,
  linkedinAccount,
  type LinkedinConnection,
} from "@/lib/linkedin/client";

const MAX_ATTEMPTS = Number(process.env.SOCIAL_MAX_ATTEMPTS ?? 3);

export interface LinkedinCandidate {
  item: CatalogItem;
  pillar: string;
  commentary: string;
  hashtags: string[];
  fullText: string;
  imageUrl: string;
}

export interface LinkedinResult {
  ok: boolean;
  status: "posted" | "skipped" | "failed";
  reason?: string;
  postId?: string;
  postUrl?: string;
}

interface RecentPost {
  pillar: string | null;
  commentary: string;
  content_id: string;
}

async function fetchRecentPosts(limit = 25): Promise<RecentPost[]> {
  const db = serviceClient();
  if (!db) return [];
  const { data } = await db
    .from("linkedin_posts")
    .select("pillar, commentary, content_id")
    .eq("status", "posted")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as RecentPost[]) ?? [];
}

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20_000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    } finally {
      clearTimeout(t);
    }
  } catch {
    return null;
  }
}

interface ComposeOutcome {
  candidate: (LinkedinCandidate & { imageBytes: Uint8Array | null }) | null;
  attempts: RunAttempt[];
  lastDraft: LinkedinCandidate | null;
}

async function composeValidatedCandidate(opts: {
  catalog: CatalogItem[];
  recent: RecentPost[];
  connection: LinkedinConnection | null;
  skipConnectionCheck?: boolean;
}): Promise<ComposeOutcome> {
  const recentTexts = opts.recent.map((r) => r.commentary).slice(0, 25);
  const recentItemIds = [...new Set(opts.recent.map((r) => r.content_id))].slice(0, 6);
  const triedPillars = new Set<string>();
  const triedItems = new Set<string>();
  const attempts: RunAttempt[] = [];
  let lastDraft: LinkedinCandidate | null = null;

  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    const pillar: Pillar = pickPillar(opts.recent, triedPillars);
    triedPillars.add(pillar.id);
    const narrowed = excludeItems(opts.catalog, triedItems);

    const composed = await composeLinkedinPost({
      pillar,
      catalog: narrowed,
      recentTexts,
      recentItemIds,
    }).catch((err) => {
      console.error("[linkedin] composer error:", err);
      return null;
    });
    if (!composed) {
      attempts.push({ attempt: i, approved: false, notes: "composer produced nothing" });
      continue;
    }

    const item = opts.catalog.find((c) => c.id === composed.itemId) ?? narrowed[0];
    if (!item) {
      attempts.push({ attempt: i, approved: false, notes: "composer chose unknown item" });
      continue;
    }
    triedItems.add(item.id);

    const fullText = assembleLinkedinText(composed.commentary, item.url, composed.hashtags);
    const imageUrl = imageUrlFor(item);
    lastDraft = {
      item,
      pillar: pillar.id,
      commentary: composed.commentary,
      hashtags: composed.hashtags,
      fullText,
      imageUrl,
    };

    const imageBytes = await fetchImageBytes(imageUrl);
    const validation = await validateLinkedinPost({
      connection: opts.connection,
      fullText,
      url: item.url,
      hashtags: composed.hashtags,
      imageBytes,
      recentTexts,
      skipConnectionCheck: opts.skipConnectionCheck,
    });
    if (validation.ok) {
      attempts.push({
        attempt: i,
        approved: true,
        notes: `approved (pillar ${pillar.id}, item "${item.title}" ${item.slug ?? item.url})`,
      });
      return { candidate: { ...lastDraft, imageBytes }, attempts, lastDraft };
    }
    attempts.push({ attempt: i, approved: false, notes: validation.reasons.join("; ") });
  }
  return { candidate: null, attempts, lastDraft };
}

async function insertPostRow(
  draft: LinkedinCandidate,
  status: "queued" | "skipped",
  validatorNotes?: string,
): Promise<string | null> {
  const db = serviceClient();
  if (!db) return null;
  const { data, error } = await db
    .from("linkedin_posts")
    .insert({
      content_type: draft.item.type,
      content_id: draft.item.id,
      content_slug: draft.item.slug,
      url: draft.item.url,
      image_url: draft.imageUrl,
      pillar: draft.pillar,
      commentary: draft.commentary,
      hashtags: draft.hashtags,
      status,
      validator_notes: validatorNotes ?? null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[linkedin] insert post row failed:", error.message);
    return null;
  }
  return data.id as string;
}

async function publishCandidate(
  candidate: LinkedinCandidate & { imageBytes: Uint8Array | null },
  connection: LinkedinConnection,
  rowId: string | null,
): Promise<LinkedinResult> {
  const db = serviceClient();
  try {
    let imageUrn: string | undefined;
    if (candidate.imageBytes) {
      imageUrn = await uploadImage(connection.accessToken, connection.authorUrn, candidate.imageBytes);
    }
    const posted = await createPost({
      accessToken: connection.accessToken,
      authorUrn: connection.authorUrn,
      commentary: candidate.fullText,
      imageUrn,
      imageAlt: candidate.item.title,
    });
    if (db && rowId) {
      await db
        .from("linkedin_posts")
        .update({
          status: "posted",
          linkedin_urn: posted.urn,
          linkedin_url: posted.url,
          posted_at: new Date().toISOString(),
        })
        .eq("id", rowId);
    }
    return { ok: true, status: "posted", postId: rowId ?? undefined, postUrl: posted.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (db && rowId) {
      await db.from("linkedin_posts").update({ status: "failed", error: message }).eq("id", rowId);
    }
    return { ok: false, status: "failed", reason: message, postId: rowId ?? undefined };
  }
}

// Mirror the same post to the admin's personal profile, if that second
// connection (a separate LinkedIn app) exists and is enabled. Best-effort:
// never fails or blocks the org run. The image is re-uploaded under the member
// owner because LinkedIn image URNs are owner-scoped.
async function crossPostToMember(
  candidate: LinkedinCandidate & { imageBytes: Uint8Array | null },
  opts: { requireAuto: boolean },
): Promise<void> {
  try {
    const member = await getConnection(linkedinAccount("member"));
    if (!member || member.expired) return;
    if (opts.requireAuto && !member.autoEnabled) return;
    const result = await publishCandidate(candidate, member, null);
    if (!result.ok) console.warn("[linkedin] member cross-post skipped:", result.reason);
  } catch (err) {
    console.warn("[linkedin] member cross-post failed:", err);
  }
}

async function runWithCatalog(
  catalog: CatalogItem[],
  opts: { trigger: RunTrigger; requireAuto: boolean },
): Promise<LinkedinResult> {
  const runId = await startRun("linkedin", opts.trigger);
  try {
    const connection = await getConnection();
    if (!connection || connection.expired) {
      const reason = connection ? "LinkedIn token expired" : "LinkedIn not connected";
      await finishRun(runId, { outcome: "skipped", notes: reason });
      return { ok: false, status: "skipped", reason };
    }
    if (opts.requireAuto && !connection.autoEnabled) {
      await finishRun(runId, { outcome: "skipped", notes: "auto-post disabled" });
      return { ok: false, status: "skipped", reason: "auto-post disabled" };
    }
    if (catalog.length === 0) {
      await finishRun(runId, { outcome: "skipped", notes: "empty catalog" });
      return { ok: false, status: "skipped", reason: "empty catalog" };
    }

    const recent = await fetchRecentPosts();
    const { candidate, attempts, lastDraft } = await composeValidatedCandidate({
      catalog,
      recent,
      connection,
    });

    if (!candidate) {
      const reason = attempts.at(-1)?.notes ?? "no candidate composed";
      if (lastDraft) await insertPostRow(lastDraft, "skipped", reason);
      await finishRun(runId, { outcome: "skipped", attempts, notes: reason });
      return { ok: false, status: "skipped", reason };
    }

    const rowId = await insertPostRow(candidate, "queued");
    const result = await publishCandidate(candidate, connection, rowId);
    await crossPostToMember(candidate, { requireAuto: opts.requireAuto });
    await finishRun(runId, {
      status: result.ok ? "success" : "error",
      outcome: result.status,
      attempts,
      notes: result.ok ? result.postUrl : result.reason,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[linkedin] pipeline error:", err);
    await finishRun(runId, { status: "error", outcome: "failed", notes: message });
    return { ok: false, status: "failed", reason: message };
  }
}

/** Full daily run (cron honors the auto toggle; manual bypasses it). */
export async function runDailyPost(trigger: RunTrigger): Promise<LinkedinResult> {
  const catalog = await buildCatalog().catch(() => []);
  return runWithCatalog(catalog, { trigger, requireAuto: trigger === "cron" });
}

/** Post about one specific item (announce-on-publish / manual share). */
export async function postItemToLinkedin(
  item: CatalogItem,
  opts: { trigger: RunTrigger; requireAuto: boolean },
): Promise<LinkedinResult> {
  return runWithCatalog([item], opts);
}

/** Compose+validate only — no DB write, no publish. For the admin preview. */
export async function previewPost(): Promise<{
  candidate: LinkedinCandidate | null;
  approved: boolean;
  attempts: RunAttempt[];
}> {
  const catalog = await buildCatalog().catch(() => []);
  const recent = await fetchRecentPosts();
  const connection = await getConnection();
  const { candidate, attempts, lastDraft } = await composeValidatedCandidate({
    catalog,
    recent,
    connection,
    skipConnectionCheck: true,
  });
  if (candidate) {
    const payload: LinkedinCandidate = {
      item: candidate.item,
      pillar: candidate.pillar,
      commentary: candidate.commentary,
      hashtags: candidate.hashtags,
      fullText: candidate.fullText,
      imageUrl: candidate.imageUrl,
    };
    return { candidate: payload, approved: true, attempts };
  }
  return { candidate: lastDraft, approved: false, attempts };
}

/** Publish a previewed payload exactly as-is — single-shot, skips the loop. */
export async function publishComposed(payload: LinkedinCandidate): Promise<LinkedinResult> {
  const connection = await getConnection();
  if (!connection || connection.expired) {
    return { ok: false, status: "skipped", reason: "LinkedIn not connected" };
  }
  const imageBytes = await fetchImageBytes(payload.imageUrl);
  const rowId = await insertPostRow(payload, "queued");
  return publishCandidate({ ...payload, imageBytes }, connection, rowId);
}

/** Retry a queued/failed row by id. */
export async function publishExisting(postId: string): Promise<LinkedinResult> {
  const db = serviceClient();
  if (!db) return { ok: false, status: "failed", reason: "Supabase not configured" };
  const { data: row } = await db.from("linkedin_posts").select("*").eq("id", postId).maybeSingle();
  if (!row) return { ok: false, status: "failed", reason: "post not found" };
  const connection = await getConnection();
  if (!connection || connection.expired) {
    return { ok: false, status: "skipped", reason: "LinkedIn not connected" };
  }
  const candidate: LinkedinCandidate & { imageBytes: Uint8Array | null } = {
    item: {
      type: row.content_type,
      id: row.content_id,
      slug: row.content_slug,
      title: row.content_slug ?? row.url,
      summary: "",
      url: row.url,
      tags: [],
    },
    pillar: row.pillar,
    commentary: row.commentary,
    hashtags: row.hashtags ?? [],
    fullText: assembleLinkedinText(row.commentary, row.url, row.hashtags ?? []),
    imageUrl: row.image_url,
    imageBytes: row.image_url ? await fetchImageBytes(row.image_url) : null,
  };
  const result = await publishCandidate(candidate, connection, postId);
  if (result.ok) {
    await markLatestFailedRunRecovered("linkedin", "recovered via admin retry");
  }
  return result;
}
