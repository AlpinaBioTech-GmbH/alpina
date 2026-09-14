// Daily-post gating. The post-social cron fires once a day and this module
// guards against a second run on the same UTC day — e.g. a manual re-trigger of
// the cron or a redeploy that replays it — so a platform can't post twice. The
// cron's own schedule decides *when* the daily post goes out; there is no
// in-app time window to wait for.
import { serviceClient } from "@/lib/supabase/service";
import type { RunKind } from "@/lib/runs";

/**
 * Has a cron-triggered run for this kind already started today (UTC)?
 * Fails CLOSED: when the query cannot be answered (no client, error, throw),
 * report "already ran" so an uncertain state skips the post instead of
 * risking a duplicate (a swallowed transient error caused a same-day double
 * on 2026-08-21).
 */
export async function hasCronRunToday(kind: RunKind, now = new Date()): Promise<boolean> {
  try {
    const db = serviceClient();
    if (!db) return true;
    const dayStart = `${now.toISOString().slice(0, 10)}T00:00:00Z`;
    const { data, error } = await db
      .from("pipeline_runs")
      .select("id")
      .eq("kind", kind)
      .eq("trigger", "cron")
      .gte("started_at", dayStart)
      .limit(1);
    if (error) return true;
    return Boolean(data && data.length > 0);
  } catch {
    return true;
  }
}

export type SlotDecision = { run: true } | { run: false; reason: "already-ran" };

/** Decide whether this cron invocation should execute the platform's daily post. */
export async function dailySlotDecision(platform: RunKind, now = new Date()): Promise<SlotDecision> {
  if (await hasCronRunToday(platform, now)) {
    return { run: false, reason: "already-ran" };
  }
  return { run: true };
}
