import type { MessageRole } from '@graft/shared';
import { and, asc, eq, gt } from 'drizzle-orm';
import type { Database } from '../client.js';
import { conversations } from '../schema/conversations.js';
import { messages } from '../schema/messages.js';

export type MessageRow = typeof messages.$inferSelect;

/** Thrown by {@link appendMessage} when the conversation does not exist for the org. */
export class ConversationNotFoundError extends Error {
  constructor(conversationId: string) {
    super(`conversation not found: ${conversationId}`);
    this.name = 'ConversationNotFoundError';
  }
}

export interface AppendMessageInput {
  organizationId: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  /** Set for AGENT messages; null for CUSTOMER/AI/SYSTEM. */
  senderAgentId?: string | null;
  /** Client-supplied idempotency key (CUSTOMER turns); enables dedup on replay. */
  clientNonce?: string | null;
  groundingScore?: number | null;
  sentimentScore?: number | null;
}

export interface AppendMessageResult {
  message: MessageRow;
  /** True when a prior message with the same clientNonce was returned (idempotent replay). */
  deduped: boolean;
}

/**
 * Appends a message with the next per-conversation monotonic sequence number,
 * atomically and idempotently (invariant: per-conversation monotonic sequence with
 * no loss/dup across reconnect/transport switch).
 *
 * The conversation row is locked `FOR UPDATE` for the duration of the transaction,
 * so concurrent appends to the same conversation serialize — no sequence races and
 * no gaps. If a `clientNonce` is supplied and a message with that nonce already
 * exists on the conversation, the existing row is returned unchanged (`deduped`),
 * making customer-message submission safe to retry. Different conversations never
 * block each other. The org id is part of the lock predicate (tenant guard).
 */
export async function appendMessage(
  db: Database,
  input: AppendMessageInput,
): Promise<AppendMessageResult> {
  return db.transaction(async (tx) => {
    const [conv] = await tx
      .select({ lastSequence: conversations.lastSequence })
      .from(conversations)
      .where(
        and(
          eq(conversations.id, input.conversationId),
          eq(conversations.organizationId, input.organizationId),
        ),
      )
      .for('update');
    if (!conv) throw new ConversationNotFoundError(input.conversationId);

    if (input.clientNonce != null) {
      const existing = await tx.query.messages.findFirst({
        where: and(
          eq(messages.conversationId, input.conversationId),
          eq(messages.clientNonce, input.clientNonce),
        ),
      });
      if (existing) return { message: existing, deduped: true };
    }

    const sequence = conv.lastSequence + 1;
    await tx
      .update(conversations)
      .set({ lastSequence: sequence, updatedAt: new Date() })
      .where(eq(conversations.id, input.conversationId));

    const [row] = await tx
      .insert(messages)
      .values({
        organizationId: input.organizationId,
        conversationId: input.conversationId,
        sequence,
        role: input.role,
        content: input.content,
        senderAgentId: input.senderAgentId ?? null,
        clientNonce: input.clientNonce ?? null,
        groundingScore: input.groundingScore ?? null,
        sentimentScore: input.sentimentScore ?? null,
      })
      .returning();
    if (!row) throw new Error('failed to insert message');
    return { message: row, deduped: false };
  });
}

/** Full conversation history, oldest-first (resume/load). Tenant-scoped. */
export async function listMessages(
  db: Database,
  conversationId: string,
  organizationId: string,
): Promise<MessageRow[]> {
  return db
    .select()
    .from(messages)
    .where(
      and(eq(messages.conversationId, conversationId), eq(messages.organizationId, organizationId)),
    )
    .orderBy(asc(messages.sequence));
}

/**
 * Messages with `sequence > afterSequence`, oldest-first — the reconnect replay
 * batch (client tells us the last sequence it has; we send everything since).
 */
export async function listMessagesAfter(
  db: Database,
  conversationId: string,
  organizationId: string,
  afterSequence: number,
): Promise<MessageRow[]> {
  return db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.organizationId, organizationId),
        gt(messages.sequence, afterSequence),
      ),
    )
    .orderBy(asc(messages.sequence));
}
