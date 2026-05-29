import { z } from 'zod';

/** Lifecycle of a KB document through ingestion. */
export const kbDocumentStatusSchema = z.enum(['PENDING', 'PROCESSING', 'READY', 'FAILED']);

export type KbDocumentStatus = z.infer<typeof kbDocumentStatusSchema>;
export const KbDocumentStatus = kbDocumentStatusSchema.enum;

export const KB_DOCUMENT_STATUSES = kbDocumentStatusSchema.options;
