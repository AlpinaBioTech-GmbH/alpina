"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/admin/action-result";

/**
 * Generic admin action island: disabled button with in-label progress text
 * (no spinners) that toasts the server action's result and refreshes data.
 */
export function ActionButton({
  action,
  children,
  pendingLabel,
  variant = "default",
  size = "default",
  className,
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  pendingLabel: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            const result = await action();
            if (result.ok) toast.success(result.message);
            else toast.error(result.message);
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Action failed");
          }
        })
      }
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
