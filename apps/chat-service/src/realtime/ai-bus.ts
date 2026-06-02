import { AI_REALTIME_CHANNEL } from '@graft/shared';
import type { Redis } from 'ioredis';

/** Publishes takeover aborts onto ai-service's realtime bus (channel `graft:ai:rt`). */
export interface AiAbortPublisher {
  /**
   * Signals ai-service to cancel any in-flight AI generation for the conversation
   * (invariant 12). Delivered cross-instance via Redis Pub/Sub (invariant 9), so it
   * reaches whichever ai-service process holds the customer's SSE stream.
   */
  publishAbort(conversationId: string): Promise<void>;
}

/**
 * Builds an {@link AiAbortPublisher} over an existing Redis client. Reuses the
 * Socket.IO adapter's publisher connection — a normal command client; publishing on
 * an extra channel is independent of the adapter's own channels. ai-service's
 * `event-bus` is the consumer (it subscribes to `graft:ai:rt` and aborts the matching
 * local SSE connection); the abort *publisher* is chat-service's half of that contract.
 */
export function createAiAbortPublisher(redis: Redis): AiAbortPublisher {
  return {
    async publishAbort(conversationId) {
      await redis.publish(AI_REALTIME_CHANNEL, JSON.stringify({ kind: 'abort', conversationId }));
    },
  };
}
