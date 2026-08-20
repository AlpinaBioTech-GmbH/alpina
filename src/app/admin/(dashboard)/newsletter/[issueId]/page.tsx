// Per-campaign drill-down: stat tiles, cumulative activity chart, link
// clicks, and recipient-level lists (who opened / clicked / bounced / ...).
// Aggregates come from the webhook event store, keyed by the issue's
// broadcast.
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/service";
import { getIssueById, issueBroadcastIds } from "@/lib/newsletter/issue";
import {
  bucketEventSeries,
  getEventSeries,
  getIssueRecipientEvents,
  getIssueStats,
  getUnsubCountsAfterSends,
  summarizeRecipients,
  type RecipientSummary,
} from "@/lib/newsletter/stats";
import { StepLineChart } from "@/components/admin/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Campaign performance - Admin" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const VIEWS = ["opened", "clicked", "bounced", "complained", "unopened", "all"] as const;
type View = (typeof VIEWS)[number];

const VIEW_LABEL: Record<View, string> = {
  opened: "Opened",
  clicked: "Clicked",
  bounced: "Bounced",
  complained: "Complained",
  unopened: "Did not open",
  all: "All recipients",
};

function pct(part: number, whole: number): string {
  if (!whole) return "";
  return `${Math.round((part / whole) * 1000) / 10}%`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-GB", { dateStyle: "medium" });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
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

function inView(r: RecipientSummary, view: View): boolean {
  switch (view) {
    case "opened":
      return r.opened;
    case "clicked":
      return r.clickedLinks.length > 0;
    case "bounced":
      return r.bounced;
    case "complained":
      return r.complained;
    case "unopened":
      return r.delivered && !r.opened && !r.bounced;
    case "all":
      return true;
  }
}

function viewHref(issueId: string, view: View, page: number): string {
  const qs = new URLSearchParams();
  if (view !== "opened") qs.set("view", view);
  if (page > 1) qs.set("page", String(page));
  const s = qs.toString();
  return `/admin/newsletter/${issueId}${s ? `?${s}` : ""}`;
}

export default async function CampaignPerformancePage({
  params,
  searchParams,
}: {
  params: Promise<{ issueId: string }>;
  searchParams: Promise<{ view?: string; page?: string }>;
}) {
  const { issueId } = await params;
  const sp = await searchParams;
  const view: View = VIEWS.includes(sp.view as View) ? (sp.view as View) : "opened";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const issue = await getIssueById(issueId);
  if (!issue) notFound();

  const ids = issueBroadcastIds(issue);
  const header = (
    <div>
      <p className="text-sm text-muted-foreground">
        <Link href="/admin/newsletter" className="hover:underline">
          Newsletter
        </Link>{" "}
        / {issue.title}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-heading)] text-2xl">{issue.title}</h1>
        <span className="text-sm text-muted-foreground">Sent {fmtDate(issue.sent_at)}</span>
      </div>
    </div>
  );

  if (issue.status !== "sent" || ids.length === 0) {
    return (
      <div className="grid gap-6">
        {header}
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            This issue has not been sent ({issue.status}).
            {issue.last_error ? ` Last error: ${issue.last_error}` : ""}
          </CardContent>
        </Card>
      </div>
    );
  }

  const [stats, series, events, unsubMap] = await Promise.all([
    getIssueStats(ids),
    getEventSeries(ids),
    getIssueRecipientEvents(ids),
    getUnsubCountsAfterSends([issue]),
  ]);

  const recipients = issue.audience_size_at_send ?? 0;
  const summaries = summarizeRecipients(events);
  const filtered = summaries
    .filter((r) => inView(r, view))
    .sort((a, b) => a.email.localeCompare(b.email));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Subscriber status for the visible page only.
  const supabase = getSupabaseAdmin();
  const { data: subs } = supabase
    ? await supabase
        .from("newsletter_subscribers")
        .select("email, status")
        .in(
          "email",
          pageRows.map((r) => r.email),
        )
    : { data: [] };
  const statusByEmail = new Map(
    ((subs ?? []) as { email: string; status: string }[]).map((s) => [s.email, s.status]),
  );

  const chartPoints = bucketEventSeries(series, issue.sent_at!);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        {header}
        <Button asChild variant="outline" size="sm">
          <Link href={`/newsletter/${issue.slug}`} target="_blank">
            View archive page
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Sent to" value={String(recipients || "?")} />
        <StatTile
          label="Delivered"
          value={String(stats.delivered)}
          sub={recipients ? pct(stats.delivered, recipients) : undefined}
        />
        <StatTile
          label="Opened"
          value={String(stats.opened)}
          sub={stats.delivered ? `${pct(stats.opened, stats.delivered)} of delivered` : undefined}
        />
        <StatTile
          label="Clicked"
          value={String(stats.clicked)}
          sub={stats.delivered ? `${pct(stats.clicked, stats.delivered)} of delivered` : undefined}
        />
        <StatTile label="Bounced" value={String(stats.bounced)} />
        <StatTile
          label="Unsubs (est.)"
          value={String(unsubMap.get(issue.id) ?? 0)}
          sub="within 7 days, estimate"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity after send</CardTitle>
          <CardDescription>
            Cumulative unique opens and clicks, hourly for the first 48 hours,
            then daily.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartPoints.length === 0 ? (
            <p className="text-sm text-muted-foreground">No opens or clicks recorded yet.</p>
          ) : (
            <StepLineChart
              series={[
                { name: "Opened", points: chartPoints.map((p) => ({ label: p.label, value: p.opened })) },
                { name: "Clicked", points: chartPoints.map((p) => ({ label: p.label, value: p.clicked })) },
              ]}
              ariaLabel="Cumulative opens and clicks after the send"
            />
          )}
        </CardContent>
      </Card>

      {stats.links.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Link clicks</CardTitle>
            <CardDescription>Unique clickers per link.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-none border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Link</th>
                    <th className="px-3 py-2 text-right font-medium">Unique clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.links.map((link) => (
                    <tr key={link.link_url} className="border-t">
                      <td className="max-w-lg truncate px-3 py-2">
                        <a href={link.link_url} target="_blank" rel="noreferrer" className="hover:underline">
                          {link.link_url}
                        </a>
                      </td>
                      <td className="px-3 py-2 text-right">{link.clicks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recipients</CardTitle>
          <CardDescription>Per-person delivery and engagement.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {VIEWS.map((v) => {
              const count = summaries.filter((r) => inView(r, v)).length;
              return v === view ? (
                <Badge key={v} variant="secondary">
                  {VIEW_LABEL[v]} ({count})
                </Badge>
              ) : (
                <Link
                  key={v}
                  href={viewHref(issue.id, v, 1)}
                  className="text-sm text-muted-foreground hover:underline"
                >
                  {VIEW_LABEL[v]} ({count})
                </Link>
              );
            })}
          </div>

          <div className="overflow-x-auto rounded-none border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Recipient</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">
                    {view === "clicked" ? "Links clicked" : "First open"}
                  </th>
                  <th className="px-3 py-2 font-medium">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                      Nobody in this view.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => (
                    <tr key={r.email} className="border-t">
                      <td className="px-3 py-2">
                        <span className="font-medium">{r.email}</span>
                        {statusByEmail.get(r.email) === "unsubscribed" ? (
                          <Badge variant="outline" className="ml-2">
                            unsubscribed
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.bounced
                          ? "bounced"
                          : r.complained
                            ? "complained"
                            : r.opened
                              ? "opened"
                              : r.delivered
                                ? "delivered"
                                : "-"}
                      </td>
                      <td className="max-w-md px-3 py-2 text-muted-foreground">
                        {view === "clicked" ? (
                          <span className="block truncate" title={r.clickedLinks.join("\n")}>
                            {r.clickedLinks.length}: {r.clickedLinks.join(", ")}
                          </span>
                        ) : r.firstOpenAt ? (
                          fmtDateTime(r.firstOpenAt)
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.lastActivityAt ? fmtDateTime(r.lastActivityAt) : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between">
              {page > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={viewHref(issue.id, view, page - 1)}>Previous</Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
              )}
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              {page < totalPages ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={viewHref(issue.id, view, page + 1)}>Next</Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Next
                </Button>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
