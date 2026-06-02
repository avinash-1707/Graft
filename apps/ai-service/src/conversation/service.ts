import {
  appendMessage,
  createConversation,
  findActiveConversationBySession,
  getConversationForOrg,
  listMessages,
  listMessagesAfter,
  type AppendMessageInput,
  type ConversationRow,
  type Database,
  type MessageRow,
} from '@graft/db';
import {
  conversationSchema,
  messageSchema,
  type Conversation,
  type Message,
} from '@graft/shared';

function toConversation(row: ConversationRow): Conversation {
  return conversationSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    sessionId: row.sessionId,
    state: row.state,
    assignedAgentId: row.assignedAgentId,
    escalationTrigger: row.escalationTrigger,
    lastSequence: row.lastSequence,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
  });
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

export interface AppendMessageOutput {
  message: Message;
  /** True when an idempotent replay returned the prior message rather than inserting. */
  deduped: boolean;
}

/**
 * Conversation persistence + per-conversation monotonic sequencing for ai-service.
 * Owns create/resume by session UUID, idempotent message append, and history /
 * reconnect-replay loads. All operations are tenant-scoped by `organizationId`;
 * rows are projected to the shared contract shapes before crossing the boundary.
 */
export class ConversationService {
  constructor(private readonly db: Database) {}

  /**
   * Resumes the session's active (non-CLOSED) conversation, or starts a new one.
   * The session must already be validated against the org by the caller (the
   * widget-auth path); this method does not re-check session ownership.
   */
  async getOrCreateConversation(organizationId: string, sessionId: string): Promise<Conversation> {
    const existing = await findActiveConversationBySession(this.db, sessionId, organizationId);
    const row = existing ?? (await createConversation(this.db, { organizationId, sessionId }));
    return toConversation(row);
  }

  /**
   * Resolves the session's active (non-CLOSED) conversation without creating one.
   * Used by the widget resume read (`GET /widget/conversation`) — a fresh session
   * returns undefined rather than minting an empty conversation on a mere page load.
   */
  async findActiveConversation(
    organizationId: string,
    sessionId: string,
  ): Promise<Conversation | undefined> {
    const row = await findActiveConversationBySession(this.db, sessionId, organizationId);
    return row ? toConversation(row) : undefined;
  }

  /** Loads a conversation by id within the org, or undefined if not found. */
  async getConversation(
    organizationId: string,
    conversationId: string,
  ): Promise<Conversation | undefined> {
    const row = await getConversationForOrg(this.db, conversationId, organizationId);
    return row ? toConversation(row) : undefined;
  }

  /** Appends a message with the next monotonic sequence (atomic + idempotent). */
  async appendMessage(input: AppendMessageInput): Promise<AppendMessageOutput> {
    const { message, deduped } = await appendMessage(this.db, input);
    return { message: toMessage(message), deduped };
  }

  /** Full history oldest-first (resume). */
  async getHistory(organizationId: string, conversationId: string): Promise<Message[]> {
    const rows = await listMessages(this.db, conversationId, organizationId);
    return rows.map(toMessage);
  }

  /** Reconnect replay: messages with `sequence > afterSequence`, oldest-first. */
  async getReplayAfter(
    organizationId: string,
    conversationId: string,
    afterSequence: number,
  ): Promise<Message[]> {
    const rows = await listMessagesAfter(this.db, conversationId, organizationId, afterSequence);
    return rows.map(toMessage);
  }
}
