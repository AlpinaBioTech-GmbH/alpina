// src/app/admin/(dashboard)/visitors/page.tsx
// Read-only view of people who used the public "Talk to AI" chat. Details are
// captured server-side (geo, device, locale) and correlated via a first-party
// cookie. IPs are stored hashed only.
import { getSupabaseAdmin } from "@/lib/supabase/service";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Visitors - Admin" };
export const dynamic = "force-dynamic";

type Row = {
  visitor_id: string;
  first_seen: string;
  last_seen: string;
  country: string | null;
  region: string | null;
  city: string | null;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  languages: string | null;
  client_timezone: string | null;
  landing_page: string | null;
  referrer: string | null;
  conversation_count: number;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function location(r: Row) {
  return [r.city, r.region, r.country].filter(Boolean).join(", ") || "Unknown";
}

export default async function VisitorsPage() {
  const supabase = getSupabaseAdmin();
  let rows: Row[] = [];
  let loadError: string | null = null;

  if (!supabase) {
    loadError = "Supabase is not configured.";
  } else {
    const { data, error } = await supabase
      .from("assistant_visitors")
      .select(
        "visitor_id, first_seen, last_seen, country, region, city, browser, os, device_type, languages, client_timezone, landing_page, referrer, conversation_count",
      )
      .order("last_seen", { ascending: false })
      .limit(200);
    if (error) loadError = error.message;
    rows = (data as Row[]) ?? [];
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl">
          Visitors
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          People who used the assistant. Geo and device are best-effort; IPs are
          stored hashed only.
        </p>
      </div>

      {loadError ? (
        <p className="rounded-none border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      {rows.length === 0 && !loadError ? (
        <p className="text-sm text-muted-foreground">No visitors yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-none border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Last seen</th>
                <th className="px-3 py-2 font-medium">Location</th>
                <th className="px-3 py-2 font-medium">Device</th>
                <th className="px-3 py-2 font-medium">Locale</th>
                <th className="px-3 py-2 font-medium">Entry</th>
                <th className="px-3 py-2 font-medium">Chats</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.visitor_id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {fmt(r.last_seen)}
                    <span className="block text-xs">since {fmt(r.first_seen)}</span>
                  </td>
                  <td className="px-3 py-2">{location(r)}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {[r.browser, r.os].filter(Boolean).join(" / ") || "Unknown"}
                    {r.device_type ? (
                      <Badge variant="outline" className="ml-2">
                        {r.device_type}
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.languages ?? "-"}
                    {r.client_timezone ? (
                      <span className="block text-xs">{r.client_timezone}</span>
                    ) : null}
                  </td>
                  <td className="max-w-xs px-3 py-2 text-muted-foreground">
                    <span className="block truncate">{r.landing_page ?? "-"}</span>
                    {r.referrer ? (
                      <span className="block truncate text-xs">from {r.referrer}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.conversation_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
