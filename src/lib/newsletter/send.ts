// The unattended send status machine: sending -> sent | failed, plus skipped
// (zero-article month). newsletter_issues.period is UNIQUE, so a double send
// of the same month is impossible even under concurrent invocations; the cron
// guards on top are advisory. Retry of a failed issue reuses the stored
// resend_broadcast_id (never creates a second broadcast).
import { getSupabaseAdmin } from "@/lib/supabase/service";
import { startRun, finishRun } from "@/lib/runs";
import { sendOperatorEmail } from "@/lib/social/notify";
import { brand } from "@/lib/config";
import { getResendClient, newsletterSegmentId } from "@/lib/newsletter/resend";
import {
  fetchDigestArticles,
  periodLabel,
  periodSlug,
  type Period,
} from "@/lib/newsletter/digest";
import { composeIntro } from "@/lib/newsletter/composer";
import {
  getIssueById,
  issueArchiveUrl,
  listIssues,
  previousSentIssue,
  type IssueContent,
  type NewsletterIssue,
} from "@/lib/newsletter/issue";
import { renderDigestEmail } from "@/emails/newsletter";

export type SendResult = {
  outcome: "sent" | "skipped" | "failed";
  reason?: string;
  issueId?: string;
  broadcastId?: string;
  articleCount?: number;
};

function fromAddress(): string {
  return process.env.NEWSLETTER_FROM?.trim() || brand.contact.from;
}

function issueTitle(period: Period): string {
  return `${brand.name} Digest - ${periodLabel(period)}`;
}

async function subscribedCount(): Promise<number | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { count } = await db
    .from("newsletter_subscribers")
    .select("id", { count: "exact", head: true })
    .eq("status", "subscribed");
  return count ?? null;
}

// Next's revalidatePath only exists inside a request context; the CLI runner
// (tsx) has none, so revalidation is best-effort.
async function revalidateArchive(slug: string): Promise<void> {
  try {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/newsletter");
    revalidatePath(`/newsletter/${slug}`);
  } catch {
    /* CLI context: the page revalidates on its own schedule */
  }
}

async function markIssue(id: string, patch: Record<string, unknown>): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;
  await db
    .from("newsletter_issues")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
}

/** Send the info@ copy of a broadcast (transactional; merge tags are inert there). */
async function sendAdminCopy(subject: string, html: string, audienceSize: number | null): Promise<void> {
  const resend = getResendClient();
  const to = process.env.CONTACT_NOTIFY_TO?.trim();
  if (!resend || !to) return;
  try {
    await resend.emails.send({
      from: fromAddress(),
      to: [to],
      subject: `[Newsletter sent${audienceSize != null ? ` to ${audienceSize} subscribers` : ""}] ${subject}`,
      html,
    });
  } catch (err) {
    console.warn("[newsletter] admin copy failed:", err);
  }
}

/**
 * Rebuild the plain-text alternative from the issue's structured content.
 * Multipart (HTML + text) broadcasts score better with spam filters; the text
 * is deterministic, so regenerating on retry matches the original send.
 */
async function issueText(issue: NewsletterIssue): Promise<string | undefined> {
  if (!issue.content) return undefined;
  const prev = await previousSentIssue(issue.period);
  const { text } = renderDigestEmail({
    title: issue.title,
    monthLabel: periodLabel(issue.period),
    introParagraphs: issue.content.intro_paragraphs,
    closingLine: issue.content.closing_line,
    articles: issue.content.articles,
    previewText: issue.preview_text ?? "",
    mode: "broadcast",
    archiveUrl: issueArchiveUrl(issue),
    previousIssue: prev ? { title: prev.title, url: issueArchiveUrl(prev) } : null,
  });
  return text;
}

/** Create (if needed) and send the broadcast for an issue row. */
async function dispatchBroadcast(issue: NewsletterIssue): Promise<SendResult> {
  const resend = getResendClient();
  const segmentId = newsletterSegmentId();
  if (!resend || !segmentId) throw new Error("Resend or NEWSLETTER_RESEND_SEGMENT_ID not configured.");
  if (!issue.email_html || !issue.subject) throw new Error("Issue is missing rendered email content.");

  let broadcastId = issue.resend_broadcast_id;
  if (!broadcastId) {
    const { data, error } = await resend.broadcasts.create({
      segmentId,
      from: fromAddress(),
      replyTo: brand.contact.email,
      subject: issue.subject,
      html: issue.email_html,
      text: await issueText(issue),
      name: issue.title,
      previewText: issue.preview_text ?? undefined,
    });
    if (error || !data?.id) throw new Error(`Broadcast create failed: ${error?.message ?? "no id"}`);
    broadcastId = data.id;
    await markIssue(issue.id, { resend_broadcast_id: broadcastId });
  }

  const sent = await resend.broadcasts.send(broadcastId);
  if (sent.error) throw new Error(`Broadcast send failed: ${sent.error.message}`);

  const audienceSize = await subscribedCount();
  await markIssue(issue.id, {
    status: "sent",
    sent_at: new Date().toISOString(),
    audience_size_at_send: audienceSize,
    last_error: null,
  });
  await sendAdminCopy(issue.subject, issue.email_html, audienceSize);
  await revalidateArchive(issue.slug);
  return { outcome: "sent", issueId: issue.id, broadcastId, articleCount: issue.article_count ?? undefined };
}

/**
 * Full pipeline for one period: digest -> AI intro -> render -> issue row ->
 * broadcast. Assumes the caller already checked no sent/sending/skipped row
 * exists for the period (the unique constraint backstops races).
 */
export async function composeAndSendIssue(period: Period, trigger: "cron" | "manual"): Promise<SendResult> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error("Supabase not configured.");

  const runId = await startRun("newsletter", trigger);
  try {
    const articles = await fetchDigestArticles(period);
    const label = periodLabel(period);

    if (!articles.length) {
      const { error } = await db.from("newsletter_issues").insert({
        period,
        slug: periodSlug(period),
        status: "skipped",
        title: issueTitle(period),
        article_count: 0,
        notes: `No articles published in ${label}.`,
      });
      if (error) throw new Error(`Issue insert failed: ${error.message}`);
      await finishRun(runId, { status: "success", outcome: "skipped", notes: `no articles in ${label}` });
      await sendOperatorEmail(
        `${brand.name} newsletter: skipped for ${label}`,
        `No articles were published in ${label}, so no digest was sent. The next attempt is next month's first Tuesday.`,
      );
      return { outcome: "skipped", reason: "no-articles", articleCount: 0 };
    }

    const previousIssues = await listIssues({ sentOnly: true, limit: 5 });
    const { intro, model } = await composeIntro({
      monthLabel: label,
      articles,
      previousSubjects: previousIssues.map((i) => i.subject).filter((s): s is string => Boolean(s)),
    });

    const prev = await previousSentIssue(period);
    const slug = periodSlug(period);
    const title = issueTitle(period);
    const archiveUrl = issueArchiveUrl({ slug });
    const { html } = renderDigestEmail({
      title,
      monthLabel: label,
      introParagraphs: intro.intro_paragraphs,
      closingLine: intro.closing_line,
      articles,
      previewText: intro.preview_text,
      mode: "broadcast",
      archiveUrl,
      previousIssue: prev ? { title: prev.title, url: issueArchiveUrl(prev) } : null,
    });

    const content: IssueContent = {
      intro_paragraphs: intro.intro_paragraphs,
      closing_line: intro.closing_line,
      articles,
    };
    const { data: row, error } = await db
      .from("newsletter_issues")
      .insert({
        period,
        slug,
        status: "sending",
        title,
        subject: intro.subject,
        preview_text: intro.preview_text,
        content,
        email_html: html,
        model,
        article_count: articles.length,
      })
      .select("id")
      .single();
    // Unique(period) violation = a concurrent run got there first: stand down.
    if (error) {
      if (error.code === "23505") {
        await finishRun(runId, { status: "success", outcome: "skipped", notes: "lost period race" });
        return { outcome: "skipped", reason: "period-race" };
      }
      throw new Error(`Issue insert failed: ${error.message}`);
    }

    const issue = await getIssueById(row.id as string);
    if (!issue) throw new Error("Issue row vanished after insert.");

    try {
      const result = await dispatchBroadcast(issue);
      await finishRun(runId, {
        status: "success",
        outcome: "sent",
        notes: `${label}: ${articles.length} articles, broadcast ${result.broadcastId}`,
      });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await markIssue(issue.id, { status: "failed", last_error: msg });
      throw err;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finishRun(runId, { status: "error", outcome: "failed", notes: msg });
    await sendOperatorEmail(
      `${brand.name} newsletter: send failed`,
      `The monthly digest for ${periodLabel(period)} failed:\n\n${msg}\n\nRetry from /admin/newsletter, or run: npm run send-newsletter -- --force`,
    );
    return { outcome: "failed", reason: msg };
  }
}

/** Retry a failed issue. Refuses sent/skipped/sending; reuses the broadcast id. */
export async function retryIssueSend(issueId: string, trigger: "cron" | "manual"): Promise<SendResult> {
  const issue = await getIssueById(issueId);
  if (!issue) return { outcome: "failed", reason: "issue not found" };
  if (issue.status !== "failed") {
    return { outcome: "skipped", reason: `already-${issue.status}`, issueId: issue.id };
  }

  const runId = await startRun("newsletter", trigger);
  try {
    const result = await dispatchBroadcast(issue);
    await finishRun(runId, { status: "success", outcome: "sent", notes: `retry of ${issue.slug}` });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markIssue(issue.id, { status: "failed", last_error: msg });
    await finishRun(runId, { status: "error", outcome: "failed", notes: `retry: ${msg}` });
    await sendOperatorEmail(`${brand.name} newsletter: retry failed`, `Retry of ${issue.slug} failed:\n\n${msg}`);
    return { outcome: "failed", reason: msg, issueId: issue.id };
  }
}
