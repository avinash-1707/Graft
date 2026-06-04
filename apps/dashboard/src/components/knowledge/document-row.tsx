import type { KbDocumentSummary } from "@graft/shared";
import { FileText } from "lucide-react";

import { StatusBadge } from "./status-badge";
import { formatBytes, formatDate } from "./format";

/**
 * One document in the list. `index` drives a small entrance stagger; the row is keyed
 * by document id upstream, so status polling never remounts (and never re-animates) it.
 */
export function DocumentRow({ doc, index }: { doc: KbDocumentSummary; index: number }) {
  return (
    <li
      className="rise-in flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-input"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <FileText className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{doc.filename}</p>
          <p className="text-xs text-muted-foreground">
            {doc.fileType} · {formatBytes(doc.byteSize)} · {formatDate(doc.createdAt)}
          </p>
          {doc.status === "FAILED" && doc.error ? (
            <p className="mt-0.5 text-xs text-destructive">{doc.error}</p>
          ) : null}
        </div>
      </div>
      <StatusBadge status={doc.status} />
    </li>
  );
}
