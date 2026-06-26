// Article pipeline: RSS leads → writer (web research) → editor review →
// self-healing revision loop → Storyblok publish → best-effort social
// announce. Every run is logged to pipeline_runs with per-attempt details.
import { fetchLeads } from "@/lib/rss";
import {
  writeArticle,
  writeOpinionArticle,
  reviseArticle,
  type DraftArticle,
} from "@/lib/anthropic/writer";
import { reviewArticle } from "@/lib/anthropic/editor";
import { nextPendingTopic, markTopicWritten } from "@/lib/documents";
import {
  publishArticle,
  recentArticleTitles,
  listCategories,
  type PublishedArticle,
} from "@/lib/storyblok-management";
import { startRun, finishRun, type RunAttempt, type RunTrigger } from "@/lib/runs";
import { announceArticle } from "@/lib/social/announce";
import { resolveCover } from "@/lib/images/cover";
import { content } from "@/lib/config";

// Number("") is 0 and an unset CI var injects "", so guard against
// empty/invalid before falling back to defaults.
const MAX_REVISIONS = Number(process.env.MAX_ARTICLE_REVISIONS?.trim()) || 2;
// Publish floor: after the revision loop, publish even if the editor stopped
// short of full approval (score >= 80) as long as the score clears this floor.
// Only genuinely weak/flagged drafts below it are held as unpublished drafts.
const PUBLISH_FLOOR = Number(process.env.ARTICLE_PUBLISH_FLOOR?.trim()) || 70;

export interface ArticlePipelineResult {
  ok: boolean;
  outcome: "published" | "draft" | "skipped" | "failed";
  article?: PublishedArticle;
  score?: number;
  revisions?: number;
  reason?: string;
}

export async function runArticlePipeline(trigger: RunTrigger): Promise<ArticlePipelineResult> {
  const runId = await startRun("articles", trigger);
  const attempts: RunAttempt[] = [];
  // Hoisted so the catch block can persist whatever draft was produced before
  // the failure (e.g. a Storyblok 401 at publish), enabling admin recovery.
  let draft: DraftArticle | null = null;
  try {
    const leads = await fetchLeads({ sinceHours: 24 * 8, limit: 60 });
    if (leads.length === 0) {
      await finishRun(runId, { outcome: "skipped", leads_count: 0, notes: "no RSS leads" });
      return { ok: false, outcome: "skipped", reason: "no RSS leads" };
    }

    const [avoidTitles, categories, opinionTopic] = await Promise.all([
      recentArticleTitles(30),
      listCategories(),
      nextPendingTopic(),
    ]);
    const categoryNames = categories.map((c) => c.name);
    const sharedOpts = {
      leads,
      avoidTitles,
      categories: categoryNames.length ? categoryNames : ["News"],
    };

    // Pending opinion topics (derived from reference documents in the admin
    // Library) take priority: first-person opinion pieces by the configured
    // opinion author. When the queue is empty, runs fall back to news mode.
    draft = opinionTopic
      ? await writeOpinionArticle({
          ...sharedOpts,
          topic: opinionTopic.topic,
          angle: opinionTopic.angle,
          documentTitle: opinionTopic.documentTitle,
          documentText: opinionTopic.documentText,
          documentSourceUrl: opinionTopic.documentSourceUrl,
        })
      : await writeArticle(sharedOpts);
    let verdict = await reviewArticle(draft);
    attempts.push({
      attempt: 1,
      score: verdict.score,
      approved: verdict.approved,
      notes: verdict.notes,
    });

    let revisions = 0;
    while (!verdict.approved && revisions < MAX_REVISIONS) {
      revisions++;
      draft = await reviseArticle({
        draft,
        notes: verdict.notes,
        researchSuggestions: verdict.research_suggestions,
        leads,
      });
      verdict = await reviewArticle(draft);
      attempts.push({
        attempt: revisions + 1,
        score: verdict.score,
        approved: verdict.approved,
        notes: verdict.notes,
      });
    }

    // Publish on editor approval, or when the final score clears the floor;
    // only below-floor drafts are held unpublished for human review.
    const shouldPublish = verdict.approved || verdict.score >= PUBLISH_FLOOR;

    // Best-effort cover image (Pexels → Storyblok asset); never blocks publish.
    const cover = await resolveCover(
      [draft.tags.slice(0, 3).join(" "), draft.tags[0] ?? "", draft.category].filter(Boolean),
      draft.slug,
    );

    const article = await publishArticle(draft, {
      publish: shouldPublish,
      author: opinionTopic ? content.writer.opinionAuthorName : undefined,
      cover: cover ?? undefined,
    });

    // Mark the topic written whenever a story was created (published or held
    // as draft) so the next run doesn't produce a duplicate piece.
    if (opinionTopic) {
      await markTopicWritten(opinionTopic.id, { id: article.id, slug: article.full_slug });
    }

    await finishRun(runId, {
      outcome: shouldPublish ? "published" : "draft",
      leads_count: leads.length,
      article_id: article.id,
      article_slug: article.full_slug,
      article_title: article.title,
      editor_score: verdict.score,
      approved: verdict.approved,
      revision_count: revisions,
      attempts,
      notes: opinionTopic ? `opinion: ${opinionTopic.topic}` : undefined,
      draft,
    });

    if (shouldPublish) {
      // Social announce is best-effort and must never break article publishing.
      try {
        await announceArticle(
          { slug: article.slug, title: article.title, excerpt: article.excerpt, tags: article.tags },
          { trigger, requireAuto: true },
        );
      } catch (err) {
        console.error("[pipeline] announce failed (non-fatal):", err);
      }
    }

    return {
      ok: true,
      outcome: shouldPublish ? "published" : "draft",
      article,
      score: verdict.score,
      revisions,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[pipeline] article pipeline error:", err);
    await finishRun(runId, {
      status: "error",
      outcome: "failed",
      attempts,
      notes: message,
      draft,
    });
    return { ok: false, outcome: "failed", reason: message };
  }
}
