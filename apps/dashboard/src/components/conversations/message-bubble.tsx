import type { Message } from "@graft/shared";

import { cn } from "@/lib/utils";
import { messageTime, roleLabel } from "./format";

/**
 * One message in the thread. The customer is the other party (left, neutral); the AI
 * and agent are the support side (right, tinted — AI accent, agent brand). SYSTEM lines
 * (transport switches, etc.) are centered meta, not bubbles.
 */
export function MessageBubble({ message }: { message: Message }) {
  if (message.role === "SYSTEM") {
    return (
      <li className="my-1 text-center text-xs text-muted-foreground">{message.content}</li>
    );
  }

  const isSupport = message.role === "AI" || message.role === "AGENT";

  return (
    <li className={cn("flex flex-col gap-1", isSupport ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words",
          message.role === "CUSTOMER" && "rounded-bl-sm bg-muted text-foreground",
          message.role === "AI" && "rounded-br-sm bg-accent text-accent-foreground",
          message.role === "AGENT" && "rounded-br-sm bg-primary text-primary-foreground",
        )}
      >
        {message.content}
      </div>
      <span className="px-1 text-[0.7rem] text-muted-foreground">
        {roleLabel(message.role)} · {messageTime(message.createdAt)}
      </span>
    </li>
  );
}
