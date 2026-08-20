// src/lib/newsletter/stats.ts
// Per-broadcast performance numbers, aggregated in Postgres from the
// deduplicated webhook events (see migration 0006). All counts are unique
// recipients; link clicks are unique recipients per link.
import { getSupabaseAdmin } from "@/lib/supabase/service";

export type BroadcastCounts = {
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  failed: number;
};

export type IssueStats = BroadcastCounts & {
  links: { link_url: string; clicks: number }[];
};

const EMPTY: BroadcastCounts = {
  delivered: 0,
  opened: 0,
  clicked: 0,
  bounced: 0,
  complained: 0,
  failed: 0,
};

// Counts for many broadcasts at once (the issue list). One RPC round trip.
export async function getBroadcastCounts(
  broadcastIds: string[],
): Promise<Map<string, BroadcastCounts>> {
  const map = new Map<string, BroadcastCounts>();
  const supabase = getSupabaseAdmin();
  const ids = broadcastIds.filter(Boolean);
  if (!supabase || ids.length === 0) return map;

  const { data, error } = await supabase.rpc("newsletter_broadcast_stats", { ids });
  if (error) {
    console.warn("[newsletter] stats rpc failed:", error.message);
    return map;
  }
  for (const row of (data ?? []) as { broadcast_id: string; event_type: string; n: number }[]) {
    const counts = map.get(row.broadcast_id) ?? { ...EMPTY };
    if (row.event_type in counts) {
      counts[row.event_type as keyof BroadcastCounts] = Number(row.n);
    }
    map.set(row.broadcast_id, counts);
  }
  return map;
}

// --- Performance area helpers ----------------------------------------------

// Clicks on Resend's unsubscribe link measure people leaving, not engaging;
// every click aggregate (SQL RPCs and the TS summarizers) excludes them.
export function isUnsubscribeLink(url: string): boolean {
  return url.toLowerCase().includes("unsubscribe.resend.com");
}

// Hourly buckets of first opens / first clicks across an issue's broadcasts.
export type EventSeriesBucket = {
  bucket_start: string;
  opened: number;
  clicked: number;
};

export async function getEventSeries(
  broadcastIds: string[],
): Promise<EventSeriesBucket[]> {
  const supabase = getSupabaseAdmin();
  const ids = broadcastIds.filter(Boolean);
  if (!supabase || ids.length === 0) return [];

  const { data, error } = await supabase.rpc("newsletter_event_series", { ids });
  if (error) {
    console.warn("[newsletter] event series rpc failed:", error.message);
    return [];
  }
  const byBucket = new Map<string, EventSeriesBucket>();
  for (const row of (data ?? []) as {
    bucket_start: string;
    event_type: string;
    n: number;
  }[]) {
    const bucket =
      byBucket.get(row.bucket_start) ??
      ({ bucket_start: row.bucket_start, opened: 0, clicked: 0 } as EventSeriesBucket);
    if (row.event_type === "opened") bucket.opened = Number(row.n);
    if (row.event_type === "clicked") bucket.clicked = Number(row.n);
    byBucket.set(row.bucket_start, bucket);
  }
  return [...byBucket.values()].sort((a, b) =>
    a.bucket_start.localeCompare(b.bucket_start),
  );
}

// Window the hourly buckets into cumulative chart points: hourly for the
// first 48h after the send, daily after that.
export type SeriesPoint = { label: string; opened: number; clicked: number };

export function bucketEventSeries(
  series: EventSeriesBucket[],
  sentAt: string,
): SeriesPoint[] {
  if (series.length === 0) return [];
  const sent = new Date(sentAt).getTime();
  const HOUR = 3600 * 1000;
  const last = new Date(series[series.length - 1].bucket_start).getTime();
  const horizon = Math.max(last, sent + 48 * HOUR);

  // Build bucket edges: 48 hourly steps, then daily until the last event.
  const edges: number[] = [];
  for (let t = sent; t <= sent + 48 * HOUR; t += HOUR) edges.push(t);
  for (let t = sent + 72 * HOUR; t <= horizon + 24 * HOUR; t += 24 * HOUR) edges.push(t);

  let opened = 0;
  let clicked = 0;
  let index = 0;
  const sorted = [...series].sort((a, b) =>
    a.bucket_start.localeCompare(b.bucket_start),
  );
  const points: SeriesPoint[] = [];
  for (const edge of edges) {
    while (index < sorted.length && new Date(sorted[index].bucket_start).getTime() < edge) {
      opened += sorted[index].opened;
      clicked += sorted[index].clicked;
      index++;
    }
    const hours = Math.round((edge - sent) / HOUR);
    points.push({
      label: hours <= 48 ? `${hours}h` : `${Math.round(hours / 24)}d`,
      opened,
      clicked,
    });
  }
  // Trim the flat tail: keep up to two points past the last activity.
  let lastActive = points.length - 1;
  while (lastActive > 0 && points[lastActive - 1].opened === points[lastActive].opened && points[lastActive - 1].clicked === points[lastActive].clicked) {
    lastActive--;
  }
  return points.slice(0, Math.min(points.length, lastActive + 2));
}

// Signups vs unsubscribes per calendar bucket, for the growth chart.
export type GrowthBucket = {
  bucket_start: string;
  signups: number;
  unsubscribes: number;
};

export async function getSubscriberGrowth(
  bucket: "week" | "month" = "month",
): Promise<GrowthBucket[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("newsletter_subscriber_growth", { bucket });
  if (error) {
    console.warn("[newsletter] growth rpc failed:", error.message);
    return [];
  }
  return ((data ?? []) as GrowthBucket[]).map((r) => ({
    bucket_start: r.bucket_start,
    signups: Number(r.signups),
    unsubscribes: Number(r.unsubscribes),
  }));
}

// Estimated per-issue unsubscribes: a status change within windowDays after
// the send. Resend does not attribute unsubscribes to campaigns; this is a
// time-window inference and is labeled as such in the UI.
export async function getUnsubCountsAfterSends(
  issues: { id: string; sent_at: string | null }[],
  windowDays = 7,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const supabase = getSupabaseAdmin();
  if (!supabase) return map;

  await Promise.all(
    issues
      .filter((i) => i.sent_at)
      .map(async (issue) => {
        const from = new Date(issue.sent_at!);
        const to = new Date(from.getTime() + windowDays * 24 * 3600 * 1000);
        const { count } = await supabase
          .from("newsletter_subscribers")
          .select("id", { count: "exact", head: true })
          .eq("status", "unsubscribed")
          .gte("unsubscribed_at", from.toISOString())
          .lt("unsubscribed_at", to.toISOString());
        map.set(issue.id, count ?? 0);
      }),
  );
  return map;
}

// Raw event rows for an issue's broadcasts (recipient lists). Bounded by
// unique recipients per event type, so a few thousand rows today.
export type RecipientEvent = {
  recipient: string;
  event_type: string;
  link_url: string;
  occurred_at: string | null;
};

export async function getIssueRecipientEvents(
  broadcastIds: string[],
): Promise<RecipientEvent[]> {
  const supabase = getSupabaseAdmin();
  const ids = broadcastIds.filter(Boolean);
  if (!supabase || ids.length === 0) return [];
  const { data, error } = await supabase
    .from("newsletter_email_events")
    .select("recipient, event_type, link_url, occurred_at")
    .in("broadcast_id", ids)
    .order("occurred_at", { ascending: true })
    .limit(10000);
  if (error) {
    console.warn("[newsletter] recipient events failed:", error.message);
    return [];
  }
  return (data ?? []) as RecipientEvent[];
}

// Collapse per-broadcast rows into one row per person: someone who received
// both the send and a re-send appears once here.
export type RecipientSummary = {
  email: string;
  delivered: boolean;
  opened: boolean;
  bounced: boolean;
  complained: boolean;
  clickedLinks: string[];
  firstOpenAt: string | null;
  lastActivityAt: string | null;
};

export function summarizeRecipients(events: RecipientEvent[]): RecipientSummary[] {
  const byEmail = new Map<string, RecipientSummary>();
  for (const event of events) {
    const summary =
      byEmail.get(event.recipient) ??
      ({
        email: event.recipient,
        delivered: false,
        opened: false,
        bounced: false,
        complained: false,
        clickedLinks: [],
        firstOpenAt: null,
        lastActivityAt: null,
      } as RecipientSummary);
    if (event.event_type === "delivered") summary.delivered = true;
    if (event.event_type === "bounced") summary.bounced = true;
    if (event.event_type === "complained") summary.complained = true;
    if (event.event_type === "opened") {
      summary.opened = true;
      if (!summary.firstOpenAt || (event.occurred_at ?? "") < summary.firstOpenAt) {
        summary.firstOpenAt = event.occurred_at;
      }
    }
    if (
      event.event_type === "clicked" &&
      event.link_url &&
      !isUnsubscribeLink(event.link_url)
    ) {
      if (!summary.clickedLinks.includes(event.link_url)) {
        summary.clickedLinks.push(event.link_url);
      }
    }
    if (
      event.occurred_at &&
      (!summary.lastActivityAt || event.occurred_at > summary.lastActivityAt)
    ) {
      summary.lastActivityAt = event.occurred_at;
    }
    byEmail.set(event.recipient, summary);
  }
  return [...byEmail.values()];
}

// Every event for one email address across all broadcasts (subscriber
// engagement history; uses the recipient index from migration 0010).
export type SubscriberEvent = {
  broadcast_id: string;
  event_type: string;
  link_url: string;
  occurred_at: string | null;
};

export async function getSubscriberEvents(email: string): Promise<SubscriberEvent[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("newsletter_email_events")
    .select("broadcast_id, event_type, link_url, occurred_at")
    .eq("recipient", email.toLowerCase())
    .order("occurred_at", { ascending: true })
    .limit(2000);
  if (error) {
    console.warn("[newsletter] subscriber events failed:", error.message);
    return [];
  }
  return (data ?? []) as SubscriberEvent[];
}

// Sum counts across an issue's broadcasts (primary send + re-sends). Ids
// missing from the map contribute nothing.
export function sumBroadcastCounts(
  map: Map<string, BroadcastCounts>,
  broadcastIds: string[],
): BroadcastCounts {
  const total = { ...EMPTY };
  for (const id of broadcastIds) {
    const counts = map.get(id);
    if (!counts) continue;
    for (const key of Object.keys(total) as (keyof BroadcastCounts)[]) {
      total[key] += counts[key];
    }
  }
  return total;
}

// Full stats for one issue across all its broadcasts (primary + re-sends),
// including the per-link click breakdown. Counts are unique people per
// broadcast; someone who received both a send and a re-send can count twice.
export async function getIssueStats(broadcastIds: string[]): Promise<IssueStats> {
  const supabase = getSupabaseAdmin();
  const ids = broadcastIds.filter(Boolean);
  if (!supabase || ids.length === 0) return { ...EMPTY, links: [] };

  const [countsMap, ...linkResults] = await Promise.all([
    getBroadcastCounts(ids),
    ...ids.map((bid) => supabase.rpc("newsletter_link_stats", { bid })),
  ]);

  const linkClicks = new Map<string, number>();
  for (const res of linkResults) {
    for (const l of (res.data ?? []) as { link_url: string; clicks: number }[]) {
      linkClicks.set(l.link_url, (linkClicks.get(l.link_url) ?? 0) + Number(l.clicks));
    }
  }

  return {
    ...sumBroadcastCounts(countsMap, ids),
    links: [...linkClicks.entries()]
      .map(([link_url, clicks]) => ({ link_url, clicks }))
      .sort((a, b) => b.clicks - a.clicks),
  };
}
