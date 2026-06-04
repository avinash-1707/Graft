import { z } from 'zod';
import { agentIdSchema, conversationIdSchema, noteIdSchema, organizationIdSchema } from './ids.js';

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

/** Body for creating an internal note (author + scope come from the route, not the client). */
export const createNoteRequestSchema = z.object({ content: noteContentSchema });
export type CreateNoteRequest = z.infer<typeof createNoteRequestSchema>;

/** Notes for one conversation, oldest-first. */
export const listNotesResponseSchema = z.object({ notes: z.array(internalNoteSchema) });
export type ListNotesResponse = z.infer<typeof listNotesResponseSchema>;
