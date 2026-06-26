import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { runDailyPost } from "@/lib/linkedin/pipeline";
import { runDailyTweet } from "@/lib/twitter/pipeline";
import { runDailyIgPost } from "@/lib/instagram/pipeline";
import { checkTokenReminders } from "@/lib/social/reminders";
import { alertOnFailures, type PlatformOutcome } from "@/lib/social/notify";
import { dailySlotDecision } from "@/lib/social/schedule";
import type { RunTrigger } from "@/lib/runs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// The cron fires once a day (vercel.json, 14:00 UTC) and each platform posts
// on that invocation. dailySlotDecision only guards against a second run on the
// same UTC day (manual cron re-trigger or replayed redeploy).

type Runner = (trigger: RunTrigger) => Promise<{ ok: boolean; status: string; reason?: string }>;

async function runIfDue(platform: "linkedin" | "twitter" | "instagram", runner: Runner) {
  const decision = await dailySlotDecision(platform);
  if (!decision.run) {
    return { ok: true, status: decision.reason };
  }
  return runner("cron");
}

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Token reminders piggyback on LinkedIn's once-a-day slot so the operator
  // email can't repeat across the window's multiple invocations.
  const linkedinDecision = await dailySlotDecision("linkedin");
  const runReminders = linkedinDecision.run;

  const [li, tw, ig, reminders] = await Promise.allSettled([
    runIfDue("linkedin", runDailyPost),
    runIfDue("twitter", runDailyTweet),
    runIfDue("instagram", runDailyIgPost),
    runReminders ? checkTokenReminders() : Promise.resolve([] as string[]),
  ]);

  const unwrap = (r: PromiseSettledResult<unknown>) =>
    r.status === "fulfilled" ? r.value : { ok: false, status: "failed", reason: String(r.reason) };

  const linkedin = unwrap(li) as PlatformOutcome;
  const twitter = unwrap(tw) as PlatformOutcome;
  const instagram = unwrap(ig) as PlatformOutcome;

  // Page the operator if any platform failed in an actionable way (best-effort).
  await alertOnFailures("cron", { linkedin, twitter, instagram });

  return NextResponse.json({
    linkedin,
    twitter,
    instagram,
    reminders: reminders.status === "fulfilled" ? reminders.value : [],
  });
}
