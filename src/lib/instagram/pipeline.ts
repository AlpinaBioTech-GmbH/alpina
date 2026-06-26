// Daily Instagram pipeline — mirrors LinkedIn/X: validate before insert,
// exactly one instagram_posts row per run (posted winner or one skipped row).
// Publish order: insert queued row (slides) -> signed slide URLs -> carousel
// containers -> publish -> update row.
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
import { composeCarousel, assembleCaption } from "@/lib/anthropic/instagram-composer";
import { validateCarousel } from "@/lib/instagram/validator";
import {
  getConnection,
  publishCarousel,
  slideUrl,
  type InstagramConnection,
} from "@/lib/instagram/client";
import type { SlideSpec } from "@/lib/instagram/slides";

const MAX_ATTEMPTS = Number(process.env.SOCIAL_MAX_ATTEMPTS ?? 3);

export interface InstagramCandidate {
  item: CatalogItem;
  pillar: string;
  caption: string; // body only
  hashtags: string[];
  slides: SlideSpec[];
  fullCaption: string; // caption + hashtags, as posted
}

export interface InstagramResult {
  ok: boolean;
  status: "posted" | "skipped" | "failed";
  reason?: string;
  postId?: string;
  postUrl?: string;
}

interface RecentIgPost {
  pillar: string | null;
  caption: string;
  content_id: string;
}

async function fetchRecentPosts(limit = 25): Promise<RecentIgPost[]> {
  const db = serviceClient();
  if (!db) return [];
  const { data } = await db
    .from("instagram_posts")
    .select("pillar, caption, content_id")
    .eq("status", "posted")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as RecentIgPost[]) ?? [];
}

interface ComposeOutcome {
  candidate: InstagramCandidate | null;
  attempts: RunAttempt[];
  lastDraft: InstagramCandidate | null;
}

async function composeValidatedCandidate(opts: {
  catalog: CatalogItem[];
  recent: RecentIgPost[];
  connected: boolean;
  skipConnectionCheck?: boolean;
}): Promise<ComposeOutcome> {
  const recentTexts = opts.recent.map((r) => r.caption).slice(0, 25);
  const recentItemIds = [...new Set(opts.recent.map((r) => r.content_id))].slice(0, 6);
  const triedPillars = new Set<string>();
  const triedItems = new Set<string>();
  const attempts: RunAttempt[] = [];
  let lastDraft: InstagramCandidate | null = null;

  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    const pillar: Pillar = pickPillar(opts.recent, triedPillars);
    triedPillars.add(pillar.id);
    const narrowed = excludeItems(opts.catalog, triedItems);

    const composed = await composeCarousel({
      pillar,
      catalog: narrowed,
      recentTexts,
      recentItemIds,
    }).catch((err) => {
      console.error("[instagram] composer error:", err);
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

    const fullCaption = assembleCaption(composed.caption, composed.hashtags);
    lastDraft = {
      item,
      pillar: pillar.id,
      caption: composed.caption,
      hashtags: composed.hashtags,
      slides: composed.slides,
      fullCaption,
    };

    const validation = await validateCarousel({
      connected: opts.connected,
      fullCaption,
      slides: composed.slides,
      hashtags: composed.hashtags,
      groundingUrl: item.url,
      recentTexts,
      skipConnectionCheck: opts.skipConnectionCheck,
    });
    if (validation.ok) {
      attempts.push({
        attempt: i,
        approved: true,
        notes: `approved (pillar ${pillar.id}, item "${item.title}" ${item.slug ?? item.url}, ${composed.slides.length} slides)`,
      });
      return { candidate: lastDraft, attempts, lastDraft };
    }
    attempts.push({ attempt: i, approved: false, notes: validation.reasons.join("; ") });
  }
  return { candidate: null, attempts, lastDraft };
}

async function insertPostRow(
  draft: InstagramCandidate,
  status: "queued" | "skipped",
  validatorNotes?: string,
): Promise<string | null> {
  const db = serviceClient();
  if (!db) return null;
  const { data, error } = await db
    .from("instagram_posts")
    .insert({
      content_type: draft.item.type,
      content_id: draft.item.id,
      content_slug: draft.item.slug,
      url: draft.item.url,
      pillar: draft.pillar,
      caption: draft.caption,
      hashtags: draft.hashtags,
      slides: draft.slides,
      status,
      validator_notes: validatorNotes ?? null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[instagram] insert post row failed:", error.message);
    return null;
  }
  return data.id as string;
}

async function publishRow(
  candidate: InstagramCandidate,
  connection: InstagramConnection,
  rowId: string | null,
): Promise<InstagramResult> {
  const db = serviceClient();
  if (!rowId) return { ok: false, status: "failed", reason: "post row missing (DB unavailable)" };
  try {
    const imageUrls = candidate.slides.map((_, i) => slideUrl(rowId, i));

    // Fail fast with our own error (and warm the render route) before Meta's
    // fetcher reports an opaque "media URI" failure: every slide must render.
    for (let i = 0; i < imageUrls.length; i++) {
      const res = await fetch(imageUrls[i]).catch((err) => {
        throw new Error(`slide render unreachable at slide ${i + 1}: ${err}`);
      });
      const bytes = res.ok ? (await res.arrayBuffer()).byteLength : 0;
      if (!res.ok || bytes < 10_240) {
        const hint =
          res.status === 401
            ? " — 401 means the slide signing secret in THIS environment does not match the deployed /api/ig/slide route (check IG_SLIDE_SIGNING_SECRET here vs production)"
            : " — check /api/ig/slide";
        throw new Error(
          `slide render failed at slide ${i + 1} (HTTP ${res.status}, ${bytes} bytes)${hint}`,
        );
      }
    }

    const posted = await publishCarousel({
      accessToken: connection.accessToken,
      igUserId: connection.userId,
      imageUrls,
      caption: candidate.fullCaption,
    });
    if (db) {
      await db
        .from("instagram_posts")
        .update({
          status: "posted",
          ig_media_id: posted.mediaId,
          permalink: posted.permalink,
          posted_at: new Date().toISOString(),
        })
        .eq("id", rowId);
    }
    return { ok: true, status: "posted", postId: rowId, postUrl: posted.permalink ?? undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (db) {
      await db.from("instagram_posts").update({ status: "failed", error: message }).eq("id", rowId);
    }
    return { ok: false, status: "failed", reason: message, postId: rowId };
  }
}

async function runWithCatalog(
  catalog: CatalogItem[],
  opts: { trigger: RunTrigger; requireAuto: boolean },
): Promise<InstagramResult> {
  const runId = await startRun("instagram", opts.trigger);
  try {
    const connection = await getConnection();
    if (!connection || connection.expired) {
      const reason = connection ? "Instagram token expired" : "Instagram not connected";
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
      connected: true,
    });

    if (!candidate) {
      const reason = attempts.at(-1)?.notes ?? "no candidate composed";
      if (lastDraft) await insertPostRow(lastDraft, "skipped", reason);
      await finishRun(runId, { outcome: "skipped", attempts, notes: reason });
      return { ok: false, status: "skipped", reason };
    }

    const rowId = await insertPostRow(candidate, "queued");
    const result = await publishRow(candidate, connection, rowId);
    await finishRun(runId, {
      status: result.ok ? "success" : "error",
      outcome: result.status,
      attempts,
      notes: result.ok ? result.postUrl ?? "posted" : result.reason,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[instagram] pipeline error:", err);
    await finishRun(runId, { status: "error", outcome: "failed", notes: message });
    return { ok: false, status: "failed", reason: message };
  }
}

/** Full daily run (cron honors the auto toggle; manual bypasses it). */
export async function runDailyIgPost(trigger: RunTrigger): Promise<InstagramResult> {
  const catalog = await buildCatalog().catch(() => []);
  return runWithCatalog(catalog, { trigger, requireAuto: trigger === "cron" });
}

/** Post about one specific item (announce-on-publish / manual share). */
export async function postItemToInstagram(
  item: CatalogItem,
  opts: { trigger: RunTrigger; requireAuto: boolean },
): Promise<InstagramResult> {
  return runWithCatalog([item], opts);
}

/** Compose+validate only — no DB write, no publish. For the admin preview. */
export async function previewIgPost(): Promise<{
  candidate: InstagramCandidate | null;
  approved: boolean;
  attempts: RunAttempt[];
}> {
  const catalog = await buildCatalog().catch(() => []);
  const recent = await fetchRecentPosts();
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
export async function publishComposed(payload: InstagramCandidate): Promise<InstagramResult> {
  const connection = await getConnection();
  if (!connection || connection.expired) {
    return { ok: false, status: "skipped", reason: "Instagram not connected" };
  }
  const rowId = await insertPostRow(payload, "queued");
  return publishRow(payload, connection, rowId);
}

/** Retry a queued/failed row by id. */
export async function publishExisting(postId: string): Promise<InstagramResult> {
  const db = serviceClient();
  if (!db) return { ok: false, status: "failed", reason: "Supabase not configured" };
  const { data: row } = await db.from("instagram_posts").select("*").eq("id", postId).maybeSingle();
  if (!row) return { ok: false, status: "failed", reason: "post not found" };
  const connection = await getConnection();
  if (!connection || connection.expired) {
    return { ok: false, status: "skipped", reason: "Instagram not connected" };
  }
  const candidate: InstagramCandidate = {
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
    caption: row.caption,
    hashtags: row.hashtags ?? [],
    slides: (row.slides ?? []) as SlideSpec[],
    fullCaption: assembleCaption(row.caption, row.hashtags ?? []),
  };
  const result = await publishRow(candidate, connection, postId);
  if (result.ok) {
    await markLatestFailedRunRecovered("instagram", "recovered via admin retry");
  }
  return result;
}
