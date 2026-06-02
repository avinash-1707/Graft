import {
  appendMessage,
  getConversationForOrg,
  handbackToAi,
  listMessagesAfter,
  transitionToHumanActive,
  type Database,
  type MessageRow,
} from '@graft/db';
import type { Logger, Metrics } from '@graft/observability';
import {
  ConversationState,
  messageSchema,
  MessageRole,
  Transport,
  TRANSPORT_SWITCH_COPY,
  type ChatActionError,
  type Message,
  type Transport as TransportType,
} from '@graft/shared';
import type { ChatIdentity } from '../realtime/auth.js';

/** A state transition the socket layer must announce to the room after a send. */
export interface SwitchEffect {
  state: ConversationState;
  transport: TransportType;
  customerFacingCopy: string;
}

export type SendMessageResult =
  | { ok: true; message: Message; deduped: boolean; switch?: SwitchEffect }
  | { ok: false; reason: ChatActionError };

export type HandbackResult =
  | { ok: true; switch: SwitchEffect }
  | { ok: false; reason: ChatActionError };

export interface MessagingServiceDeps {
  db: Database;
  metrics: Metrics;
  logger: Logger;
}

function toMessage(row: MessageRow): Message {
  return messageSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    conversationId: row.conversationId,
    sequence: row.sequence,
    role: row.role,
    content: row.content,
    senderAgentId: row.senderAgentId,
    createdAt: row.createdAt.toISOString(),
  });
}

/** A human-chat message is only valid while a human controls the conversation. */
function isHumanPhase(state: ConversationState): boolean {
  return state === ConversationState.AGENT_ASSIGNED || state === ConversationState.HUMAN_ACTIVE;
}

/**
 * Owns the human-chat turn (unit 20): persist agent↔customer messages with the
 * per-conversation monotonic sequence (invariant 11, via `appendMessage`), the
 * AGENT_ASSIGNED→HUMAN_ACTIVE transition on the agent's first message, handback to
 * the AI, and the reconnect replay load. State guards keep exactly one responder
 * (invariant 3): the customer talks to the AI over SSE while AI_ACTIVE, and only
 * over this WS while a human controls the conversation. Persistence + transitions
 * live here; the socket layer owns room fan-out of the returned effects.
 */
export class MessagingService {
  constructor(private readonly deps: MessagingServiceDeps) {}

  async sendMessage(input: {
    organizationId: string;
    conversationId: string;
    identity: ChatIdentity;
    content: string;
    clientNonce?: string;
  }): Promise<SendMessageResult> {
    const { db } = this.deps;
    const conv = await getConversationForOrg(db, input.conversationId, input.organizationId);
    if (!conv) return { ok: false, reason: 'NOT_FOUND' };
    if (!isHumanPhase(conv.state)) return { ok: false, reason: 'INVALID_STATE' };

    let switchEffect: SwitchEffect | undefined;

    if (input.identity.kind === 'CUSTOMER') {
      // A customer may only post to its own conversation (invariant 1).
      if (conv.sessionId !== input.identity.sessionId) return { ok: false, reason: 'FORBIDDEN' };
      const { message, deduped } = await appendMessage(db, {
        organizationId: input.organizationId,
        conversationId: input.conversationId,
        role: MessageRole.CUSTOMER,
        content: input.content,
        clientNonce: input.clientNonce ?? null,
      });
      return { ok: true, message: toMessage(message), deduped };
    }

    // AGENT: only the assigned agent may speak (invariant 2 — one responder).
    if (conv.assignedAgentId !== input.identity.agentId) return { ok: false, reason: 'FORBIDDEN' };

    // First agent message flips AGENT_ASSIGNED → HUMAN_ACTIVE (atomic; only one flips).
    if (conv.state === ConversationState.AGENT_ASSIGNED) {
      const transitioned = await transitionToHumanActive(
        db,
        input.conversationId,
        input.organizationId,
        input.identity.agentId,
      );
      if (transitioned) {
        this.deps.metrics.conversationStateTransitions.inc({
          from: ConversationState.AGENT_ASSIGNED,
          to: ConversationState.HUMAN_ACTIVE,
          trigger: '',
        });
        switchEffect = {
          state: ConversationState.HUMAN_ACTIVE,
          transport: Transport.WEBSOCKET,
          customerFacingCopy: TRANSPORT_SWITCH_COPY.toHuman,
        };
      }
    }

    const { message, deduped } = await appendMessage(db, {
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      role: MessageRole.AGENT,
      content: input.content,
      senderAgentId: input.identity.agentId,
      clientNonce: input.clientNonce ?? null,
    });
    return {
      ok: true,
      message: toMessage(message),
      deduped,
      ...(switchEffect ? { switch: switchEffect } : {}),
    };
  }

  async handback(input: {
    organizationId: string;
    conversationId: string;
    agentId: string;
  }): Promise<HandbackResult> {
    const { db } = this.deps;
    const conv = await getConversationForOrg(db, input.conversationId, input.organizationId);
    if (!conv) return { ok: false, reason: 'NOT_FOUND' };
    if (conv.assignedAgentId !== input.agentId) return { ok: false, reason: 'FORBIDDEN' };
    if (conv.state !== ConversationState.HUMAN_ACTIVE)
      return { ok: false, reason: 'INVALID_STATE' };

    const row = await handbackToAi(db, input.conversationId, input.organizationId, input.agentId);
    if (!row) return { ok: false, reason: 'INVALID_STATE' };

    this.deps.metrics.conversationStateTransitions.inc({
      from: ConversationState.HUMAN_ACTIVE,
      to: ConversationState.AI_ACTIVE,
      trigger: '',
    });
    return {
      ok: true,
      switch: {
        state: ConversationState.AI_ACTIVE,
        transport: Transport.SSE,
        customerFacingCopy: TRANSPORT_SWITCH_COPY.toAi,
      },
    };
  }

  /**
   * Reconnect/(re)join replay (invariant 11): messages newer than `afterSequence`,
   * oldest-first. SYSTEM events are withheld from the customer (invariant 8); the
   * agent dashboard sees the full history.
   */
  async getReplay(input: {
    organizationId: string;
    conversationId: string;
    afterSequence: number;
    forCustomer: boolean;
  }): Promise<Message[]> {
    const rows = await listMessagesAfter(
      this.deps.db,
      input.conversationId,
      input.organizationId,
      input.afterSequence,
    );
    const visible = input.forCustomer ? rows.filter((r) => r.role !== MessageRole.SYSTEM) : rows;
    return visible.map(toMessage);
  }
}
