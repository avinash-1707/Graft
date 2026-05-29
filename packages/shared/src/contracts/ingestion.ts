import { z } from 'zod';
import { kbDocumentStatusSchema } from '../enums/kb-document-status.js';
import { kbDocumentTypeSchema } from '../enums/kb-document-type.js';
import { kbDocumentIdSchema, organizationIdSchema } from './ids.js';

/** BullMQ queue + job names for knowledge-base ingestion. */
export const KB_INGESTION_QUEUE = 'kb-ingestion' as const;
export const KB_INGESTION_JOB = 'process-document' as const;

/**
 * Payload enqueued on upload and consumed by the ingestion worker (unit 13). The
 * worker fetches the staged object by `objectKey`, parses → chunks → embeds →
 * upserts vectors, then marks the document READY (or FAILED). `objectKey` is also
 * derivable from `organizationId`/`documentId` (see `kbObjectKey`); it is carried
 * explicitly so the worker never reconstructs it.
 */
export const kbIngestionJobSchema = z.object({
  documentId: kbDocumentIdSchema,
  organizationId: organizationIdSchema,
  objectKey: z.string().min(1),
  fileType: kbDocumentTypeSchema,
});
export type KbIngestionJob = z.infer<typeof kbIngestionJobSchema>;

/** Response returned immediately after an upload is accepted and enqueued. */
export const uploadKbDocumentResponseSchema = z.object({
  documentId: kbDocumentIdSchema,
  filename: z.string(),
  fileType: kbDocumentTypeSchema,
  status: kbDocumentStatusSchema,
});
export type UploadKbDocumentResponse = z.infer<typeof uploadKbDocumentResponseSchema>;

/** Deterministic, collision-free object-storage key for a tenant's KB document. */
export function kbObjectKey(organizationId: string, documentId: string): string {
  return `kb/${organizationId}/${documentId}`;
}
