import { and, asc, eq } from 'drizzle-orm';
import { internalNoteSchema, type InternalNote } from '@graft/shared';
import type { Database } from '../client.js';
import { internalNotes } from '../schema/internal-notes.js';

export type InternalNoteRow = typeof internalNotes.$inferSelect;

function toInternalNote(row: InternalNoteRow): InternalNote {
  return internalNoteSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    conversationId: row.conversationId,
    authorAgentId: row.authorAgentId,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  });
}

export interface CreateInternalNoteInput {
  organizationId: string;
  conversationId: string;
  authorAgentId: string;
  content: string;
}

/** Records an agent-only internal note on a conversation (unit 28). */
export async function createInternalNote(
  db: Database,
  input: CreateInternalNoteInput,
): Promise<InternalNote> {
  const [row] = await db
    .insert(internalNotes)
    .values({
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      authorAgentId: input.authorAgentId,
      content: input.content,
    })
    .returning();
  if (!row) throw new Error('failed to create internal note');
  return toInternalNote(row);
}

/**
 * Notes for a conversation, oldest-first. Tenant-scoped: the org predicate plus the
 * conversation id, so a note never leaks across organizations (invariant 1).
 */
export async function listInternalNotesByConversation(
  db: Database,
  conversationId: string,
  organizationId: string,
): Promise<InternalNote[]> {
  const rows = await db.query.internalNotes.findMany({
    where: and(
      eq(internalNotes.conversationId, conversationId),
      eq(internalNotes.organizationId, organizationId),
    ),
    orderBy: asc(internalNotes.createdAt),
  });
  return rows.map(toInternalNote);
}
