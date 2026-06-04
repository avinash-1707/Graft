import type { EscalationTrigger, Message, OrgFeedConversation } from "@graft/shared";
import { MessageCircle } from "lucide-react";

import { StateBadge } from "./state-badge";
import { relativeTime, roleLabel, sessionLabel } from "./format";

const TRIGGER_LABELS: Record<EscalationTrigger, string> = {
  THIRD_HUMAN_REQUEST: "Repeated requests for a human",
  WEAK_GROUNDING: "Low-confidence answer",
  MODEL_INVOKED: "AI asked for a human",
  NEGATIVE_SENTIMENT: "Customer seems frustrated",
  PROVIDER_FAILURE: "AI provider error",
};

/**
 * One conversation in the live feed: who, current state, the latest exchange line, and
 * when it last moved. `index` drives a one-shot entrance stagger; the card is keyed by
 * conversation id upstream, so streaming updates re-render in place without re-animating.
 */
export function ConversationCard({
  conversation,
  lastMessage,
  index,
}: {
  conversation: OrgFeedConversation;
  lastMessage: Message | undefined;
  index: number;
}) {
  return (
    <li
      className="rise-in rounded-lg border border-border bg-card p-4 transition-colors hover:border-input"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <MessageCircle className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{sessionLabel(conversation.sessionId)}</p>
            {conversation.state === "ESCALATION_PENDING" && conversation.escalationTrigger ? (
              <p className="truncate text-xs text-destructive">
                {TRIGGER_LABELS[conversation.escalationTrigger]}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {conversation.lastSequence} message{conversation.lastSequence === 1 ? "" : "s"}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StateBadge state={conversation.state} />
          <span className="text-xs text-muted-foreground">{relativeTime(conversation.updatedAt)}</span>
        </div>
      </div>

      {lastMessage ? (
        <p className="mt-3 line-clamp-2 border-t border-border/60 pt-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{roleLabel(lastMessage.role)}:</span>{" "}
          {lastMessage.content}
        </p>
      ) : null}
    </li>
  );
}
