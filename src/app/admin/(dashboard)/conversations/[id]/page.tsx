// src/app/admin/(dashboard)/conversations/[id]/page.tsx
// Full view of a single logged conversation.
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/service";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/Markdown";
import { estimateCost, formatCost, formatTokens } from "@/lib/assistant/pricing";

export const metadata = { title: "Conversation - Admin" };
export const dynamic = "force-dynamic";

type Source = { title: string; url: string | null };
type Row = {
  id: string;
  created_at: string;
  archived: boolean;
  question: string;
  answer: string;
  sources: Source[];
  summary: string | null;
  intent: string | null;
  worth_followup: boolean;
  input_tokens: number | null;
  output_tokens: number | null;
  model: string | null;
  ip_hash: string | null;
  visitor_id: string | null;
  country: string | null;
  city: string | null;
  page_path: string | null;
  context: Record<string, unknown> | null;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
  });
}

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) notFound();

  const { data } = await supabase
    .from("assistant_conversations")
    .select(
      "id, created_at, archived, question, answer, sources, summary, intent, worth_followup, input_tokens, output_tokens, model, ip_hash, visitor_id, country, city, page_path, context",
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const row = data as Row;
  const cost = formatCost(
    estimateCost(row.model, row.input_tokens, row.output_tokens),
  );

  // Pull the full visitor record for the complete set of captured details.
  let visitor: Record<string, unknown> | null = null;
  if (row.visitor_id) {
    const { data: v } = await supabase
      .from("assistant_visitors")
      .select("*")
      .eq("visitor_id", row.visitor_id)
      .maybeSingle();
    visitor = (v as Record<string, unknown> | null) ?? null;
  }

  return (
    <div className="grid max-w-3xl gap-6">
      <div>
        <Link
          href="/admin/conversations"
          className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          &larr; Back to conversations
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {row.intent ? <Badge variant="outline">{row.intent}</Badge> : null}
          {row.worth_followup ? <Badge>Follow up</Badge> : null}
          {row.archived ? <Badge variant="secondary">Archived</Badge> : null}
          {row.model ? <Badge variant="outline">{row.model}</Badge> : null}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{fmtDate(row.created_at)}</p>
      </div>

      {row.summary ? (
        <p className="rounded-none border bg-muted/40 px-4 py-3 text-sm">
          {row.summary}
        </p>
      ) : null}

      <div className="grid gap-2">
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground">
          Question
        </h2>
        <p className="whitespace-pre-wrap rounded-none border px-4 py-3 text-sm">
          {row.question}
        </p>
      </div>

      <div className="grid gap-2">
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground">
          Answer
        </h2>
        <Markdown
          text={row.answer}
          sources={row.sources}
          className="rounded-none border px-4 py-3 text-sm"
        />
      </div>

      {row.sources?.length ? (
        <div className="grid gap-2">
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground">
            Sources
          </h2>
          <div className="flex flex-wrap gap-2">
            {row.sources.map((s, i) =>
              s.url ? (
                <a
                  key={i}
                  href={s.url}
                  className="rounded-none border px-2 py-1 text-xs underline-offset-2 hover:underline"
                >
                  {s.title}
                </a>
              ) : (
                <span key={i} className="rounded-none border px-2 py-1 text-xs">
                  {s.title}
                </span>
              ),
            )}
          </div>
        </div>
      ) : null}

      <div className="grid gap-2">
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground">
          Visitor
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 rounded-none border px-4 py-3 text-sm">
          {(() => {
            const v = visitor ?? {};
            const ctx = (row.context ?? {}) as Record<string, unknown>;
            const str = (x: unknown) => (typeof x === "string" && x ? x : null);
            const numS = (x: unknown) =>
              typeof x === "number" ? String(x) : str(x);
            const date = (x: unknown) =>
              typeof x === "string" && x ? fmtDate(x) : null;
            const join = (parts: unknown[], sep = " ") =>
              parts.map(str).filter(Boolean).join(sep) || null;
            const utm = (v.utm ?? ctx.utm) as Record<string, string> | undefined;

            const items: [string, string | null][] = [
              ["This chat's page", str(row.page_path)],
              ["Location", join([v.city ?? row.city, v.region, v.country ?? row.country], ", ")],
              ["Coordinates", join([v.latitude, v.longitude], ", ")],
              ["Geo timezone", str(v.geo_timezone)],
              ["Browser", join([v.browser, v.browser_version])],
              ["OS", join([v.os, v.os_version])],
              ["Device", join([v.device_type ?? ctx.device_type, v.device_vendor, v.device_model], " / ")],
              ["Screen / viewport", join([v.screen ?? ctx.screen, v.viewport ?? ctx.viewport], " / ")],
              ["Pixel ratio", numS(v.device_pixel_ratio ?? ctx.device_pixel_ratio)],
              ["Client timezone", str(v.client_timezone ?? ctx.timezone)],
              ["Languages", str(v.languages ?? ctx.languages)],
              ["Accept-Language", str(v.accept_language)],
              ["Landing page", str(v.landing_page)],
              ["Referrer", str(v.referrer ?? ctx.referrer)],
              [
                "Campaign (UTM)",
                utm && Object.keys(utm).length
                  ? Object.entries(utm).map(([k, val]) => `${k}=${val}`).join(", ")
                  : null,
              ],
              ["First seen", date(v.first_seen)],
              ["Last seen", date(v.last_seen)],
              ["Total chats", numS(v.conversation_count)],
              ["Visitor id", row.visitor_id ? `${row.visitor_id.slice(0, 8)}...` : null],
              ["IP (hashed)", row.ip_hash ? `${row.ip_hash.slice(0, 12)}...` : null],
            ];

            return items
              .filter(([, val]) => val)
              .map(([k, val]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="break-all">{val}</dd>
                </div>
              ));
          })()}
        </dl>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 border-t pt-4 text-xs text-muted-foreground">
        <span>Usage: {formatTokens(row.input_tokens, row.output_tokens)}</span>
        <span>Cost: {cost}</span>
      </div>
    </div>
  );
}
