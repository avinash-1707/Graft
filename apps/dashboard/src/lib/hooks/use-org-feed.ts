"use client";

import { useEffect, useMemo, useState } from "react";
import type { Message, OrgFeedConversation, OrgFeedEvent } from "@graft/shared";

import { connectOrgFeed } from "@/lib/api/org-feed";

export type FeedStatus = "connecting" | "live" | "reconnecting";

interface FeedState {
  conversations: Map<string, OrgFeedConversation>;
  lastMessage: Map<string, Message>;
  status: FeedStatus;
}

export interface OrgFeed {
  /** Active conversations, most-recent activity first. */
  conversations: OrgFeedConversation[];
  /** The latest message seen per conversation (preview under the card). */
  lastMessage: Map<string, Message>;
  status: FeedStatus;
}

const INITIAL: FeedState = {
  conversations: new Map(),
  lastMessage: new Map(),
  status: "connecting",
};

/** Reconnect backoff: exponential to a 15s ceiling, with jitter to avoid a thundering herd. */
function backoffMs(attempt: number): number {
  const base = Math.min(1000 * 2 ** attempt, 15_000);
  return base / 2 + Math.random() * (base / 2);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/**
 * Subscribes to the org-feed SSE (unit 27) and reduces its events into a live view of
 * the organization's active conversations. Opens on mount, reconnects with backoff if
 * the stream drops, and re-snapshots on each (re)connect so a momentary gap self-heals.
 * Read-only — the dashboard observes; claiming/replying arrive in unit 28.
 */
export function useOrgFeed(): OrgFeed {
  const [state, setState] = useState<FeedState>(INITIAL);

  useEffect(() => {
    const controller = new AbortController();
    let stopped = false;
    let attempt = 0;

    const onEvent = (event: OrgFeedEvent): void => {
      setState((prev) => {
        const conversations = new Map(prev.conversations);
        const lastMessage = new Map(prev.lastMessage);

        if (event.type === "snapshot") {
          // The snapshot is the authoritative active set: drop anything no longer in it
          // (e.g. a conversation that closed while we were disconnected).
          conversations.clear();
          for (const c of event.conversations) conversations.set(c.id, c);
          for (const id of [...lastMessage.keys()]) {
            if (!conversations.has(id)) lastMessage.delete(id);
          }
        } else if (event.type === "conversation_upsert") {
          conversations.set(event.conversation.id, event.conversation);
        } else {
          lastMessage.set(event.conversationId, event.message);
          // Keep the card's activity timestamp / sequence in step with the new message.
          const conv = conversations.get(event.conversationId);
          if (conv) {
            conversations.set(event.conversationId, {
              ...conv,
              lastSequence: Math.max(conv.lastSequence, event.message.sequence),
              updatedAt: event.message.createdAt,
            });
          }
        }

        return { conversations, lastMessage, status: prev.status };
      });
    };

    void (async () => {
      while (!stopped) {
        setState((prev) => ({ ...prev, status: attempt === 0 ? "connecting" : "reconnecting" }));
        try {
          await connectOrgFeed({
            signal: controller.signal,
            onOpen: () => {
              attempt = 0;
              setState((prev) => ({ ...prev, status: "live" }));
            },
            onEvent,
          });
        } catch {
          // connect/stream error — fall through to backoff + retry
        }
        if (stopped || controller.signal.aborted) return;
        attempt += 1;
        await sleep(backoffMs(attempt), controller.signal);
      }
    })();

    return () => {
      stopped = true;
      controller.abort();
    };
  }, []);

  const conversations = useMemo(
    () =>
      [...state.conversations.values()].sort(
        (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
      ),
    [state.conversations],
  );

  return { conversations, lastMessage: state.lastMessage, status: state.status };
}
