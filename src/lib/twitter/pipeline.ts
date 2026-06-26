// Daily X (Twitter) pipeline — mirrors the LinkedIn pipeline: validate before
// insert, exactly one twitter_posts row per run. Text-only posts.
import { serviceClient } from "@/lib/supabase/service";
import {
  startRun,
  finishRun,
  markLatestFailedRunRecovered,
  type RunAttempt,
  type RunTrigger,
} from "@/lib/runs";
import { buildCatalog, excludeItems, type CatalogItem } from "@/lib/social/catalog";
import { pickPillar, type Pillar } from "@/lib/social/pillars";
import { assembleTweetText, normalizeDashes } from "@/lib/social/format";
import { composeTweet } from "@/lib/anthropic/twitter-composer";
import { validateTweet } from "@/lib/twitter/validator";
import {
  getConnection,
  consumeXFailure,
  createTweet,
  twitterAccount,
  type TwitterConnection,
} from "@/lib/twitter/client";

const MAX_ATTEMPTS = Number(process.env.SOCIAL_MAX_ATTEMPTS ?? 3);

// Turns a null getConnection() into an accurate skip reason. "transient" is
// phrased to avoid the alert substrings (it should not page the operator); the
// others deliberately contain "reconnect required" so the failure alert fires.
function xConnectionSkipReason(): string {
  const failure = consumeXFailure();
  if (!failure) return "X not connected";
  if (failure.kind === "terminal") return "X token refresh failed — reconnect required";
  if (failure.kind === "persist-critical") return "X token persist failed — reconnect required";
  return "X temporarily unreachable; will retry next run";
}

export interface TweetCandidate {
  item: CatalogItem;
  pillar: string;
  text: string; // body only
  hashtags: string[];
  fullText: string;
}

export interface TwitterResult {
  ok: boolean;
  status: "posted" | "skipped" | "failed";
  reason?: string;
  postId?: string;
  postUrl?: string;
}

interface RecentTweet {
  pillar: string | null;
  text: string;
  content_id: string;
}

async function fetchRecentTweets(limit = 25): Promise<RecentTweet[]> {
  const db = serviceClient();
  if (!db) return [];
  const { data } = await db
    .from("twitter_posts")
    .select("pillar, text, content_id")
    .eq("status", "posted")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as RecentTweet[]) ?? [];
}

interface ComposeOutcome {
  candidate: TweetCandidate | null;
  attempts: RunAttempt[];
  lastDraft: TweetCandidate | null;
}

async function composeValidatedCandidate(opts: {
  catalog: CatalogItem[];
  recent: RecentTweet[];
  connected: boolean;
  skipConnectionCheck?: boolean;
}): Promise<ComposeOutcome> {
  const recentTexts = opts.recent.map((r) => r.text).slice(0, 25);
  const recentItemIds = [...new Set(opts.recent.map((r) => r.content_id))].slice(0, 6);
  const triedPillars = new Set<string>();
  const triedItems = new Set<string>();
  const attempts: RunAttempt[] = [];
  let lastDraft: TweetCandidate | null = null;

  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    const pillar: Pillar = pickPillar(opts.recent, triedPillars);
    triedPillars.add(pillar.id);
    const narrowed = excludeItems(opts.catalog, triedItems);

    const composed = await composeTweet({
      pillar,
      catalog: narrowed,
      recentTexts,
      recentItemIds,
    }).catch((err) => {
      console.error("[twitter] composer error:", err);
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

    const fullText = normalizeDashes(assembleTweetText(composed.text, item.url, composed.hashtags));
    lastDraft = {
      item,
      pillar: pillar.id,
      text: composed.text,
      hashtags: composed.hashtags,
      fullText,
    };

    const validation = await validateTweet({
      connected: opts.connected,
      fullText,
      url: item.url,
      hashtags: composed.hashtags,
      recentTexts,
      skipConnectionCheck: opts.skipConnectionCheck,
    });
    if (validation.ok) {
      attempts.push({
        attempt: i,
        approved: true,
        notes: `approved (pillar ${pillar.id}, item "${item.title}" ${item.slug ?? item.url})`,
      });
      return { candidate: lastDraft, attempts, lastDraft };
    }
    attempts.push({ attempt: i, approved: false, notes: validation.reasons.join("; ") });
  }
  return { candidate: null, attempts, lastDraft };
}

async function insertTweetRow(
  draft: TweetCandidate,
  status: "queued" | "skipped",
  validatorNotes?: string,
): Promise<string | null> {
  const db = serviceClient();
  if (!db) return null;
  const { data, error } = await db
    .from("twitter_posts")
    .insert({
      content_type: draft.item.type,
      content_id: draft.item.id,
      content_slug: draft.item.slug,
      url: draft.item.url,
      pillar: draft.pillar,
      text: draft.text,
      hashtags: draft.hashtags,
      status,
      validator_notes: validatorNotes ?? null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[twitter] insert tweet row failed:", error.message);
    return null;
  }
  return data.id as string;
}

async function publishCandidate(
  candidate: TweetCandidate,
  connection: TwitterConnection,
  rowId: string | null,
): Promise<TwitterResult> {
  const db = serviceClient();
  try {
    const posted = await createTweet(connection.accessToken, candidate.fullText);
    if (db && rowId) {
      await db
        .from("twitter_posts")
        .update({
          status: "posted",
          tweet_id: posted.id,
          tweet_url: posted.url,
          posted_at: new Date().toISOString(),
        })
        .eq("id", rowId);
    }
    return { ok: true, status: "posted", postId: rowId ?? undefined, postUrl: posted.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (db && rowId) {
      await db.from("twitter_posts").update({ status: "failed", error: message }).eq("id", rowId);
    }
    return { ok: false, status: "failed", reason: message, postId: rowId ?? undefined };
  }
}

// Mirror the same tweet to the admin's personal X account, if that second
// connection exists and is enabled. Best-effort: never throws or blocks the
// company post, and writes no twitter_posts row (rowId null) — fire-and-forget,
// mirroring the LinkedIn personal cross-post.
async function crossPostToMember(
  candidate: TweetCandidate,
  opts: { requireAuto: boolean },
): Promise<void> {
  try {
    const member = await getConnection(twitterAccount("member"));
    if (!member) return;
    if (opts.requireAuto && !member.autoEnabled) return;
    const result = await publishCandidate(candidate, member, null);
    if (!result.ok) console.warn("[twitter] member cross-post skipped:", result.reason);
  } catch (err) {
    console.warn("[twitter] member cross-post failed:", err);
  }
}

async function runWithCatalog(
  catalog: CatalogItem[],
  opts: { trigger: RunTrigger; requireAuto: boolean },
): Promise<TwitterResult> {
  const runId = await startRun("twitter", opts.trigger);
  try {
    const connection = await getConnection();
    if (!connection) {
      const reason = xConnectionSkipReason();
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

    const recent = await fetchRecentTweets();
    const { candidate, attempts, lastDraft } = await composeValidatedCandidate({
      catalog,
      recent,
      connected: true,
    });

    if (!candidate) {
      const reason = attempts.at(-1)?.notes ?? "no candidate composed";
      if (lastDraft) await insertTweetRow(lastDraft, "skipped", reason);
      await finishRun(runId, { outcome: "skipped", attempts, notes: reason });
      return { ok: false, status: "skipped", reason };
    }

    const rowId = await insertTweetRow(candidate, "queued");
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
    console.error("[twitter] pipeline error:", err);
    await finishRun(runId, { status: "error", outcome: "failed", notes: message });
    return { ok: false, status: "failed", reason: message };
  }
}

/** Full daily run (cron honors the auto toggle; manual bypasses it). */
export async function runDailyTweet(trigger: RunTrigger): Promise<TwitterResult> {
  const catalog = await buildCatalog().catch(() => []);
  return runWithCatalog(catalog, { trigger, requireAuto: trigger === "cron" });
}

/** Tweet about one specific item (announce-on-publish / manual share). */
export async function postItemToTwitter(
  item: CatalogItem,
  opts: { trigger: RunTrigger; requireAuto: boolean },
): Promise<TwitterResult> {
  return runWithCatalog([item], opts);
}

/** Compose+validate only — no DB write, no publish. For the admin preview. */
export async function previewTweet(): Promise<{
  candidate: TweetCandidate | null;
  approved: boolean;
  attempts: RunAttempt[];
}> {
  const catalog = await buildCatalog().catch(() => []);
  const recent = await fetchRecentTweets();
  const { candidate, attempts, lastDraft } = await composeValidatedCandidate({
    catalog,
    recent,
    connected: false,
    skipConnectionCheck: true,
  });
  if (candidate) return { candidate, approved: true, attempts };
  return { candidate: lastDraft, approved: false, attempts };
}

/** Publish a previewed payload exactly as-is — single-shot, skips the loop. */
export async function publishComposed(payload: TweetCandidate): Promise<TwitterResult> {
  const connection = await getConnection();
  if (!connection) return { ok: false, status: "skipped", reason: xConnectionSkipReason() };
  const rowId = await insertTweetRow(payload, "queued");
  return publishCandidate(payload, connection, rowId);
}

/** Retry a queued/failed row by id. */
export async function publishExisting(postId: string): Promise<TwitterResult> {
  const db = serviceClient();
  if (!db) return { ok: false, status: "failed", reason: "Supabase not configured" };
  const { data: row } = await db.from("twitter_posts").select("*").eq("id", postId).maybeSingle();
  if (!row) return { ok: false, status: "failed", reason: "post not found" };
  const connection = await getConnection();
  if (!connection) return { ok: false, status: "skipped", reason: xConnectionSkipReason() };
  const candidate: TweetCandidate = {
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
    text: row.text,
    hashtags: row.hashtags ?? [],
    fullText: assembleTweetText(row.text, row.url, row.hashtags ?? []),
  };
  const result = await publishCandidate(candidate, connection, postId);
  if (result.ok) {
    await markLatestFailedRunRecovered("twitter", "recovered via admin retry");
  }
  return result;
}
