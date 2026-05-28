import { z } from 'zod';
import { agentIdSchema, conversationIdSchema } from './ids.js';
import { conversationStateSchema } from '../enums/conversation-state.js';

export const claimRequestSchema = z.object({
  conversationId: conversationIdSchema,
});
export type ClaimRequest = z.infer<typeof claimRequestSchema>;

export const claimResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    conversationId: conversationIdSchema,
    assignedAgentId: agentIdSchema,
    state: conversationStateSchema,
  }),
  z.object({
    ok: z.literal(false),
    reason: z.enum(['ALREADY_CLAIMED', 'NOT_FOUND', 'INVALID_STATE']),
  }),
]);
export type ClaimResult = z.infer<typeof claimResultSchema>;
