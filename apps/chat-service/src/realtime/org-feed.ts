import {
  ORG_FEED_CHANNEL,
  orgFeedMessageSchema,
  type OrgFeedBusEvent,
  type OrgFeedEvent,
  type OrgFeedMessage,
} from '@graft/shared';
import type { Logger } from '@graft/observability';
import type { Redis } from 'ioredis';

/** One dashboard SSE connection watching an organization's live feed. */
export interface FeedConnection {
  /** Writes a feed event to this connection's SSE stream. */
  write(event: OrgFeedEvent): void;
}

/**
 * In-process map of `organizationId → live dashboard SSE connections` this instance
 * holds. The org-feed Redis subscriber dispatches incoming org-tagged events here, so
 * an event published by ANY process (ai-service HTTP/worker, another chat-service
 * instance) reaches every agent's feed for that org wherever the connection lives
 * (invariant 9). Purely local state; nothing here is durable.
 */
export class OrgFeedHub {
  private readonly byOrg = new Map<string, Set<FeedConnection>>();

  register(organizationId: string, conn: FeedConnection): void {
    let set = this.byOrg.get(organizationId);
    if (!set) {
      set = new Set();
      this.byOrg.set(organizationId, set);
    }
    set.add(conn);
  }

  unregister(organizationId: string, conn: FeedConnection): void {
    const set = this.byOrg.get(organizationId);
    if (!set) return;
    set.delete(conn);
    if (set.size === 0) this.byOrg.delete(organizationId);
  }

  /** Delivers a feed event to every local connection for the org (no-op if none). */
  deliver(organizationId: string, event: OrgFeedEvent): void {
    const set = this.byOrg.get(organizationId);
    if (!set) return;
    for (const conn of set) conn.write(event);
  }
}

/**
 * Subscribes a Redis connection to {@link ORG_FEED_CHANNEL} and dispatches each
 * org-tagged message to the hub. A subscribed ioredis client can't issue other
 * commands, so this must be its own connection (not the Socket.IO adapter pair).
 * Boot is non-blocking: the subscribe is issued and ioredis (re)subscribes on
 * connect/reconnect, so a Redis blip at startup never stops the server listening.
 */
export function subscribeOrgFeed(sub: Redis, hub: OrgFeedHub, logger: Logger): void {
  sub.on('message', (_channel, raw) => {
    let message: OrgFeedMessage;
    try {
      message = orgFeedMessageSchema.parse(JSON.parse(raw));
    } catch (err) {
      logger.warn({ err }, 'dropping malformed org-feed message');
      return;
    }
    hub.deliver(message.organizationId, message.event);
  });
  sub
    .subscribe(ORG_FEED_CHANNEL)
    .catch((err: unknown) => logger.error({ err }, 'failed to subscribe to org-feed channel'));
}

/**
 * Publishes an org-tagged event to the dashboard live feed (unit 27). Fire-and-forget:
 * the feed is auxiliary to the human-chat turn, so a Redis hiccup must never fail the
 * action that triggered it. Reuses the Socket.IO adapter's publisher connection.
 */
export function publishOrgFeed(
  pub: Redis,
  logger: Logger,
  organizationId: string,
  event: OrgFeedBusEvent,
): void {
  void pub
    .publish(ORG_FEED_CHANNEL, JSON.stringify({ organizationId, event }))
    .catch((err: unknown) => logger.warn({ err }, 'org-feed publish failed'));
}
