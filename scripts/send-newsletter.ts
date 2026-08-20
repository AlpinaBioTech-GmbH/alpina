// Local newsletter runner over the same lib the cron uses.
//
//   npm run send-newsletter -- --dry     compose only; writes the HTML to
//                                        newsletter-preview.html (no DB, no send)
//   npm run send-newsletter -- --test    real broadcast to NEWSLETTER_TEST_SEGMENT_ID
//                                        (info@ only); no newsletter_issues row
//   npm run send-newsletter -- --force   the REAL send path for the previous
//                                        month (period uniqueness still applies)
//   npm run send-newsletter -- --archive historical backfill: compose + store
//                                        the issue as sent WITHOUT any email or
//                                        broadcast (archive page only)
//   ... -- --period=2026-07-01           override the covered month
import "./env";
import { writeFileSync } from "node:fs";
import {
  fetchDigestArticles,
  periodLabel,
  periodSlug,
  previousPeriod,
} from "@/lib/newsletter/digest";
import { composeIntro } from "@/lib/newsletter/composer";
import { issueArchiveUrl, previousSentIssue } from "@/lib/newsletter/issue";
import { composeAndSendIssue } from "@/lib/newsletter/send";
import { renderDigestEmail } from "@/emails/newsletter";
import { getResendClient } from "@/lib/newsletter/resend";
import { getSupabaseAdmin } from "@/lib/supabase/service";
import { brand } from "@/lib/config";

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const periodArg = args.find((a) => a.startsWith("--period="))?.split("=")[1];

async function main() {
  const period = periodArg ?? previousPeriod();
  const label = periodLabel(period);
  console.log(`Digest for ${label} (period ${period})`);

  if (has("--force")) {
    const result = await composeAndSendIssue(period, "manual");
    console.log(JSON.stringify(result, null, 2));
    if (result.outcome === "failed") process.exit(1);
    return;
  }

  const articles = await fetchDigestArticles(period);
  console.log(`${articles.length} article(s):`);
  for (const a of articles) console.log(`  - ${a.date}  ${a.title}`);
  if (!articles.length) {
    console.log("Nothing to send: the real run would record a 'skipped' issue.");
    return;
  }

  const { intro, model } = await composeIntro({ monthLabel: label, articles, previousSubjects: [] });
  const prev = await previousSentIssue(period);
  const render = (mode: "broadcast" | "copy") =>
    renderDigestEmail({
      title: `${brand.name} Digest - ${label}`,
      monthLabel: label,
      introParagraphs: intro.intro_paragraphs,
      closingLine: intro.closing_line,
      articles,
      previewText: intro.preview_text,
      mode,
      archiveUrl: issueArchiveUrl({ slug: periodSlug(period) }),
      previousIssue: prev ? { title: prev.title, url: issueArchiveUrl(prev) } : null,
    });

  console.log(`\nmodel:    ${model}`);
  console.log(`subject:  ${intro.subject}`);
  console.log(`preview:  ${intro.preview_text}`);
  console.log(`intro:\n${intro.intro_paragraphs.map((p) => `  ${p}`).join("\n")}`);
  if (intro.closing_line) console.log(`closing:  ${intro.closing_line}`);

  if (has("--archive")) {
    // Historical backfill: store the issue as sent with no broadcast and no
    // email. sent_at is backdated to the first Tuesday after the covered month
    // (the date the automation would have sent it).
    const db = getSupabaseAdmin();
    if (!db) throw new Error("Supabase not configured.");
    const [y, m] = period.split("-").map(Number);
    const next = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1, 7));
    while (next.getUTCDay() !== 2) next.setUTCDate(next.getUTCDate() + 1);
    const { html } = render("copy");
    const { error } = await db.from("newsletter_issues").insert({
      period,
      slug: periodSlug(period),
      status: "sent",
      title: `${brand.name} Digest - ${label}`,
      subject: intro.subject,
      preview_text: intro.preview_text,
      content: { intro_paragraphs: intro.intro_paragraphs, closing_line: intro.closing_line, articles },
      email_html: html,
      model,
      article_count: articles.length,
      sent_at: next.toISOString(),
      audience_size_at_send: 0,
      notes: "Historical issue: archived without an email send.",
    });
    if (error) throw new Error(`Issue insert failed: ${error.message}`);
    console.log(`\nArchived ${label} as a historical issue (no email sent): /newsletter/${periodSlug(period)}`);
    return;
  }

  if (has("--test")) {
    const segmentId = process.env.NEWSLETTER_TEST_SEGMENT_ID?.trim();
    const resend = getResendClient();
    if (!segmentId || !resend) throw new Error("Missing NEWSLETTER_TEST_SEGMENT_ID or RESEND_API_KEY.");
    const { html } = render("broadcast");
    const created = await resend.broadcasts.create({
      segmentId,
      from: process.env.NEWSLETTER_FROM?.trim() || brand.contact.from,
      subject: `[TEST] ${intro.subject}`,
      html,
      name: `TEST ${label}`,
      previewText: intro.preview_text,
    });
    if (created.error || !created.data?.id) throw new Error(`broadcast create: ${created.error?.message}`);
    const sent = await resend.broadcasts.send(created.data.id);
    if (sent.error) throw new Error(`broadcast send: ${sent.error.message}`);
    console.log(`\nTest broadcast sent to the test segment (broadcast ${created.data.id}).`);
    return;
  }

  // --dry (default): write the preview HTML next to the repo for a browser look.
  const { html } = render("copy");
  writeFileSync("newsletter-preview.html", html);
  console.log(`\nDry run: wrote newsletter-preview.html (open it in a browser).`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
