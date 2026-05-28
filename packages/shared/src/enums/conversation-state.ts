import { z } from 'zod';

export const conversationStateSchema = z.enum([
  'AI_ACTIVE',
  'ESCALATION_PENDING',
  'AGENT_ASSIGNED',
  'HUMAN_ACTIVE',
  'CLOSED',
]);

export type ConversationState = z.infer<typeof conversationStateSchema>;
export const ConversationState = conversationStateSchema.enum;

export const CONVERSATION_STATES = conversationStateSchema.options;
