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
  setMemberAutoEnabled,
  disconnectMember,
} from "@/app/admin/(dashboard)/social/actions";
import type { Connection } from "@/lib/admin/types";

function daysUntil(iso: string): number {
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

// Secondary LinkedIn connection: the admin's personal profile. When connected
// and enabled, each company-page post is mirrored to it (see crossPostToMember
// in src/lib/linkedin/pipeline.ts). No generate/preview — it follows the org run.
export function LinkedinMemberCard({ connection }: { connection: Connection | null }) {
  const [auto, setAuto] = useState(connection?.auto_enabled ?? false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const expiresInDays = connection?.expires_at ? daysUntil(connection.expires_at) : null;

  function toggleAuto(next: boolean) {
    setAuto(next); // optimistic
    startTransition(async () => {
      const result = await setMemberAutoEnabled(next);
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
        <CardTitle className="text-base">Personal profile cross-post</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Mirror each company-page post to your personal LinkedIn profile. Needs a separate
          LinkedIn app (Sign In with OpenID Connect + Share on LinkedIn) configured via the
          <code className="mx-1">LINKEDIN_MEMBER_*</code> env vars.
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
                Cross-post to profile
              </Label>
              <Button asChild variant="outline" size="sm">
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full navigation to an OAuth API route, not a page */}
                <a href="/api/auth/linkedin-member">Reconnect</a>
              </Button>
              <ActionButton
                action={() => disconnectMember()}
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
              <a href="/api/auth/linkedin-member">Connect profile</a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
