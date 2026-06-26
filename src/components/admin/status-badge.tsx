// Single status → Badge-variant mapping for every state chip in the admin.
// Never introduce ad-hoc colored chips; extend this map for new states.
import { Badge } from "@/components/ui/badge";

type Variant = React.ComponentProps<typeof Badge>["variant"];

const STATUS_VARIANTS: Record<string, Variant> = {
  published: "default", // solid primary — terminal success
  posted: "default",
  sent: "default",
  success: "default",
  draft: "secondary", // muted fill — held / awaiting action
  queued: "secondary",
  running: "secondary",
  skipped: "outline", // neutral outline — intentional no-op
  failed: "destructive",
  error: "destructive",
};

export function statusVariant(status: string): Variant {
  return STATUS_VARIANTS[status] ?? "outline";
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={statusVariant(status)} className="font-normal">
      {status === "running" ? "running…" : status}
    </Badge>
  );
}
