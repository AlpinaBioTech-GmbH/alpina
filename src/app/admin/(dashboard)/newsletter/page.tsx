// Newsletter performance overview: subscriber totals + growth chart and a
// campaigns table with one row per issue, linking to per-issue drill-downs.
// All numbers come from our webhook event store: Resend's API exposes no
// aggregate analytics. Sends are unattended (first Tuesday monthly); failed
// issues surface here with a Retry button.
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/service";
import { listIssues, issueBroadcastIds } from "@/lib/newsletter/issue";
import {
  getBroadcastCounts,
  getSubscriberGrowth,
  getUnsubCountsAfterSends,
  sumBroadcastCounts,
} from "@/lib/newsletter/stats";
import { retryFailedIssue } from "./actions";
import { ActionButton } from "@/components/admin/ActionButton";
import { DualBarChart } from "@/components/admin/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Newsletter - Admin" };
export const dynamic = "force-dynamic";

function pct(part: number, whole: number): string {
  if (!whole) return "";
  return `${Math.round((part / whole) * 1000) / 10}%`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-GB", { dateStyle: "medium" });
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-none border p-3">
      <p className="font-[family-name:var(--font-mono)] text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-[family-name:var(--font-heading)]">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  sent: "secondary",
  failed: "destructive",
  skipped: "outline",
  sending: "outline",
};

export default async function NewsletterAdminPage() {
  const supabase = getSupabaseAdmin();
  const issues = await listIssues({ limit: 200 });
  const sent = issues.filter((i) => i.status === "sent" && i.sent_at);
  const other = issues.filter((i) => i.status !== "sent");

  const [counts, growth, unsubs, subscribedQ, unsubscribedQ] = await Promise.all([
    getBroadcastCounts(sent.flatMap(issueBroadcastIds)),
    getSubscriberGrowth("month"),
    getUnsubCountsAfterSends(sent),
    supabase
      ?.from("newsletter_subscribers")
      .select("id", { count: "exact", head: true })
      .eq("status", "subscribed") ?? Promise.resolve({ count: null }),
    supabase
      ?.from("newsletter_subscribers")
      .select("id", { count: "exact", head: true })
      .eq("status", "unsubscribed") ?? Promise.resolve({ count: null }),
  ]);

  const totals = sumBroadcastCounts(counts, sent.flatMap(issueBroadcastIds));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl">Newsletter</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monthly article digest, sent unattended on the first Tuesday. Numbers
            come from Resend delivery events; opens undercount readers whose mail
            clients block tracking pixels.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/newsletter/unsubscribers">Unsubscribers</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/newsletter" target="_blank">
              Public archive
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Subscribed now" value={String(subscribedQ.count ?? "?")} />
        <StatTile
          label="Delivered (all sends)"
          value={String(totals.delivered)}
          sub={`${sent.length} send${sent.length === 1 ? "" : "s"}`}
        />
        <StatTile
          label="Open rate"
          value={totals.delivered ? pct(totals.opened, totals.delivered) : "-"}
          sub={`${totals.opened} unique opens`}
        />
        <StatTile
          label="Click rate"
          value={totals.delivered ? pct(totals.clicked, totals.delivered) : "-"}
          sub={`${totals.clicked} unique clickers`}
        />
        <StatTile label="Unsubscribed (all time)" value={String(unsubscribedQ.count ?? "?")} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscriber growth</CardTitle>
          <CardDescription>Signups and unsubscribes per month.</CardDescription>
        </CardHeader>
        <CardContent>
          {growth.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subscriber data yet.</p>
          ) : (
            <DualBarChart
              points={growth.map((g) => ({
                label: monthLabel(g.bucket_start),
                a: g.signups,
                b: g.unsubscribes,
              }))}
              aLabel="Signups"
              bLabel="Unsubscribes"
              ariaLabel="Signups and unsubscribes per month"
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
          <CardDescription>
            One row per sent issue. Unsubs are estimated: unsubscribed within 7
            days of the send (Resend does not attribute unsubscribes to
            campaigns).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-none border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Issue</th>
                  <th className="px-3 py-2 font-medium">Sent</th>
                  <th className="px-3 py-2 text-right font-medium">Articles</th>
                  <th className="px-3 py-2 text-right font-medium">Recipients</th>
                  <th className="px-3 py-2 text-right font-medium">Delivered</th>
                  <th className="px-3 py-2 text-right font-medium">Opened</th>
                  <th className="px-3 py-2 text-right font-medium">Clicked</th>
                  <th className="px-3 py-2 text-right font-medium">Bounced</th>
                  <th className="px-3 py-2 text-right font-medium">Unsubs (est.)</th>
                </tr>
              </thead>
              <tbody>
                {sent.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                      No sends yet. The first digest goes out on the first Tuesday
                      after a month with published articles.
                    </td>
                  </tr>
                ) : (
                  sent.map((issue) => {
                    const c = sumBroadcastCounts(counts, issueBroadcastIds(issue));
                    const recipients = issue.audience_size_at_send ?? 0;
                    return (
                      <tr key={issue.id} className="border-t">
                        <td className="px-3 py-2">
                          <Link
                            href={`/admin/newsletter/${issue.id}`}
                            className="font-medium hover:underline"
                          >
                            {issue.title}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{fmtDate(issue.sent_at)}</td>
                        <td className="px-3 py-2 text-right">{issue.article_count ?? "-"}</td>
                        <td className="px-3 py-2 text-right">{recipients || "-"}</td>
                        <td className="px-3 py-2 text-right">
                          {c.delivered}
                          <span className="ml-1 text-xs text-muted-foreground">
                            {recipients ? pct(c.delivered, recipients) : ""}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {c.opened}
                          <span className="ml-1 text-xs text-muted-foreground">
                            {c.delivered ? pct(c.opened, c.delivered) : ""}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {c.clicked}
                          <span className="ml-1 text-xs text-muted-foreground">
                            {c.delivered ? pct(c.clicked, c.delivered) : ""}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">{c.bounced}</td>
                        <td className="px-3 py-2 text-right">{unsubs.get(issue.id) ?? 0}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {other.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Skipped and failed runs</CardTitle>
            <CardDescription>
              Skipped months had no published articles. Failed issues can be
              retried; the retry reuses the existing broadcast when one was
              already created.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm">
              {other.map((issue) => (
                <li key={issue.id} className="flex flex-wrap items-center gap-3">
                  <Badge variant={STATUS_BADGE[issue.status] ?? "outline"}>{issue.status}</Badge>
                  <span>{issue.title}</span>
                  {issue.last_error ? (
                    <span className="text-xs text-destructive">{issue.last_error}</span>
                  ) : null}
                  {issue.notes ? (
                    <span className="text-xs text-muted-foreground">{issue.notes}</span>
                  ) : null}
                  {issue.status === "failed" ? (
                    <ActionButton
                      action={retryFailedIssue.bind(null, issue.id)}
                      pendingLabel="Retrying..."
                      variant="outline"
                      size="sm"
                    >
                      Retry send
                    </ActionButton>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
