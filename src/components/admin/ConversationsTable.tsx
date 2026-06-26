// src/components/admin/ConversationsTable.tsx
// Conversation list as a table. Rows are clickable (open the full conversation);
// the three-dot menu archives (soft delete) or deletes a row.
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { DotsThreeVerticalIcon as EllipsisVertical } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import {
  archiveConversation,
  unarchiveConversation,
  deleteConversation,
} from "@/app/admin/(dashboard)/conversations/actions";

export type ConversationRow = {
  id: string;
  dateTime: string;
  summary: string;
  intent: string | null;
  worthFollowup: boolean;
  tokens: string;
  cost: string;
  archived: boolean;
};

function RowActions({ id, archived }: { id: string; archived: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = (fn: (id: string) => Promise<void>) =>
    start(async () => {
      await fn(id);
      router.refresh();
    });

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Row actions"
          disabled={pending}
          onClick={(e) => e.stopPropagation()}
          className="flex size-8 items-center justify-center rounded-none text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <EllipsisVertical size={18} weight="bold" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          onClick={(e) => e.stopPropagation()}
          className="z-50 min-w-36 rounded-none border bg-background p-1 text-sm shadow-md"
        >
          {archived ? (
            <DropdownMenu.Item
              onSelect={() => run(unarchiveConversation)}
              className="cursor-pointer rounded-none px-2 py-1.5 outline-none hover:bg-secondary"
            >
              Unarchive
            </DropdownMenu.Item>
          ) : (
            <DropdownMenu.Item
              onSelect={() => run(archiveConversation)}
              className="cursor-pointer rounded-none px-2 py-1.5 outline-none hover:bg-secondary"
            >
              Archive
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item
            onSelect={() => run(deleteConversation)}
            className="cursor-pointer rounded-none px-2 py-1.5 text-destructive outline-none hover:bg-destructive/10"
          >
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function ConversationsTable({ rows }: { rows: ConversationRow[] }) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto rounded-none border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">When</th>
            <th className="px-3 py-2 font-medium">Summary</th>
            <th className="px-3 py-2 font-medium">Intent</th>
            <th className="px-3 py-2 font-medium">Usage</th>
            <th className="px-3 py-2 font-medium">Cost</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => router.push(`/admin/conversations/${row.id}`)}
              className="cursor-pointer align-top transition-colors hover:bg-muted/40"
            >
              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                {row.dateTime}
              </td>
              <td className="max-w-md px-3 py-2">
                <span className="line-clamp-2">{row.summary}</span>
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-1">
                  {row.intent ? <Badge variant="outline">{row.intent}</Badge> : null}
                  {row.worthFollowup ? <Badge>Follow up</Badge> : null}
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                {row.tokens}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                {row.cost}
              </td>
              <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                <RowActions id={row.id} archived={row.archived} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
