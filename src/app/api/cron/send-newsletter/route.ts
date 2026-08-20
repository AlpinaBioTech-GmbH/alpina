// Monthly digest cron. vercel.json schedules this every Tuesday 07:00 UTC
// (09:00 CEST / 08:00 CET); the Berlin day-of-month guard below makes only the
// FIRST Tuesday act, and the unique(period) constraint in newsletter_issues
// makes a double send impossible regardless.
//
//   ?dry=1    compose only (no DB writes, no send), returns the HTML
//   ?force=1  bypass the first-Tuesday window (not the period uniqueness)
import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import {
  berlinDayOfMonth,
  fetchDigestArticles,
  periodLabel,
  periodSlug,
  previousPeriod,
} from "@/lib/newsletter/digest";
import { composeIntro } from "@/lib/newsletter/composer";
import { getIssueByPeriod, issueArchiveUrl, previousSentIssue } from "@/lib/newsletter/issue";
import { composeAndSendIssue, retryIssueSend } from "@/lib/newsletter/send";
import { renderDigestEmail } from "@/emails/newsletter";
import { brand } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const force = url.searchParams.get("force") === "1";

  const now = new Date();
  const period = previousPeriod(now);
  const label = periodLabel(period);

  if (dry) {
    const articles = await fetchDigestArticles(period);
    if (!articles.length) return NextResponse.json({ period, label, articleCount: 0, outcome: "would-skip" });
    const { intro, model } = await composeIntro({ monthLabel: label, articles, previousSubjects: [] });
    const prev = await previousSentIssue(period);
    const { html } = renderDigestEmail({
      title: `${brand.name} Digest - ${label}`,
      monthLabel: label,
      introParagraphs: intro.intro_paragraphs,
      closingLine: intro.closing_line,
      articles,
      previewText: intro.preview_text,
      mode: "copy",
      archiveUrl: issueArchiveUrl({ slug: periodSlug(period) }),
      previousIssue: prev ? { title: prev.title, url: issueArchiveUrl(prev) } : null,
    });
    return NextResponse.json({ period, label, articleCount: articles.length, model, ...intro, html });
  }

  if (!force && berlinDayOfMonth(now) > 7) {
    return NextResponse.json({ outcome: "skipped", reason: "not-first-tuesday", period });
  }

  const existing = await getIssueByPeriod(period);
  if (existing && existing.status !== "failed") {
    return NextResponse.json({ outcome: "skipped", reason: `already-${existing.status}`, period });
  }
  const result = existing
    ? await retryIssueSend(existing.id, "cron")
    : await composeAndSendIssue(period, "cron");

  return NextResponse.json({ period, label, ...result }, { status: result.outcome === "failed" ? 500 : 200 });
}
