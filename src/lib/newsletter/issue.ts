// Newsletter issue types + reads. Writes live in send.ts (the status machine).
import { getSupabaseAdmin } from "@/lib/supabase/service";
import { siteUrl } from "@/lib/site";
import type { DigestArticle } from "@/lib/newsletter/digest";

export type NewsletterIssueStatus = "sending" | "sent" | "failed" | "skipped";

export type IssueContent = {
  intro_paragraphs: string[];
  closing_line?: string;
  articles: DigestArticle[];
};

export type NewsletterIssue = {
  id: string;
  created_at: string;
  period: string; // 'YYYY-MM-DD' (first of covered month)
  slug: string; // 'YYYY-MM'
  status: NewsletterIssueStatus;
  title: string;
  subject: string | null;
  preview_text: string | null;
  content: IssueContent | null;
  email_html: string | null;
  model: string | null;
  article_count: number | null;
  sent_at: string | null;
  resend_broadcast_id: string | null;
  audience_size_at_send: number | null;
  last_error: string | null;
  notes: string | null;
};

const COLS =
  "id, created_at, period, slug, status, title, subject, preview_text, content, email_html, model, article_count, sent_at, resend_broadcast_id, audience_size_at_send, last_error, notes";

export async function getIssueByPeriod(period: string): Promise<NewsletterIssue | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data } = await db.from("newsletter_issues").select(COLS).eq("period", period).maybeSingle();
  return (data as NewsletterIssue | null) ?? null;
}

/** Public archive read: sent issues only. */
export async function getSentIssueBySlug(slug: string): Promise<NewsletterIssue | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("newsletter_issues")
    .select(COLS)
    .eq("slug", slug)
    .eq("status", "sent")
    .maybeSingle();
  return (data as NewsletterIssue | null) ?? null;
}

export async function getIssueById(id: string): Promise<NewsletterIssue | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data } = await db.from("newsletter_issues").select(COLS).eq("id", id).maybeSingle();
  return (data as NewsletterIssue | null) ?? null;
}

export async function listIssues(opts: { sentOnly?: boolean; limit?: number } = {}): Promise<NewsletterIssue[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  let q = db.from("newsletter_issues").select(COLS).order("period", { ascending: false });
  if (opts.sentOnly) q = q.eq("status", "sent");
  const { data } = await q.limit(opts.limit ?? 100);
  return (data as NewsletterIssue[] | null) ?? [];
}

/** Latest sent issue covering a month before `period` (for the "previous issue" link). */
export async function previousSentIssue(period: string): Promise<NewsletterIssue | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("newsletter_issues")
    .select(COLS)
    .eq("status", "sent")
    .lt("period", period)
    .order("period", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as NewsletterIssue | null) ?? null;
}

export function issueArchiveUrl(issue: Pick<NewsletterIssue, "slug">): string {
  return `${siteUrl()}/newsletter/${issue.slug}`;
}

/** 0/1-element array so the stats layer keeps its string[] signatures. */
export function issueBroadcastIds(issue: Pick<NewsletterIssue, "resend_broadcast_id">): string[] {
  return issue.resend_broadcast_id ? [issue.resend_broadcast_id] : [];
}
