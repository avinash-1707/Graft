import type { ConversationState } from "@graft/shared";

import { cn } from "@/lib/utils";

const STATE_STYLES: Record<ConversationState, string> = {
  AI_ACTIVE: "bg-accent text-accent-foreground",
  ESCALATION_PENDING: "bg-destructive/10 text-destructive",
  AGENT_ASSIGNED: "bg-primary/10 text-primary",
  HUMAN_ACTIVE: "bg-success/10 text-success",
  CLOSED: "bg-muted text-muted-foreground",
};

const STATE_LABELS: Record<ConversationState, string> = {
  AI_ACTIVE: "AI handling",
  ESCALATION_PENDING: "Needs agent",
  AGENT_ASSIGNED: "Agent assigned",
  HUMAN_ACTIVE: "With agent",
  CLOSED: "Closed",
};

/**
 * Conversation-state pill for the live feed. Static by design — the state is a durable
 * fact, not in-progress work, so there is no spinner or looping attention motion;
 * colour carries the urgency (ESCALATION_PENDING reads as the destructive tone).
 */
export function StateBadge({ state }: { state: ConversationState }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATE_STYLES[state],
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      {STATE_LABELS[state]}
    </span>
  );
}
