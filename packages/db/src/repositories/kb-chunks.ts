import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { kbChunks } from '../schema/kb-chunks.js';

export interface KbChunkInsert {
  chunkIndex: number;
  content: string;
  /** Embedding vector; length must match the column dimension (1536). */
  embedding: number[];
}

/**
 * Replaces all chunks for a document atomically: deletes existing rows then
 * inserts the new set. Makes worker re-processing idempotent (a retried job
 * leaves exactly one set of chunks, never duplicates).
 */
export async function replaceKbChunks(
  db: Database,
  params: { organizationId: string; documentId: string; chunks: KbChunkInsert[] },
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(kbChunks).where(eq(kbChunks.documentId, params.documentId));
    if (params.chunks.length === 0) return;
    await tx.insert(kbChunks).values(
      params.chunks.map((chunk) => ({
        organizationId: params.organizationId,
        documentId: params.documentId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        embedding: chunk.embedding,
      })),
    );
  });
}
