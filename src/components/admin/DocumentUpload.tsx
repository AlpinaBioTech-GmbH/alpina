"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { browserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addDocumentFromUrl,
  createDocumentUploadUrl,
  finalizeUploadedDocument,
} from "@/app/admin/(dashboard)/library/actions";

const BUCKET = "reference-docs";

export function DocumentUpload() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"upload" | "url" | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function uploadFile() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a PDF first");
      return;
    }
    setBusy("upload");
    try {
      const signed = await createDocumentUploadUrl(file.name);
      if (!signed.ok || !signed.path || !signed.token) {
        toast.error(signed.message ?? "Could not create upload URL");
        return;
      }
      // Direct browser → Supabase Storage upload (bypasses Vercel body limits).
      const supabase = browserClient();
      const { error } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file, {
          contentType: "application/pdf",
        });
      if (error) {
        toast.error(`Upload failed: ${error.message}`);
        return;
      }
      toast.info("Uploaded. Extracting text and generating opinion angles…");
      const result = await finalizeUploadedDocument({
        path: signed.path,
        title: file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " "),
        byteSize: file.size,
      });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      if (fileRef.current) fileRef.current.value = "";
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  async function addByUrl() {
    if (!url.trim()) {
      toast.error("Paste a PDF URL first");
      return;
    }
    setBusy("url");
    try {
      toast.info("Fetching the PDF, extracting text, generating opinion angles…");
      const result = await addDocumentFromUrl({ url });
      if (result.ok) {
        toast.success(result.message);
        setUrl("");
      } else {
        toast.error(result.message);
      }
      startTransition(() => router.refresh());
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add a reference document</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="doc-url">Add by URL (public PDF)</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="doc-url"
              type="url"
              placeholder="https://…/paper.pdf"
              className="min-w-0 flex-1"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Button onClick={addByUrl} disabled={busy !== null}>
              {busy === "url" ? "Analyzing…" : "Fetch & analyze"}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="doc-file">Or upload a PDF</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="doc-file"
              type="file"
              accept="application/pdf"
              ref={fileRef}
              className="min-w-0 flex-1"
            />
            <Button variant="outline" onClick={uploadFile} disabled={busy !== null}>
              {busy === "upload" ? "Analyzing…" : "Upload & analyze"}
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          Each document is text-extracted and analyzed into 5-7 opinion angles. The
          article pipeline writes one pending angle per run before returning to regular
          news coverage.
        </p>
      </CardContent>
    </Card>
  );
}
