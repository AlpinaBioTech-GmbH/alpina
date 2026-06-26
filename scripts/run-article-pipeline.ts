// Article pipeline runner for GitHub Actions (and local runs).
//
// A full run makes many sequential Claude calls (multi-turn web research +
// editor + revision loops) and takes ~10-20 minutes, which exceeds Vercel's
// serverless ceiling. So the pipeline runs here, on a runner with no ~5-minute
// limit and full logs.
//
// Usage:
//   npx tsx scripts/run-article-pipeline.ts            (scheduled run)
//   npx tsx scripts/run-article-pipeline.ts --manual   (manual dispatch)
//
// Required env (GitHub Actions secrets):
//   ANTHROPIC_API_KEY, STORYBLOK_MANAGEMENT_TOKEN, STORYBLOK_SPACE_ID,
//   NEXT_PUBLIC_STORYBLOK_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY
//   (optional: ANTHROPIC_BASE_URL, WRITER_MODEL, EDITOR_MODEL,
//    MAX_ARTICLE_REVISIONS, PEXELS_API_KEY, IG_SLIDE_SIGNING_SECRET,
//    RESEND_API_KEY, SOCIAL_OPERATOR_EMAIL)
import "dotenv/config";
import { runArticlePipeline } from "@/lib/pipeline";

async function main() {
  const trigger = process.argv.includes("--manual") ? "manual" : "cron";
  console.log(
    `[run-article-pipeline] starting (${trigger}) at ${new Date().toISOString()}`,
  );
  const result = await runArticlePipeline(trigger);
  console.log("[run-article-pipeline] result:", JSON.stringify(result, null, 2));
  // Surface a genuine pipeline failure as a red Action run; "skipped" (e.g. no
  // leads) and "draft" are expected non-error outcomes.
  if (!result.ok && result.outcome === "failed") process.exitCode = 1;
}

main().catch((err) => {
  console.error("[run-article-pipeline] fatal:", err);
  process.exit(1);
});
