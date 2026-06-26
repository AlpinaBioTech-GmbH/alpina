"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ActionButton } from "@/components/admin/ActionButton";
import { addFeed, deleteFeed, setFeedEnabled } from "@/app/admin/(dashboard)/feeds/actions";

export function FeedToggle({ id, enabled }: { id: string; enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Switch
      checked={on}
      onCheckedChange={(next) => {
        setOn(next); // optimistic
        startTransition(async () => {
          const result = await setFeedEnabled(id, next);
          if (!result.ok) {
            setOn(!next);
            toast.error(result.message);
          }
          router.refresh();
        });
      }}
    />
  );
}

export function DeleteFeedButton({ id }: { id: string }) {
  return (
    <ActionButton
      action={() => deleteFeed(id)}
      pendingLabel="Deleting…"
      variant="ghost"
      size="sm"
      className="text-destructive"
    >
      Delete
    </ActionButton>
  );
}

export function AddFeedForm() {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("general");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await addFeed({ url, label, category });
      if (result.ok) {
        toast.success(result.message);
        setUrl("");
        setLabel("");
      } else {
        toast.error(result.message);
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="feed-url">Feed URL</Label>
          <Input
            id="feed-url"
            type="url"
            required
            placeholder="https://example.com/feed/"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="feed-label">Label</Label>
          <Input
            id="feed-label"
            placeholder="Outlet name (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          {(["general", "industry"] as const).map((c) => (
            <Button
              key={c}
              type="button"
              variant={category === c ? "default" : "outline"}
              size="sm"
              onClick={() => setCategory(c)}
            >
              {c}
            </Button>
          ))}
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add feed"}
        </Button>
      </div>
    </form>
  );
}
