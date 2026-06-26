// Pipeline run logging. startRun/finishRun must never throw into the caller:
// a broken audit log must not break article publishing or social posting.
import { serviceClient } from "@/lib/supabase/service";
import type { DraftArticle } from "@/lib/anthropic/writer";

export type RunKind = "articles" | "newsletter" | "linkedin" | "twitter" | "instagram";
export type RunTrigger = "cron" | "manual";

export interface RunAttempt {
  attempt: number;
  score?: number;
  approved: boolean;
  notes: string;
}

export interface FinishRunFields {
  status?: "success" | "error";
  outcome?: string;
  leads_count?: number;
  article_id?: string;
  article_slug?: string;
  article_title?: string;
  editor_score?: number;
  approved?: boolean;
  revision_count?: number;
  attempts?: RunAttempt[];
  notes?: string;
  // The generated draft, kept so a failed publish (e.g. Storyblok 401) can be
  // recovered from /admin instead of regenerating. Omitted => column unchanged.
  draft?: DraftArticle | null;
}

export async function startRun(kind: RunKind, trigger: RunTrigger): Promise<string | null> {
  try {
    const db = serviceClient();
    if (!db) return null;
    const { data, error } = await db
      .from("pipeline_runs")
      .insert({ kind, trigger, status: "running" })
      .select("id")
      .single();
    if (error) {
      console.error(`[runs] startRun(${kind}) failed:`, error.message);
      return null;
    }
    return data.id as string;
  } catch (err) {
    console.error(`[runs] startRun(${kind}) threw:`, err);
    return null;
  }
}

export async function finishRun(runId: string | null, fields: FinishRunFields): Promise<void> {
  if (!runId) return;
  try {
    const db = serviceClient();
    if (!db) return;
    const { error } = await db
      .from("pipeline_runs")
      .update({
        status: fields.status ?? "success",
        outcome: fields.outcome,
        leads_count: fields.leads_count,
        article_id: fields.article_id,
        article_slug: fields.article_slug,
        article_title: fields.article_title,
        editor_score: fields.editor_score,
        approved: fields.approved,
        revision_count: fields.revision_count,
        attempts: fields.attempts ?? [],
        notes: fields.notes,
        draft: fields.draft,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
    if (error) console.error("[runs] finishRun failed:", error.message);
  } catch (err) {
    console.error("[runs] finishRun threw:", err);
  }
}

/**
 * Called when an admin retry of a failed post succeeds: flips the most recent
 * failed run of that kind to posted so the dashboard reflects the recovery
 * (single-operator heuristic; the appended note keeps the history honest).
 */
export async function markLatestFailedRunRecovered(kind: RunKind, note: string): Promise<void> {
  try {
    const db = serviceClient();
    if (!db) return;
    const { data: run } = await db
      .from("pipeline_runs")
      .select("id, notes")
      .eq("kind", kind)
      .eq("outcome", "failed")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!run) return;
    await db
      .from("pipeline_runs")
      .update({
        status: "success",
        outcome: "posted",
        notes: `${run.notes ?? ""}${run.notes ? " · " : ""}${note}`,
      })
      .eq("id", run.id);
  } catch (err) {
    console.error("[runs] markLatestFailedRunRecovered failed:", err);
  }
}

export async function recentRuns(kind: RunKind, limit = 20) {
  try {
    const db = serviceClient();
    if (!db) return [];
    const { data } = await db
      .from("pipeline_runs")
      .select("*")
      .eq("kind", kind)
      .order("started_at", { ascending: false })
      .limit(limit);
    return data ?? [];
  } catch {
    return [];
  }
}
