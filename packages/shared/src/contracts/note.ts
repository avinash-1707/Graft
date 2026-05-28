import { z } from 'zod';
import {
  agentIdSchema,
  conversationIdSchema,
  noteIdSchema,
  organizationIdSchema,
} from './ids.js';

export const noteContentSchema = z.string().min(1).max(8000);

export const internalNoteSchema = z.object({
  id: noteIdSchema,
  organizationId: organizationIdSchema,
  conversationId: conversationIdSchema,
  authorAgentId: agentIdSchema,
  content: noteContentSchema,
  createdAt: z.iso.datetime(),
});

export type InternalNote = z.infer<typeof internalNoteSchema>;
