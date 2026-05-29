import { z } from 'zod';

/** Supported knowledge-base upload formats. */
export const kbDocumentTypeSchema = z.enum(['PDF', 'DOCX', 'TEXT']);

export type KbDocumentType = z.infer<typeof kbDocumentTypeSchema>;
export const KbDocumentType = kbDocumentTypeSchema.enum;

export const KB_DOCUMENT_TYPES = kbDocumentTypeSchema.options;
