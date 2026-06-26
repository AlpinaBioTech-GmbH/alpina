"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Icon } from "@/components/icons";
import { ActionButton } from "@/components/admin/ActionButton";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  deletePost,
  retryPost,
  skipPost,
  type Provider,
} from "@/app/admin/(dashboard)/social/actions";
import type { PostRow } from "@/lib/admin/types";

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function PostsTable({ provider, posts }: { provider: Provider; posts: PostRow[] }) {
  if (posts.length === 0) {
    return (
      <p className="text-muted-foreground border border-dashed p-8 text-center text-sm">
        No posts yet. Connect the account and run &quot;Generate &amp; post now&quot;.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Post</TableHead>
          <TableHead className="w-28">Pillar</TableHead>
          <TableHead className="w-24">Status</TableHead>
          <TableHead className="w-24">Date</TableHead>
          <TableHead className="w-44 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {posts.map((post) => {
          const body = (post.commentary ?? post.text ?? post.caption ?? "").split("\n")[0];
          const liveUrl = post.linkedin_url ?? post.tweet_url ?? post.permalink ?? null;
          const retryable = post.status === "queued" || post.status === "failed";
          let itemRef = post.content_slug ?? post.content_id;
          try {
            if (!post.content_slug) itemRef = new URL(post.url).pathname;
          } catch {
            // keep content_id
          }
          return (
            <TableRow key={post.id}>
              <TableCell className="max-w-0">
                <a
                  href={post.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 font-medium hover:underline"
                >
                  <span className="truncate">{body}</span>
                  <Icon name="link" size={12} className="shrink-0" />
                </a>
                <p className="text-muted-foreground mt-1 truncate text-xs">
                  grounded in: {itemRef}
                </p>
                {post.validator_notes && (
                  <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">
                    {post.validator_notes}
                  </p>
                )}
                {post.error && (
                  <p className="text-destructive mt-1 line-clamp-1 text-xs">{post.error}</p>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {post.pillar ? (
                  <Badge variant="outline" className="font-normal">
                    {post.pillar}
                  </Badge>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell>
                <StatusBadge status={post.status} />
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {formatDate(post.posted_at ?? post.created_at)}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  {liveUrl && (
                    <Button asChild size="sm" variant="ghost">
                      <a href={liveUrl} target="_blank" rel="noreferrer" aria-label="View post">
                        <Icon name="arrowUpRight" size={14} />
                      </a>
                    </Button>
                  )}
                  {retryable && (
                    <>
                      <ActionButton
                        action={() => retryPost(provider, post.id)}
                        pendingLabel="Retrying…"
                        variant="ghost"
                        size="sm"
                      >
                        Retry
                      </ActionButton>
                      <ActionButton
                        action={() => skipPost(provider, post.id)}
                        pendingLabel="Skipping…"
                        variant="ghost"
                        size="sm"
                      >
                        Skip
                      </ActionButton>
                    </>
                  )}
                  <ActionButton
                    action={() => deletePost(provider, post.id)}
                    pendingLabel="Deleting…"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                  >
                    Delete
                  </ActionButton>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
