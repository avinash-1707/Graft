import { z } from 'zod';
import { messageRoleSchema } from '../enums/message-role.js';
import {
  agentIdSchema,
  conversationIdSchema,
  messageIdSchema,
  organizationIdSchema,
} from './ids.js';

export const messageSequenceSchema = z.int().positive();
export type MessageSequence = z.infer<typeof messageSequenceSchema>;

export const messageContentSchema = z.string().min(1).max(8000);
export type MessageContent = z.infer<typeof messageContentSchema>;

export const messageSchema = z.object({
  id: messageIdSchema,
  organizationId: organizationIdSchema,
  conversationId: conversationIdSchema,
  sequence: messageSequenceSchema,
  role: messageRoleSchema,
  content: messageContentSchema,
  senderAgentId: agentIdSchema.nullable(),
  createdAt: z.iso.datetime(),
});

export type Message = z.infer<typeof messageSchema>;
