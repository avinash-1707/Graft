import type { Database } from '@graft/db';
import { sql } from 'drizzle-orm';
import { EMBEDDING_DIMENSIONS } from './embedding.js';

/**
 * Tenant-scoped filtered approximate-nearest-neighbour retrieval over pgvector.
 * Every query filters by `organization_id` BEFORE the HNSW similarity search —
 * absolute tenant isolation, no shared/global KB. Filtered ANN can lose recall,
 * so we run inside a transaction with `hnsw.iterative_scan = 'relaxed_order'`
 * and a tunable `hnsw.ef_search`. Cosine distance (`<=>`) matches the index's
 * `vector_cosine_ops`; similarity is reported as `1 - distance` in [0, 1].
 */

export interface RetrieveOptions {
  organizationId: string;
  /** Query embedding; length must equal {@link EMBEDDING_DIMENSIONS}. */
  queryEmbedding: number[];
  /** Max chunks to return. */
  topK?: number;
  /** HNSW candidate list size; higher = better recall, slower. */
  efSearch?: number;
}

export interface RetrievedChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  /** Cosine similarity in [0, 1]; higher is closer. */
  similarity: number;
}

export const DEFAULT_TOP_K = 6;
export const DEFAULT_EF_SEARCH = 100;

interface ChunkRow {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  similarity: number;
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

export async function retrieveChunks(
  db: Database,
  options: RetrieveOptions,
): Promise<RetrievedChunk[]> {
  if (options.queryEmbedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `query embedding has ${options.queryEmbedding.length} dimensions, expected ${EMBEDDING_DIMENSIONS}`,
    );
  }
  const topK = Math.max(1, Math.floor(options.topK ?? DEFAULT_TOP_K));
  const efSearch = Math.max(1, Math.floor(options.efSearch ?? DEFAULT_EF_SEARCH));
  const vector = toVectorLiteral(options.queryEmbedding);

  const rows = await db.transaction(async (tx) => {
    // Filtered ANN tuning is session-scoped; SET LOCAL confines it to this txn.
    await tx.execute(sql`SET LOCAL hnsw.iterative_scan = 'relaxed_order'`);
    await tx.execute(sql.raw(`SET LOCAL hnsw.ef_search = ${efSearch}`));
    return tx.execute(sql`
      SELECT
        id,
        document_id,
        chunk_index,
        content,
        1 - (embedding <=> ${vector}::vector) AS similarity
      FROM kb_chunks
      WHERE organization_id = ${options.organizationId}
      ORDER BY embedding <=> ${vector}::vector
      LIMIT ${topK}
    `);
  });

  return (rows as unknown as ChunkRow[]).map((row) => ({
    id: row.id,
    documentId: row.document_id,
    chunkIndex: row.chunk_index,
    content: row.content,
    similarity: Number(row.similarity),
  }));
}

/**
 * Grounding check: the retrieval is "grounded" when the best chunk's similarity
 * meets the tenant's threshold. Below it, the AI must decline/escalate rather
 * than fabricate (weak-grounding escalation trigger).
 */
export function isGrounded(chunks: RetrievedChunk[], threshold: number): boolean {
  return chunks.length > 0 && chunks[0]!.similarity >= threshold;
}
