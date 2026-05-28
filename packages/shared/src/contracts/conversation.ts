import { z } from 'zod';
import { conversationStateSchema } from '../enums/conversation-state.js';
import {
  agentIdSchema,
  conversationIdSchema,
  organizationIdSchema,
  sessionIdSchema,
} from './ids.js';

export const conversationSchema = z.object({
  id: conversationIdSchema,
  organizationId: organizationIdSchema,
  sessionId: sessionIdSchema,
  state: conversationStateSchema,
  assignedAgentId: agentIdSchema.nullable(),
  lastSequence: z.int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  closedAt: z.iso.datetime().nullable(),
});

export type Conversation = z.infer<typeof conversationSchema>;
