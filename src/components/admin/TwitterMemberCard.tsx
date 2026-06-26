"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ActionButton } from "@/components/admin/ActionButton";
import {
  setTwitterMemberAutoEnabled,
  disconnectTwitterMember,
} from "@/app/admin/(dashboard)/social/actions";
import type { Connection } from "@/lib/admin/types";

function daysUntil(iso: string): number {
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

// Secondary X connection: the admin's personal account. When connected and
// enabled, each company tweet is mirrored to it (see crossPostToMember in
// src/lib/twitter/pipeline.ts). No generate/preview — it follows the company run.
export function TwitterMemberCard({ connection }: { connection: Connection | null }) {
  const [auto, setAuto] = useState(connection?.auto_enabled ?? false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const expiresInDays = connection?.expires_at ? daysUntil(connection.expires_at) : null;

  function toggleAuto(next: boolean) {
    setAuto(next); // optimistic
    startTransition(async () => {
      const result = await setTwitterMemberAutoEnabled(next);
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
        <CardTitle className="text-base">Personal account cross-post</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Mirror each company tweet to your personal X account. Reuses the same X app. Just
          register <code className="mx-1">/api/auth/twitter-member/callback</code> as a second
          OAuth callback URL (set the <code className="mx-1">TWITTER_MEMBER_*</code> env vars only
          if you use a separate app).
        </p>
        <p className="text-sm">
          {connection ? (
            <>
              Connected as <strong>{connection.display_name ?? connection.author_urn}</strong>
              {expiresInDays != null && (
                <span
                  className={expiresInDays < 7 ? "text-destructive" : "text-muted-foreground"}
                >
                  {" "}
                  · token expires in {expiresInDays} day{expiresInDays === 1 ? "" : "s"}
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">Not connected.</span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {connection ? (
            <>
              <Label className="flex items-center gap-2 text-sm font-normal">
                <Switch checked={auto} onCheckedChange={toggleAuto} />
                Cross-post to account
              </Label>
              <Button asChild variant="outline" size="sm">
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full navigation to an OAuth API route, not a page */}
                <a href="/api/auth/twitter-member">Reconnect</a>
              </Button>
              <ActionButton
                action={() => disconnectTwitterMember()}
                pendingLabel="Disconnecting…"
                variant="outline"
                size="sm"
              >
                Disconnect
              </ActionButton>
            </>
          ) : (
            <Button asChild size="sm">
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full navigation to an OAuth API route, not a page */}
              <a href="/api/auth/twitter-member">Connect account</a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
