import type { JwtVerifyConfig } from '@graft/auth';
import { getConversationForOrg, type Database } from '@graft/db';
import type { Logger, Metrics } from '@graft/observability';
import {
  CHAT_EVENTS,
  chatJoinSchema,
  chatPresenceSchema,
  chatTypingBroadcastSchema,
  chatTypingSchema,
  claimRequestSchema,
  stateChangedEventSchema,
  type ChatJoinAck,
  type ClaimResult,
} from '@graft/shared';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import type { Server as HttpServer } from 'node:http';
import { Server, type DefaultEventsMap } from 'socket.io';
import type { ClaimService } from '../claim/service.js';
import { authenticateSocket, SocketAuthError, type ChatIdentity } from './auth.js';

interface SocketData {
  identity: ChatIdentity;
}

type ChatServer = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

export interface SocketServerDeps {
  httpServer: HttpServer;
  db: Database;
  jwtConfig: JwtVerifyConfig;
  metrics: Metrics;
  logger: Logger;
  serviceName: string;
  /** Redis pub/sub pair for the Socket.IO adapter (cross-instance fan-out). */
  pub: Redis;
  sub: Redis;
  /** Atomic claim + abort-on-takeover (unit 19). */
  claimService: ClaimService;
}

function conversationRoom(conversationId: string): string {
  return `conv:${conversationId}`;
}

/**
 * Creates the chat-service Socket.IO server (architecture.md §chat-service):
 * websocket-only transport (connection affinity, invariant 13), the Redis adapter
 * for cross-instance fan-out (invariant 9), handshake auth, and the realtime base —
 * conversation-room join (tenant-scoped), typing relay, presence, and the atomic
 * claim (unit 19: CAS + cross-instance abort + state_changed broadcast). Message relay
 * and handback land in unit 20.
 */
export function createSocketServer(deps: SocketServerDeps): ChatServer {
  const io: ChatServer = new Server(deps.httpServer, {
    transports: ['websocket'],
    // The real origin boundary for customers is enforced in the auth middleware
    // (per-tenant allow-list); agents are gated by JWT. Reflect origin for the WS upgrade.
    cors: { origin: true },
  });
  io.adapter(createAdapter(deps.pub, deps.sub));

  io.use((socket, next) => {
    authenticateSocket(socket.handshake, { db: deps.db, jwtConfig: deps.jwtConfig })
      .then((identity) => {
        socket.data.identity = identity;
        next();
      })
      .catch((err: unknown) => {
        deps.logger.warn(
          { reason: err instanceof Error ? err.message : 'unknown' },
          'socket auth rejected',
        );
        next(err instanceof SocketAuthError ? err : new Error('unauthorized'));
      });
  });

  io.on('connection', (socket) => {
    const identity = socket.data.identity;
    deps.metrics.wsConnectionsActive.inc({ service: deps.serviceName });
    deps.logger.info(
      { socketId: socket.id, kind: identity.kind, organizationId: identity.organizationId },
      'ws connected',
    );

    socket.on(CHAT_EVENTS.JOIN, (raw: unknown, ack?: (res: ChatJoinAck) => void) => {
      void (async () => {
        const parsed = chatJoinSchema.safeParse(raw);
        if (!parsed.success) return ack?.({ ok: false, error: 'invalid payload' });
        const { conversationId } = parsed.data;

        // Tenant guard: the conversation must belong to the identity's org (invariant 1).
        const conversation = await getConversationForOrg(
          deps.db,
          conversationId,
          identity.organizationId,
        );
        if (!conversation) return ack?.({ ok: false, error: 'not found' });
        // A customer may only join their OWN conversation.
        if (identity.kind === 'CUSTOMER' && conversation.sessionId !== identity.sessionId) {
          return ack?.({ ok: false, error: 'forbidden' });
        }

        const room = conversationRoom(conversationId);
        await socket.join(room);
        socket
          .to(room)
          .emit(
            CHAT_EVENTS.PRESENCE,
            chatPresenceSchema.parse({ conversationId, participant: identity.kind, status: 'joined' }),
          );
        ack?.({ ok: true });
      })().catch((err: unknown) => {
        deps.logger.error({ err }, 'conversation join failed');
        ack?.({ ok: false, error: 'internal' });
      });
    });

    socket.on(CHAT_EVENTS.CLAIM, (raw: unknown, ack?: (res: ClaimResult) => void) => {
      void (async () => {
        // Only agents claim; a customer socket never reaches the claim CAS. NOT_FOUND
        // rather than a distinct code avoids leaking conversation existence.
        if (identity.kind !== 'AGENT') return ack?.({ ok: false, reason: 'NOT_FOUND' });

        const parsed = claimRequestSchema.safeParse(raw);
        if (!parsed.success) return ack?.({ ok: false, reason: 'INVALID_STATE' });
        const { conversationId } = parsed.data;

        // Tenant guard before the CAS: the conversation must belong to the agent's org
        // (invariant 1). A miss is NOT_FOUND — the CAS itself is also org-scoped.
        const conversation = await getConversationForOrg(
          deps.db,
          conversationId,
          identity.organizationId,
        );
        if (!conversation) return ack?.({ ok: false, reason: 'NOT_FOUND' });

        const result = await deps.claimService.claim({
          organizationId: identity.organizationId,
          agentId: identity.agentId,
          conversationId,
        });

        if (result.ok) {
          // Join the claiming agent to the room and announce the new state to everyone
          // watching it (other agents' dashboards). The customer's transport switch is
          // signaled separately on the ai-service SSE bus (unit 20).
          const room = conversationRoom(conversationId);
          await socket.join(room);
          io.to(room).emit(
            CHAT_EVENTS.STATE_CHANGED,
            stateChangedEventSchema.parse({
              type: 'state_changed',
              conversationId,
              state: result.state,
              trigger: null,
            }),
          );
        }
        ack?.(result);
      })().catch((err: unknown) => {
        deps.logger.error({ err }, 'conversation claim failed');
        ack?.({ ok: false, reason: 'INVALID_STATE' });
      });
    });

    socket.on(CHAT_EVENTS.TYPING, (raw: unknown) => {
      const parsed = chatTypingSchema.safeParse(raw);
      if (!parsed.success) return;
      const room = conversationRoom(parsed.data.conversationId);
      // Only relay typing for a room the socket actually joined.
      if (!socket.rooms.has(room)) return;
      socket.to(room).emit(
        CHAT_EVENTS.TYPING,
        chatTypingBroadcastSchema.parse({
          conversationId: parsed.data.conversationId,
          from: identity.kind,
          isTyping: parsed.data.isTyping,
        }),
      );
    });

    // `disconnecting` still has the socket's rooms populated; emit presence-left.
    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (!room.startsWith('conv:')) continue;
        const conversationId = room.slice('conv:'.length);
        socket
          .to(room)
          .emit(
            CHAT_EVENTS.PRESENCE,
            chatPresenceSchema.parse({ conversationId, participant: identity.kind, status: 'left' }),
          );
      }
    });

    socket.on('disconnect', () => {
      deps.metrics.wsConnectionsActive.dec({ service: deps.serviceName });
      deps.logger.info({ socketId: socket.id }, 'ws disconnected');
    });
  });

  return io;
}
