import { claimConversation, getConversationForOrg, type Database } from '@graft/db';
import type { Logger, Metrics } from '@graft/observability';
import { claimResultSchema, ConversationState, type ClaimResult } from '@graft/shared';
import type { AiAbortPublisher } from '../realtime/ai-bus.js';

export interface ClaimInput {
  organizationId: string;
  agentId: string;
  conversationId: string;
}

export interface ClaimServiceDeps {
  db: Database;
  metrics: Metrics;
  abortPublisher: AiAbortPublisher;
  logger: Logger;
}

/**
 * Owns the agent claim flow (unit 19): the atomic compare-and-set (invariant 2), the
 * cross-instance abort that cancels any in-flight AI generation (invariant 12), and
 * the state-transition metric. The CAS in `claimConversation` is the single source of
 * truth for who wins; this service classifies a miss into a client-facing reason and,
 * on a win, fires the abort + metric. The room broadcast lives in the socket layer.
 */
export class ClaimService {
  constructor(private readonly deps: ClaimServiceDeps) {}

  async claim(input: ClaimInput): Promise<ClaimResult> {
    const { db, metrics, abortPublisher, logger } = this.deps;

    const claimed = await claimConversation(
      db,
      input.conversationId,
      input.organizationId,
      input.agentId,
    );

    if (!claimed) {
      return { ok: false, reason: await this.classifyMiss(input) };
    }

    metrics.conversationStateTransitions.inc({
      from: claimed.previousState,
      to: claimed.state,
      // No escalation trigger for a proactive AI_ACTIVE takeover; otherwise record the
      // trigger that put the conversation into ESCALATION_PENDING.
      trigger: claimed.escalationTrigger ?? '',
    });

    // Takeover aborts in-flight AI generation regardless of which state it came from —
    // a proactive takeover from AI_ACTIVE may interrupt a live stream (invariant 12).
    try {
      await abortPublisher.publishAbort(input.conversationId);
    } catch (err) {
      // The claim is already durable; a failed abort must not fail the claim. ai-service
      // still stops streaming on the next persisted state read, but log the degradation.
      logger.error(
        { err, conversationId: input.conversationId },
        'failed to publish takeover abort',
      );
    }

    logger.info(
      {
        conversationId: input.conversationId,
        agentId: input.agentId,
        from: claimed.previousState,
      },
      'conversation claimed',
    );

    // Parse to apply the branded id types (conversation/agent ids are plain strings
    // out of the DB CAS); the values are already validated by the time they get here.
    return claimResultSchema.parse({
      ok: true,
      conversationId: claimed.conversationId,
      assignedAgentId: claimed.assignedAgentId,
      state: claimed.state,
    });
  }

  /** Turns a lost/failed CAS into a precise reason via a follow-up tenant-scoped read. */
  private async classifyMiss(
    input: ClaimInput,
  ): Promise<Extract<ClaimResult, { ok: false }>['reason']> {
    const conversation = await getConversationForOrg(
      this.deps.db,
      input.conversationId,
      input.organizationId,
    );
    if (!conversation) return 'NOT_FOUND';
    if (
      conversation.assignedAgentId !== null ||
      conversation.state === ConversationState.AGENT_ASSIGNED ||
      conversation.state === ConversationState.HUMAN_ACTIVE
    ) {
      return 'ALREADY_CLAIMED';
    }
    // CLOSED, or a transient race that left it AI_ACTIVE/ESCALATION_PENDING again.
    return 'INVALID_STATE';
  }
}
