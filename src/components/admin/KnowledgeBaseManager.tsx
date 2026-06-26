// src/components/admin/KnowledgeBaseManager.tsx
// Manages the assistant's knowledge base: sync Storyblok content, upload
// documents (PDF/DOCX/TXT/MD), add manual notes, and review/remove sources.
"use client";

import { useActionState } from "react";
import {
  uploadDocuments,
  addNote,
  reindexStoryblok,
  deleteDocument,
  type ActionState,
} from "@/app/admin/(dashboard)/assistant/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type KbDocument = {
  id: string;
  title: string;
  source_type: "storyblok" | "upload" | "note";
  status: "pending" | "ready" | "error";
  chunk_count: number;
  error: string | null;
  updated_at: string;
};

const SOURCE_LABEL: Record<KbDocument["source_type"], string> = {
  storyblok: "Storyblok",
  upload: "Upload",
  note: "Note",
};

function StatusBadge({ status }: { status: KbDocument["status"] }) {
  if (status === "ready") return <Badge variant="secondary">Ready</Badge>;
  if (status === "pending") return <Badge variant="outline">Pending</Badge>;
  return <Badge variant="destructive">Error</Badge>;
}

function FormMessage({ state }: { state: ActionState | null }) {
  if (!state) return null;
  return (
    <span className={state.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
      {state.message}
    </span>
  );
}

export function KnowledgeBaseManager({ documents }: { documents: KbDocument[] }) {
  const [syncState, syncAction, syncing] = useActionState<ActionState | null, FormData>(
    reindexStoryblok,
    null,
  );
  const [uploadState, uploadAction, uploading] = useActionState<ActionState | null, FormData>(
    uploadDocuments,
    null,
  );
  const [noteState, noteAction, savingNote] = useActionState<ActionState | null, FormData>(
    addNote,
    null,
  );

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        {/* Storyblok sync */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Website content</CardTitle>
            <CardDescription>
              Pull published Storyblok pages into the knowledge base.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <form action={syncAction}>
              <Button type="submit" variant="secondary" disabled={syncing}>
                {syncing ? "Syncing..." : "Sync Storyblok"}
              </Button>
            </form>
            <FormMessage state={syncState} />
          </CardContent>
        </Card>

        {/* Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload documents</CardTitle>
            <CardDescription>PDF, DOCX, TXT, or MD.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={uploadAction} className="grid gap-3">
              <Input
                type="file"
                name="files"
                multiple
                accept=".pdf,.docx,.txt,.md"
                required
              />
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={uploading}>
                  {uploading ? "Processing..." : "Upload"}
                </Button>
                <FormMessage state={uploadState} />
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Manual note */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add a note</CardTitle>
            <CardDescription>Ad-hoc facts for the assistant to know.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={noteAction} className="grid gap-3">
              <Input name="title" placeholder="Note title" required />
              <Textarea name="content" placeholder="What should the assistant know?" rows={3} required />
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={savingNote}>
                  {savingNote ? "Saving..." : "Add note"}
                </Button>
                <FormMessage state={noteState} />
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Document list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sources ({documents.length})</CardTitle>
          <CardDescription>Everything the assistant can draw on.</CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sources yet. Sync Storyblok or upload a document to get started.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-none border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Title</th>
                    <th className="px-3 py-2 font-medium">Source</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Chunks</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="align-top">
                      <td className="px-3 py-2">
                        {doc.title}
                        {doc.error ? (
                          <span className="block text-xs text-destructive">{doc.error}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">{SOURCE_LABEL[doc.source_type]}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={doc.status} />
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{doc.chunk_count}</td>
                      <td className="px-3 py-2 text-right">
                        <form action={deleteDocument}>
                          <input type="hidden" name="id" value={doc.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            Delete
                          </Button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
