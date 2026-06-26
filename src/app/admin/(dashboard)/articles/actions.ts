"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { serviceClient } from "@/lib/supabase/service";
import { announceArticle } from "@/lib/social/announce";
import type { ActionResult } from "@/lib/admin/action-result";
import type { RunDraft } from "@/lib/admin/types";
import { publishArticle } from "@/lib/storyblok-management";

function errorResult(err: unknown): ActionResult {
  return { ok: false, message: err instanceof Error ? err.message : String(err) };
}

export async function runArticlesNow(): Promise<ActionResult> {
  await requireAdmin();
  try {
    // A full run takes ~10-20 minutes (multi-turn research + editor + revisions),
    // which no Vercel function can complete. The pipeline runs on GitHub Actions
    // instead; this just triggers that workflow and returns. The result shows up
    // on the dashboard once the run logs to pipeline_runs.
    const token = process.env.GITHUB_DISPATCH_TOKEN;
    if (!token) return { ok: false, message: "GITHUB_DISPATCH_TOKEN is not configured." };
    const repo = process.env.GITHUB_REPO;
    if (!repo) return { ok: false, message: "GITHUB_REPO is not configured." };
    const res = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/articles.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "content-admin",
        },
        body: JSON.stringify({ ref: "main" }),
      }
    );
    if (!res.ok) {
      return {
        ok: false,
        message: `Could not start workflow (${res.status}): ${(await res.text()).slice(0, 200)}`,
      };
    }
    return {
      ok: true,
      message:
        "Article pipeline triggered on GitHub Actions. The result appears here when the run finishes (a few minutes).",
    };
  } catch (err) {
    return errorResult(err);
  }
}

// Recover a run that produced a draft but failed before/at the Storyblok publish
// step (e.g. a 401 from a stale management token): push the saved draft to
// Storyblok as an unpublished draft (publish=false) or live (publish=true), then
// reflect the recovery on the run. Requires STORYBLOK_MANAGEMENT_TOKEN in the
// web app's environment (same token the pipeline uses).
export async function publishRunDraft(runId: string, publish: boolean): Promise<ActionResult> {
  await requireAdmin();
  try {
    const db = serviceClient();
    if (!db) return { ok: false, message: "Supabase not configured" };
    const { data: run, error } = await db
      .from("pipeline_runs")
      .select("id, draft, article_id")
      .eq("id", runId)
      .single();
    if (error || !run) return { ok: false, message: error?.message ?? "Run not found" };
    if (run.article_id) {
      return { ok: false, message: "This run already has a Storyblok story." };
    }
    const draft = run.draft as RunDraft | null;
    if (!draft?.title || !draft?.body) {
      return { ok: false, message: "No saved draft on this run to publish." };
    }

    const article = await publishArticle(draft, { publish });

    await db
      .from("pipeline_runs")
      .update({
        status: "success",
        outcome: publish ? "published" : "draft",
        article_id: article.id,
        article_slug: article.full_slug,
        article_title: article.title,
        notes: `${publish ? "Published" : "Saved as draft"} from admin recovery`,
      })
      .eq("id", runId);

    revalidatePath("/admin");
    revalidatePath("/articles");
    return {
      ok: true,
      message: publish
        ? `Published live: ${article.full_slug}`
        : `Saved to Storyblok as draft: ${article.full_slug}`,
    };
  } catch (err) {
    return errorResult(err);
  }
}

export async function shareArticle(article: {
  slug: string;
  title: string;
  excerpt: string;
  tags?: string[];
}): Promise<ActionResult> {
  await requireAdmin();
  try {
    const result = await announceArticle(article, { trigger: "manual", requireAuto: false });
    revalidatePath("/admin/linkedin");
    revalidatePath("/admin/twitter");
    revalidatePath("/admin/instagram");
    const part = (label: string, r: { status: string; reason?: string; postUrl?: string }) =>
      `${label} ${r.status}${r.reason ? ` (${r.reason})` : ""}`;
    return {
      ok: result.linkedin.ok || result.twitter.ok || result.instagram.ok,
      message: `${part("LinkedIn:", result.linkedin)} · ${part("X:", result.twitter)} · ${part("IG:", result.instagram)}`,
    };
  } catch (err) {
    return errorResult(err);
  }
}
