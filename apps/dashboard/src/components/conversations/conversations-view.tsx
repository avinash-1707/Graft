"use client";

import { useState } from "react";
import { MessagesSquare } from "lucide-react";

import { useOrgFeed, type FeedStatus } from "@/lib/hooks/use-org-feed";
import { useChatSocket } from "@/lib/hooks/use-chat-socket";
import { useMe } from "@/lib/auth/use-auth";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/common/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { ConversationCard } from "./conversation-card";
import { ConversationDetail } from "./conversation-detail";

const STATUS_LABEL: Record<FeedStatus, string> = {
  connecting: "Connecting",
  live: "Live",
  reconnecting: "Reconnecting",
};

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
 * Master–detail live conversations workspace (units 27 + 28). The left pane is the
 * realtime feed (org-feed SSE); selecting a card opens the right pane — the live thread
 * (chat-service WS) with claim, reply, handback, and internal notes. On narrow screens
 * the panes swap (list ↔ detail); on wide screens they sit side by side.
 */
export function ConversationsView() {
  const { conversations, lastMessage, status } = useOrgFeed();
  const socket = useChatSocket();
  const me = useMe();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const meIdentity = me.data ? { id: me.data.id, organizationId: me.data.organizationId } : null;

  function select(id: string) {
    setSelectedId(id);
    socket.open(id);
  }

  return (
    <div className="lg:grid lg:h-[calc(100dvh-9rem)] lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-6">
      {/* List pane */}
      <div className={cn("flex flex-col gap-4 lg:min-h-0", selectedId ? "hidden lg:flex" : "flex")}>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {conversations.length > 0
              ? `${conversations.length} active`
              : "No active conversations"}
          </p>
          <StatusPill status={status} />
        </div>

        {conversations.length > 0 ? (
          <ul className="space-y-2 lg:flex-1 lg:overflow-y-auto lg:pr-1">
            {conversations.map((conversation, i) => (
              <ConversationCard
                key={conversation.id}
                conversation={conversation}
                lastMessage={lastMessage.get(conversation.id)}
                index={i}
                selected={conversation.id === selectedId}
                onSelect={() => select(conversation.id)}
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

      {/* Detail pane */}
      <div
        className={cn(
          "h-[calc(100dvh-9rem)] lg:h-auto lg:min-h-0",
          selectedId ? "block" : "hidden lg:block",
        )}
      >
        {selected && meIdentity ? (
          <ConversationDetail
            key={selected.id}
            conversation={selected}
            me={meIdentity}
            socket={socket}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
            Select a conversation to view the thread.
          </div>
        )}
      </div>
    </div>
  );
}
