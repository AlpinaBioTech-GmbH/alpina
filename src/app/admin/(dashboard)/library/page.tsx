import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { serviceClient } from "@/lib/supabase/service";
import { siteUrl } from "@/lib/site";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionButton } from "@/components/admin/ActionButton";
import { StatusBadge } from "@/components/admin/status-badge";
import { DocumentUpload } from "@/components/admin/DocumentUpload";
import { archiveDocument, dismissTopic, reanalyzeDocument } from "./actions";
import type { OpinionTopic, ReferenceDocument } from "@/lib/documents";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // document analysis calls Claude on long texts

export default async function AdminLibraryPage() {
  await requireAdmin();
  const db = serviceClient();
  let documents: ReferenceDocument[] = [];
  let topics: OpinionTopic[] = [];
  if (db) {
    const [docsRes, topicsRes] = await Promise.all([
      db
        .from("reference_documents")
        .select("id, title, storage_path, source_url, byte_size, page_count, summary, status, created_at")
        .order("created_at", { ascending: false }),
      db.from("opinion_topics").select("*").order("position"),
    ]);
    documents = (docsRes.data as ReferenceDocument[]) ?? [];
    topics = (topicsRes.data as OpinionTopic[]) ?? [];
  }

  const pendingCount = topics.filter((t) => t.status === "pending").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Library</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Reference documents that seed the opinion-article series.
          {pendingCount > 0 &&
            ` ${pendingCount} angle(s) queued. The article cron writes one per run.`}
        </p>
      </div>

      {!db && (
        <p className="text-destructive text-sm">
          Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY).
        </p>
      )}

      <DocumentUpload />

      <section className="space-y-4">
        <h2 className="text-sm font-semibold tracking-wide uppercase">Documents</h2>
        {documents.length === 0 && (
          <p className="text-muted-foreground border border-dashed p-8 text-center text-sm">
            No documents yet. Add one above. By URL is easiest for public papers.
          </p>
        )}
        {documents.map((doc) => {
          const docTopics = topics.filter((t) => t.document_id === doc.id);
          return (
            <Card key={doc.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  <span className="min-w-0 flex-1 truncate">{doc.title}</span>
                  {doc.status === "archived" && <StatusBadge status="skipped" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {doc.summary && <p className="text-muted-foreground">{doc.summary}</p>}
                <p className="text-muted-foreground text-xs">
                  {doc.page_count != null && `${doc.page_count} pages`}
                  {doc.byte_size != null && ` · ${(doc.byte_size / 1e6).toFixed(1)} MB`}
                  {doc.source_url && (
                    <>
                      {" · "}
                      <a
                        href={doc.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        source
                      </a>
                    </>
                  )}
                </p>

                {docTopics.length > 0 && (
                  <div className="divide-y border-y">
                    {docTopics.map((topic) => (
                      <div key={topic.id} className="flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{topic.topic}</p>
                          <p className="text-muted-foreground line-clamp-2 text-xs">
                            {topic.angle}
                          </p>
                        </div>
                        <StatusBadge status={topic.status} />
                        {topic.status === "written" && topic.article_slug && (
                          <Link
                            href={`${siteUrl()}/${topic.article_slug}`}
                            target="_blank"
                            className="text-xs underline"
                          >
                            article
                          </Link>
                        )}
                        {topic.status === "pending" && (
                          <ActionButton
                            action={dismissTopic.bind(null, topic.id)}
                            pendingLabel="Dismissing…"
                            variant="ghost"
                            size="sm"
                          >
                            Dismiss
                          </ActionButton>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <ActionButton
                    action={reanalyzeDocument.bind(null, doc.id)}
                    pendingLabel="Analyzing…"
                    variant="outline"
                    size="sm"
                  >
                    Regenerate angles
                  </ActionButton>
                  {doc.status === "active" && (
                    <ActionButton
                      action={archiveDocument.bind(null, doc.id)}
                      pendingLabel="Archiving…"
                      variant="outline"
                      size="sm"
                    >
                      Archive
                    </ActionButton>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
