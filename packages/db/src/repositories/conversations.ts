import { and, desc, eq, ne, sql } from 'drizzle-orm';
import type { EscalationTrigger } from '@graft/shared';
import type { Database } from '../client.js';
import { conversations } from '../schema/conversations.js';

export type ConversationRow = typeof conversations.$inferSelect;

export interface CreateConversationInput {
  organizationId: string;
  sessionId: string;
}

/** Starts a new conversation for a session. State defaults to AI_ACTIVE. */
export async function createConversation(
  db: Database,
  input: CreateConversationInput,
): Promise<ConversationRow> {
  const [row] = await db
    .insert(conversations)
    .values({ organizationId: input.organizationId, sessionId: input.sessionId })
    .returning();
  if (!row) throw new Error('failed to create conversation');
  return row;
}

/** Returns the conversation only if it exists AND belongs to the org (tenant guard). */
export async function getConversationForOrg(
  db: Database,
  id: string,
  organizationId: string,
): Promise<ConversationRow | undefined> {
  return db.query.conversations.findFirst({
    where: and(eq(conversations.id, id), eq(conversations.organizationId, organizationId)),
  });
}

/**
 * The session's most recent non-CLOSED conversation — the resume target when a
 * returning customer reconnects. A session has at most one such conversation in
 * normal flow; ordering by `createdAt` desc is a safety net.
 */
export async function findActiveConversationBySession(
  db: Database,
  sessionId: string,
  organizationId: string,
): Promise<ConversationRow | undefined> {
  return db.query.conversations.findFirst({
    where: and(
      eq(conversations.sessionId, sessionId),
      eq(conversations.organizationId, organizationId),
      ne(conversations.state, 'CLOSED'),
    ),
    orderBy: desc(conversations.createdAt),
  });
}

/**
 * Atomically increments the conversation's running human-request count and returns
 * the new value (tenant-scoped). Used by the escalation engine to detect the Nth
 * explicit "talk to a human" request across turns.
 */
export async function incrementHumanRequestCount(
  db: Database,
  conversationId: string,
  organizationId: string,
): Promise<number | undefined> {
  const [row] = await db
    .update(conversations)
    .set({ humanRequestCount: sql`${conversations.humanRequestCount} + 1`, updatedAt: new Date() })
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.organizationId, organizationId),
      ),
    )
    .returning({ humanRequestCount: conversations.humanRequestCount });
  return row?.humanRequestCount;
}

/**
 * Atomic compare-and-set escalation transition (invariant 2): flips AI_ACTIVE →
 * ESCALATION_PENDING and records the trigger, only if the conversation is still
 * AI_ACTIVE. Returns the updated row, or undefined when it was no longer AI_ACTIVE
 * (an agent already took over, or another path already escalated) — so concurrent
 * escalations and a takeover can never both win. Tenant-scoped.
 */
export async function transitionToEscalationPending(
  db: Database,
  conversationId: string,
  organizationId: string,
  trigger: EscalationTrigger,
): Promise<ConversationRow | undefined> {
  const [row] = await db
    .update(conversations)
    .set({ state: 'ESCALATION_PENDING', escalationTrigger: trigger, updatedAt: new Date() })
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.organizationId, organizationId),
        eq(conversations.state, 'AI_ACTIVE'),
      ),
    )
    .returning();
  return row;
}
