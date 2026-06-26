// src/app/admin/(dashboard)/conversations/page.tsx
// Conversation log as a table. Rows are minimal (when, summary, intent, usage,
// cost) and link to the full conversation. Defaults to active (non-archived);
// ?view=archived shows the archive.
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/service";
import {
  ConversationsTable,
  type ConversationRow,
} from "@/components/admin/ConversationsTable";
import { estimateCost, formatCost, formatTokens } from "@/lib/assistant/pricing";

export const metadata = { title: "Conversations - Admin" };
export const dynamic = "force-dynamic";

type DbRow = {
  id: string;
  created_at: string;
  question: string;
  summary: string | null;
  intent: string | null;
  worth_followup: boolean;
  input_tokens: number | null;
  output_tokens: number | null;
  model: string | null;
  archived: boolean;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const archived = view === "archived";

  const supabase = getSupabaseAdmin();
  let rows: ConversationRow[] = [];
  let loadError: string | null = null;

  if (!supabase) {
    loadError = "Supabase is not configured.";
  } else {
    const { data, error } = await supabase
      .from("assistant_conversations")
      .select(
        "id, created_at, question, summary, intent, worth_followup, input_tokens, output_tokens, model, archived",
      )
      .eq("archived", archived)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) loadError = error.message;

    rows = ((data as DbRow[]) ?? []).map((r) => ({
      id: r.id,
      dateTime: fmtDate(r.created_at),
      summary: r.summary || r.question,
      intent: r.intent,
      worthFollowup: r.worth_followup,
      tokens: formatTokens(r.input_tokens, r.output_tokens),
      cost: formatCost(estimateCost(r.model, r.input_tokens, r.output_tokens)),
      archived: r.archived,
    }));
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl">
            Conversations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {archived
              ? "Archived conversations."
              : "What visitors asked the assistant. Click a row for the full exchange."}
          </p>
        </div>
        <Link
          href={archived ? "/admin/conversations" : "/admin/conversations?view=archived"}
          className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {archived ? "Back to active" : "View archived"}
        </Link>
      </div>

      {loadError ? (
        <p className="rounded-none border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      {rows.length === 0 && !loadError ? (
        <p className="text-sm text-muted-foreground">
          {archived ? "Nothing archived." : "No conversations yet."}
        </p>
      ) : (
        <ConversationsTable rows={rows} />
      )}
    </div>
  );
}
