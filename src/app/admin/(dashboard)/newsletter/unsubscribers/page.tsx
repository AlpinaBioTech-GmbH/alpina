// Every unsubscribed contact with dates, plus a per-campaign attribution
// ESTIMATE (unsubscribed within 7 days of a send). Resend does not report
// which campaign triggered an unsubscribe.
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/service";
import { listIssues, issueBroadcastIds, type NewsletterIssue } from "@/lib/newsletter/issue";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Unsubscribers - Admin" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const WINDOW_MS = 7 * 24 * 3600 * 1000;

type Row = {
  id: string;
  email: string;
  unsubscribed_at: string | null;
  created_at: string;
  source_page: string | null;
};

function fmt(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

// Most recent tracked issue whose 7-day window contains the unsubscribe.
function attribute(unsubscribedAt: string | null, issues: NewsletterIssue[]): NewsletterIssue | null {
  if (!unsubscribedAt) return null;
  const t = new Date(unsubscribedAt).getTime();
  for (const issue of issues) {
    const sent = issue.sent_at ? new Date(issue.sent_at).getTime() : null;
    if (sent !== null && t >= sent && t < sent + WINDOW_MS) return issue;
  }
  return null;
}

export default async function UnsubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const supabase = getSupabaseAdmin();

  let rows: Row[] = [];
  let total = 0;
  if (supabase) {
    const from = (page - 1) * PAGE_SIZE;
    const { data, count } = await supabase
      .from("newsletter_subscribers")
      .select("id, email, unsubscribed_at, created_at, source_page", { count: "exact" })
      .eq("status", "unsubscribed")
      .order("unsubscribed_at", { ascending: false, nullsFirst: false })
      .range(from, from + PAGE_SIZE - 1);
    rows = (data as Row[]) ?? [];
    total = count ?? 0;
  }

  const issues = (await listIssues({ sentOnly: true, limit: 200 })).filter(
    (i) => i.sent_at && issueBroadcastIds(i).length > 0,
  );
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/admin/newsletter" className="hover:underline">
            Newsletter
          </Link>{" "}
          / Unsubscribers
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl">Unsubscribers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total} unsubscribed. The campaign column is an estimate: the most
          recent send within 7 days before the unsubscribe.
        </p>
      </div>

      <div className="overflow-x-auto rounded-none border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Unsubscribed</th>
              <th className="px-3 py-2 font-medium">Signed up</th>
              <th className="px-3 py-2 font-medium">Signup page</th>
              <th className="px-3 py-2 font-medium">After campaign (est.)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  Nobody has unsubscribed.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const issue = attribute(row.unsubscribed_at, issues);
                return (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{row.email}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmt(row.unsubscribed_at)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmt(row.created_at)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.source_page ?? "-"}</td>
                    <td className="px-3 py-2">
                      {issue ? (
                        <Link href={`/admin/newsletter/${issue.id}`} className="hover:underline">
                          {issue.title}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/newsletter/unsubscribers?page=${page - 1}`}>Previous</Link>
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
              <Link href={`/admin/newsletter/unsubscribers?page=${page + 1}`}>Next</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
