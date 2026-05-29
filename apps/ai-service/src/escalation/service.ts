import { transitionToEscalationPending, type Database } from '@graft/db';
import type { Metrics } from '@graft/observability';
import { ConversationState, type EscalationTrigger } from '@graft/shared';

export interface EscalateInput {
  organizationId: string;
  conversationId: string;
  trigger: EscalationTrigger;
}

export interface EscalateResult {
  /** True when THIS call performed the AI_ACTIVE → ESCALATION_PENDING transition. */
  transitioned: boolean;
}

/**
 * Applies an escalation: the atomic AI_ACTIVE → ESCALATION_PENDING compare-and-set
 * (invariant 2) plus the state-transition metric. Used by BOTH the request handler
 * (inline triggers: weak grounding, provider failure, model-invoked) and the
 * analysis worker (classifier triggers: negative sentiment, 3rd human request) —
 * the compare-and-set guarantees only one writer wins, so concurrent escalations or
 * an agent takeover never double-transition. The caller emits the live
 * `state_changed` SSE event when it holds the customer's connection (B-hybrid); the
 * transition itself is durable regardless.
 */
export class EscalationService {
  constructor(
    private readonly db: Database,
    private readonly metrics: Metrics,
  ) {}

  async escalate(input: EscalateInput): Promise<EscalateResult> {
    const row = await transitionToEscalationPending(
      this.db,
      input.conversationId,
      input.organizationId,
      input.trigger,
    );
    if (!row) return { transitioned: false };

    this.metrics.conversationStateTransitions.inc({
      from: ConversationState.AI_ACTIVE,
      to: ConversationState.ESCALATION_PENDING,
      trigger: input.trigger,
    });
    return { transitioned: true };
  }
}
