import type { KbDocumentStatus } from "@graft/shared";

import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

const STATUS_STYLES: Record<KbDocumentStatus, string> = {
  PENDING: "bg-muted text-muted-foreground",
  PROCESSING: "bg-accent text-accent-foreground",
  READY: "bg-success/10 text-success",
  FAILED: "bg-destructive/10 text-destructive",
};

const STATUS_LABELS: Record<KbDocumentStatus, string> = {
  PENDING: "Queued",
  PROCESSING: "Processing",
  READY: "Ready",
  FAILED: "Failed",
};

/**
 * Ingestion-status pill. The spinner appears only for PROCESSING — genuine "work in
 * progress" feedback, not decorative motion; PENDING is a queued state, so it gets a
 * static dot. READY/FAILED are terminal and static.
 */
export function StatusBadge({ status }: { status: KbDocumentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status],
      )}
    >
      {status === "PROCESSING" ? (
        <Spinner className="size-3" />
      ) : status === "PENDING" ? (
        <span className="size-1.5 rounded-full bg-current opacity-60" aria-hidden="true" />
      ) : null}
      {STATUS_LABELS[status]}
    </span>
  );
}
