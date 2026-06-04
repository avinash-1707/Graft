"use client";

import { MessagesSquare } from "lucide-react";

import { useOrgFeed, type FeedStatus } from "@/lib/hooks/use-org-feed";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/common/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { ConversationCard } from "./conversation-card";

const STATUS_LABEL: Record<FeedStatus, string> = {
  connecting: "Connecting",
  live: "Live",
  reconnecting: "Reconnecting",
};

/** Connection indicator. The "live" dot is static (a steady state), not a pulsing beacon. */
function StatusPill({ status }: { status: FeedStatus }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      {status === "live" ? (
        <span className="size-2 rounded-full bg-success" aria-hidden="true" />
      ) : (
        <Spinner className="size-3" />
      )}
      {STATUS_LABEL[status]}
    </span>
  );
}

/**
 * The live conversation feed (unit 27): a read-only, realtime view of every active
 * conversation in the org, streamed over the org-feed SSE. State badges update as
 * conversations escalate, get claimed, and hand back; the latest message line lets an
 * agent watch the AI↔customer exchange. Claiming and replying land in unit 28.
 */
export function ConversationFeed() {
  const { conversations, lastMessage, status } = useOrgFeed();

  return (
    <div className="space-y-5">
      <div className={cn("flex items-center justify-between")}>
        <p className="text-sm text-muted-foreground">
          {conversations.length > 0
            ? `${conversations.length} active conversation${conversations.length === 1 ? "" : "s"}`
            : "No active conversations"}
        </p>
        <StatusPill status={status} />
      </div>

      {conversations.length > 0 ? (
        <ul className="space-y-2">
          {conversations.map((conversation, i) => (
            <ConversationCard
              key={conversation.id}
              conversation={conversation}
              lastMessage={lastMessage.get(conversation.id)}
              index={i}
            />
          ))}
        </ul>
      ) : status === "connecting" ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Spinner className="size-4" /> Connecting to the live feed…
        </div>
      ) : (
        <EmptyState
          icon={MessagesSquare}
          title="No active conversations"
          description="When a customer starts chatting with your widget, it shows up here in realtime."
        />
      )}
    </div>
  );
}
