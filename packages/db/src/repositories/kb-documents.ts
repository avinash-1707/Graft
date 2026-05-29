import { eq } from 'drizzle-orm';
import type { KbDocumentType } from '@graft/shared';
import type { Database } from '../client.js';
import { kbDocuments } from '../schema/kb-documents.js';

export type KbDocumentRow = typeof kbDocuments.$inferSelect;

export interface CreateKbDocumentInput {
  /** Client-generated UUID so the storage object key is known before the row exists. */
  id: string;
  organizationId: string;
  filename: string;
  fileType: KbDocumentType;
  byteSize: number;
  /** User who uploaded it; nullable (set null if that user is later removed). */
  uploadedByAgentId?: string;
}

/** Inserts a KB document in PENDING status. */
export async function createKbDocument(
  db: Database,
  input: CreateKbDocumentInput,
): Promise<KbDocumentRow> {
  const [row] = await db
    .insert(kbDocuments)
    .values({
      id: input.id,
      organizationId: input.organizationId,
      filename: input.filename,
      fileType: input.fileType,
      byteSize: input.byteSize,
      ...(input.uploadedByAgentId ? { uploadedByAgentId: input.uploadedByAgentId } : {}),
    })
    .returning();
  if (!row) throw new Error('failed to create kb document');
  return row;
}

/** Marks a document FAILED with an error message (e.g. staging or enqueue failure). */
export async function markKbDocumentFailed(
  db: Database,
  id: string,
  error: string,
): Promise<void> {
  await db
    .update(kbDocuments)
    .set({ status: 'FAILED', error, processedAt: new Date() })
    .where(eq(kbDocuments.id, id));
}
