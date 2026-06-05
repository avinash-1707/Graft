import type { Encryptor } from '@graft/crypto';
import {
  getKbDocument,
  markKbDocumentProcessing,
  markKbDocumentReady,
  replaceKbChunks,
  type Database,
} from '@graft/db';
import type { Logger } from '@graft/observability';
import { resolveEmbedder } from '@graft/keyring';
import { chunkText } from '@graft/rag';
import { kbIngestionJobSchema, type KbIngestionJob } from '@graft/shared';
import type { Job } from 'bullmq';
import type { Storage } from '../storage/s3.js';
import { parseDocument } from './parse.js';

export interface ProcessorDeps {
  db: Database;
  storage: Storage;
  encryptor: Encryptor;
  logger: Logger;
  /** Platform OpenRouter key for embedding KB chunks of CREDITS-mode orgs. */
  platformOpenRouterApiKey: string;
}

/**
 * Builds the BullMQ job processor: parse the staged object → chunk → embed (with
 * the tenant's provider) → upsert vectors → mark READY → delete the staged object.
 * Idempotent: `replaceKbChunks` clears prior chunks, so a retried job never
 * duplicates. Throwing lets BullMQ retry; the worker's `failed` handler marks the
 * document FAILED once attempts are exhausted.
 */
export function createProcessor(deps: ProcessorDeps) {
  return async function process(job: Job<KbIngestionJob>): Promise<void> {
    const { documentId, organizationId, objectKey, fileType } = kbIngestionJobSchema.parse(
      job.data,
    );

    const doc = await getKbDocument(deps.db, documentId);
    if (!doc) {
      // Document row gone (org/doc deleted) — nothing to do; clean up the object.
      await deps.storage.deleteObject(objectKey).catch(() => undefined);
      return;
    }

    await markKbDocumentProcessing(deps.db, documentId);

    const bytes = await deps.storage.getObject(objectKey);
    const text = await parseDocument(fileType, bytes);
    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error('document produced no text to index');

    const { embedder } = await resolveEmbedder(deps.db, deps.encryptor, organizationId, {
      platformApiKey: deps.platformOpenRouterApiKey,
    });
    const embeddings = await embedder.embedBatch(chunks.map((c) => c.content));
    if (embeddings.length !== chunks.length) {
      throw new Error(
        `embedding count ${embeddings.length} does not match chunk count ${chunks.length}`,
      );
    }

    await replaceKbChunks(deps.db, {
      organizationId,
      documentId,
      chunks: chunks.map((chunk, i) => ({
        chunkIndex: chunk.index,
        content: chunk.content,
        embedding: embeddings[i]!,
      })),
    });

    await markKbDocumentReady(deps.db, documentId);
    await deps.storage
      .deleteObject(objectKey)
      .catch((err: unknown) =>
        deps.logger.warn({ err, objectKey }, 'failed to delete staged object'),
      );

    deps.logger.info({ documentId, chunks: chunks.length }, 'document ingested');
  };
}
