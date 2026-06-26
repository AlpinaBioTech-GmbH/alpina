// Daily-post gating. The post-social cron fires once a day and this module
// guards against a second run on the same UTC day — e.g. a manual re-trigger of
// the cron or a redeploy that replays it — so a platform can't post twice. The
// cron's own schedule decides *when* the daily post goes out; there is no
// in-app time window to wait for.
import { serviceClient } from "@/lib/supabase/service";
import type { RunKind } from "@/lib/runs";

/** Has a cron-triggered run for this kind already started today (UTC)? */
export async function hasCronRunToday(kind: RunKind, now = new Date()): Promise<boolean> {
  try {
    const db = serviceClient();
    if (!db) return false;
    const dayStart = `${now.toISOString().slice(0, 10)}T00:00:00Z`;
    const { data } = await db
      .from("pipeline_runs")
      .select("id")
      .eq("kind", kind)
      .eq("trigger", "cron")
      .gte("started_at", dayStart)
      .limit(1);
    return Boolean(data && data.length > 0);
  } catch {
    return false;
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
