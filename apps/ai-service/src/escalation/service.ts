import { toOrgFeedConversation, transitionToEscalationPending, type Database } from '@graft/db';
import type { Metrics } from '@graft/observability';
import { ConversationState, type EscalationTrigger } from '@graft/shared';
import type { EventBus } from '../realtime/event-bus.js';
import { escalationStateChangedEvent } from '../realtime/events.js';

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
 * (invariant 2), the state-transition metric, and the cross-instance `state_changed`
 * publish on the realtime bus. Used by BOTH the request handler (inline triggers:
 * weak grounding, provider failure, model-invoked) and the analysis worker
 * (classifier triggers) — the compare-and-set guarantees only one writer wins, so
 * publishing only on a real transition means exactly one delivery per escalation.
 * The bus delivers the event to whichever instance holds the customer's SSE (the
 * worker is a separate process), closing unit 17's B-hybrid cross-instance gap; the
 * transition itself is durable regardless of whether a connection is currently held.
 */
export class EscalationService {
  constructor(
    private readonly db: Database,
    private readonly metrics: Metrics,
    private readonly bus: EventBus,
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
    await this.bus.publishEvent(
      input.conversationId,
      escalationStateChangedEvent(input.conversationId, input.trigger),
    );
    // Reflect the new state on the dashboard live feed (unit 27). Published from the
    // single transition site, so both inline and worker escalations surface exactly once.
    await this.bus.publishOrgFeed(input.organizationId, {
      type: 'conversation_upsert',
      conversation: toOrgFeedConversation(row),
    });
    return { transitioned: true };
  }
}
