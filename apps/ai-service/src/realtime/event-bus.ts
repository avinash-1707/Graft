import { AI_REALTIME_CHANNEL, realtimeMessageSchema, type ServerEvent } from '@graft/shared';
import type { FastifyBaseLogger } from 'fastify';
import { Redis } from 'ioredis';
import type { ConnectionRegistry } from './connection-registry.js';

export interface EventBus {
  /** Publishes a server event for cross-instance delivery to the conversation's SSE. */
  publishEvent(conversationId: string, event: ServerEvent): Promise<void>;
  /** Publishes an abort for the conversation's in-flight generation (cross-instance). */
  publishAbort(conversationId: string): Promise<void>;
  /** Starts the subscriber, dispatching incoming messages to the registry (HTTP only). */
  subscribe(registry: ConnectionRegistry): Promise<void>;
  close(): Promise<void>;
}

/**
 * Redis Pub/Sub realtime bus for ai-service SSE (invariant 9). One publisher
 * connection (used by HTTP instances + the worker) and, on HTTP instances, one
 * subscriber connection (a subscribed ioredis client can't issue other commands).
 * The worker only publishes — it holds no SSE — and never calls `subscribe`.
 */
export function createEventBus(redisUrl: string, logger: FastifyBaseLogger): EventBus {
  const publisher = new Redis(redisUrl, { maxRetriesPerRequest: null });
  let subscriber: Redis | undefined;

  return {
    async publishEvent(conversationId, event) {
      await publisher.publish(
        AI_REALTIME_CHANNEL,
        JSON.stringify({ kind: 'event', conversationId, event }),
      );
    },

    async publishAbort(conversationId) {
      await publisher.publish(
        AI_REALTIME_CHANNEL,
        JSON.stringify({ kind: 'abort', conversationId }),
      );
    },

    subscribe(registry) {
      const sub = new Redis(redisUrl, { maxRetriesPerRequest: null });
      subscriber = sub;
      sub.on('message', (_channel, raw) => {
        let message;
        try {
          message = realtimeMessageSchema.parse(JSON.parse(raw));
        } catch (err) {
          logger.warn({ err }, 'dropping malformed realtime message');
          return;
        }
        if (message.kind === 'event') {
          registry.deliver(message.conversationId, message.event);
        } else {
          registry.abort(message.conversationId);
        }
      });
      // Don't block boot on Redis: issue the subscribe and let ioredis (re)subscribe
      // on connect/reconnect. A Redis blip at startup must not stop the server listening.
      sub.subscribe(AI_REALTIME_CHANNEL).catch((err: unknown) =>
        logger.error({ err }, 'failed to subscribe to realtime channel'),
      );
      return Promise.resolve();
    },

    async close() {
      if (subscriber) subscriber.disconnect();
      publisher.disconnect();
    },
  };
}
