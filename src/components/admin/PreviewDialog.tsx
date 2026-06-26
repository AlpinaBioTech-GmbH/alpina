"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  previewCandidate,
  publishPreviewed,
  type PreviewResult,
  type Provider,
} from "@/app/admin/(dashboard)/social/actions";

export function PreviewDialog({
  provider,
  open,
  onOpenChange,
}: {
  provider: Provider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const label =
    provider === "linkedin" ? "LinkedIn" : provider === "twitter" ? "X (Twitter)" : "Instagram";
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [composing, startComposing] = useTransition();
  const [publishing, startPublishing] = useTransition();
  const router = useRouter();

  function compose() {
    setPreview(null);
    startComposing(async () => {
      try {
        setPreview(await previewCandidate(provider));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Compose failed");
        onOpenChange(false);
      }
    });
  }

  useEffect(() => {
    if (open) compose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, provider]);

  const candidate = preview?.candidate ?? null;
  const imageUrl =
    candidate && "imageUrl" in candidate ? (candidate.imageUrl as string) : null;
  const slides =
    candidate && "slides" in candidate
      ? (candidate.slides as { kicker?: string; title: string; body?: string }[])
      : null;
  const previewText =
    candidate && "fullText" in candidate
      ? (candidate.fullText as string)
      : candidate && "fullCaption" in candidate
        ? (candidate.fullCaption as string)
        : "";

  function publish() {
    if (!candidate) return;
    startPublishing(async () => {
      const result = await publishPreviewed(provider, JSON.stringify(candidate));
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !publishing && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Next post preview: {label}</DialogTitle>
          <DialogDescription>
            {candidate ? `${candidate.pillar} → ${candidate.item.title}` : "Composing a candidate"}
          </DialogDescription>
        </DialogHeader>

        {composing || !preview ? (
          <p className="text-muted-foreground py-8 text-center text-sm">Composing…</p>
        ) : !candidate ? (
          <p className="text-muted-foreground border border-dashed p-8 text-center text-sm">
            Composer produced nothing. Check the catalog and API keys.
          </p>
        ) : (
          <div className="space-y-3">
            <Badge
              variant={preview.approved ? "default" : "destructive"}
              className="font-normal"
            >
              {preview.approved ? "validator approved" : "not approved (last draft)"}
            </Badge>
            {slides && (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {slides.map((slide, i) => (
                  <div
                    key={i}
                    className="border bg-stone-950 p-4 text-stone-50"
                  >
                    <p className="text-xs text-stone-400">
                      slide {i + 1}/{slides.length}
                      {slide.kicker && ` · ${slide.kicker.toUpperCase()}`}
                      {i === slides.length - 1 && slides.length > 1 && " · CTA"}
                    </p>
                    <p className="mt-1 font-semibold">{slide.title}</p>
                    {slide.body && <p className="mt-1 text-sm text-stone-400">{slide.body}</p>}
                  </div>
                ))}
              </div>
            )}
            <p className="bg-muted max-h-64 overflow-y-auto p-3 text-sm whitespace-pre-wrap">
              {previewText}
            </p>
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Post image preview" className="border" />
            )}
            {preview.attempts.length > 0 && (
              <ul className="text-muted-foreground space-y-1 text-xs">
                {preview.attempts.map((a) => (
                  <li key={a.attempt}>
                    #{a.attempt} {a.approved ? "✓" : "✗"} {a.notes}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={compose}
            disabled={composing || publishing}
          >
            {composing ? "Composing…" : "Regenerate"}
          </Button>
          <Button onClick={publish} disabled={!candidate || composing || publishing}>
            {publishing ? "Publishing…" : "Publish as-is"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
