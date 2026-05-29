import { and, desc, eq, ne } from 'drizzle-orm';
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
