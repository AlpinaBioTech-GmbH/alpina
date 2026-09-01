"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ActionButton } from "@/components/admin/ActionButton";
import { PreviewDialog } from "@/components/admin/PreviewDialog";
import { LinkedinOrgSelector } from "@/components/admin/LinkedinOrgSelector";
import {
  disconnectPlatform,
  generateAndPostNow,
  setAutoEnabled,
  type Provider,
} from "@/app/admin/(dashboard)/social/actions";
import type { Connection } from "@/lib/admin/types";

function daysUntil(iso: string): number {
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function PlatformCard({
  provider,
  connection,
}: {
  provider: Provider;
  connection: Connection | null;
}) {
  const label =
    provider === "linkedin" ? "LinkedIn" : provider === "twitter" ? "X (Twitter)" : "Instagram";
  const [auto, setAuto] = useState(connection?.auto_enabled ?? false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  // X access tokens live ~2h and are auto-refreshed on every run via the
  // rotating refresh token, so a day-count is meaningless there. LinkedIn
  // (~60-day, manual reconnect) and Instagram (60-day, auto-refreshed near
  // expiry — a low count means refreshing is failing) are worth surfacing.
  const expiresInDays =
    provider !== "twitter" && connection?.expires_at
      ? daysUntil(connection.expires_at)
      : null;

  function toggleAuto(next: boolean) {
    setAuto(next); // optimistic
    startTransition(async () => {
      const result = await setAutoEnabled(provider, next);
      if (result.ok) {
        toast.success(result.message);
      } else {
        setAuto(!next); // revert
        toast.error(result.message);
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Connection</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          {connection ? (
            <>
              Connected as <strong>{connection.display_name ?? connection.author_urn}</strong>
              {expiresInDays != null && (
                <span
                  className={
                    expiresInDays < 7 ? "text-destructive" : "text-muted-foreground"
                  }
                >
                  {" "}
                  · token expires in {expiresInDays} day{expiresInDays === 1 ? "" : "s"}
                </span>
              )}
              {provider === "twitter" && (
                <span className="text-muted-foreground"> · session auto-refreshes</span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">Not connected.</span>
          )}
        </p>
        {provider === "linkedin" && connection && (
          <LinkedinOrgSelector current={connection.author_urn} />
        )}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {connection ? (
            <>
              <Label className="flex items-center gap-2 text-sm font-normal">
                <Switch checked={auto} onCheckedChange={toggleAuto} />
                Daily auto-post
              </Label>
              <ActionButton
                action={() => generateAndPostNow(provider)}
                pendingLabel="Posting…"
                size="sm"
              >
                Generate &amp; post now
              </ActionButton>
              <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
                Preview next
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={`/api/auth/${provider}`}>Reconnect</a>
              </Button>
              <ActionButton
                action={() => disconnectPlatform(provider)}
                pendingLabel="Disconnecting…"
                variant="outline"
                size="sm"
              >
                Disconnect
              </ActionButton>
            </>
          ) : (
            <Button asChild size="sm">
              <a href={`/api/auth/${provider}`}>Connect {label}</a>
            </Button>
          )}
        </div>
      </CardContent>
      <PreviewDialog provider={provider} open={previewOpen} onOpenChange={setPreviewOpen} />
    </Card>
  );
}
