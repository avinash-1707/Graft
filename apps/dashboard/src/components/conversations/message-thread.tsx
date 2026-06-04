"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@graft/shared";

import { MessageBubble } from "./message-bubble";

/**
 * Scrollable message thread. Auto-scrolls to the newest message when the count grows
 * (a new bubble), but not on unrelated re-renders, so reading older history isn't
 * yanked away. Shows a typing line for the customer when they're composing.
 */
export function MessageThread({
  messages,
  customerTyping,
}: {
  messages: Message[];
  customerTyping: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const count = messages.length;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [count, customerTyping]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {count === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No messages yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {messages.map((m) => (
            <MessageBubble key={`${m.conversationId}:${m.sequence}`} message={m} />
          ))}
        </ul>
      )}
      {customerTyping ? (
        <p className="mt-3 text-xs text-muted-foreground">Customer is typing…</p>
      ) : null}
      <div ref={endRef} />
    </div>
  );
}
