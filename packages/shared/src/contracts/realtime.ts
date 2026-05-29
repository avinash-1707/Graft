import { z } from 'zod';
import { serverEventSchema } from './events.js';
import { uuidSchema } from './ids.js';

/**
 * Single Redis Pub/Sub channel for cross-instance ai-service SSE realtime delivery
 * (invariant 9). The analysis worker and any HTTP instance publish here; every HTTP
 * instance subscribes and dispatches to the SSE connection it locally holds for the
 * conversation. Carries two kinds: a server event to deliver, or an abort signal to
 * cancel in-flight generation on whatever instance holds the stream (invariant 12,
 * for cross-instance agent takeover).
 */
export const AI_REALTIME_CHANNEL = 'graft:ai:rt' as const;

export const realtimeMessageSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('event'),
    conversationId: uuidSchema,
    event: serverEventSchema,
  }),
  z.object({
    kind: z.literal('abort'),
    conversationId: uuidSchema,
  }),
]);
export type RealtimeMessage = z.infer<typeof realtimeMessageSchema>;
