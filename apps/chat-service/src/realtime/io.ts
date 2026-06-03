import type { JwtVerifyConfig } from '@graft/auth';
import { getConversationForOrg, type Database } from '@graft/db';
import type { Logger, Metrics } from '@graft/observability';
import {
  CHAT_EVENTS,
  chatHandbackSchema,
  chatJoinSchema,
  chatMessageSchema,
  chatPresenceSchema,
  chatTypingBroadcastSchema,
  chatTypingSchema,
  claimRequestSchema,
  messageAppendedEventSchema,
  replayBatchEventSchema,
  stateChangedEventSchema,
  transportSwitchEventSchema,
  type ChatHandbackAck,
  type ChatJoinAck,
  type ChatMessageAck,
  type ClaimResult,
} from '@graft/shared';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import type { Server as HttpServer } from 'node:http';
import { Server, type DefaultEventsMap } from 'socket.io';
import type { ClaimService } from '../claim/service.js';
import type { MessagingService, SwitchEffect } from '../messaging/service.js';
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
  /** Human-chat messaging, handback, and replay (unit 20). */
  messagingService: MessagingService;
}

function conversationRoom(conversationId: string): string {
  return `conv:${conversationId}`;
}

/**
 * Announces a state transition to the whole room: `state_changed` (agents reconcile
 * the feed) + `transport_switch` (the customer's widget moves between SSE and WS with
 * its customer-facing copy, invariant 3). Used by the HUMAN_ACTIVE flip and handback.
 */
function emitSwitch(io: ChatServer, conversationId: string, effect: SwitchEffect): void {
  const room = conversationRoom(conversationId);
  io.to(room).emit(
    CHAT_EVENTS.STATE_CHANGED,
    stateChangedEventSchema.parse({
      type: 'state_changed',
      conversationId,
      state: effect.state,
      trigger: null,
    }),
  );
  io.to(room).emit(
    CHAT_EVENTS.TRANSPORT_SWITCH,
    transportSwitchEventSchema.parse({
      type: 'transport_switch',
      conversationId,
      to: effect.transport,
      customerFacingCopy: effect.customerFacingCopy,
    }),
  );
}

/**
 * Creates the chat-service Socket.IO server (architecture.md §chat-service):
 * websocket-only transport (connection affinity, invariant 13), the Redis adapter
 * for cross-instance fan-out (invariant 9), handshake auth, and the realtime base —
 * conversation-room join (tenant-scoped, with reconnect replay), typing relay,
 * presence, the atomic claim (unit 19: CAS + cross-instance abort + state_changed
 * broadcast), and the human-chat turn (unit 20: message relay + persistence,
 * AGENT_ASSIGNED→HUMAN_ACTIVE, handback, transport-switch signaling).
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
        const { conversationId, lastSequence } = parsed.data;

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
        socket.to(room).emit(
          CHAT_EVENTS.PRESENCE,
          chatPresenceSchema.parse({
            conversationId,
            participant: identity.kind,
            status: 'joined',
          }),
        );

        // Reconnect replay (invariant 11): send anything newer than the client's last
        // sequence so the SSE↔WS switch never loses or duplicates a message.
        if (lastSequence !== undefined) {
          const messages = await deps.messagingService.getReplay({
            organizationId: identity.organizationId,
            conversationId,
            afterSequence: lastSequence,
            forCustomer: identity.kind === 'CUSTOMER',
          });
          if (messages.length > 0) {
            socket.emit(
              CHAT_EVENTS.REPLAY,
              replayBatchEventSchema.parse({
                type: 'replay_batch',
                conversationId,
                fromSequence: messages[0]!.sequence,
                messages,
              }),
            );
          }
        }
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

    socket.on(CHAT_EVENTS.MESSAGE, (raw: unknown, ack?: (res: ChatMessageAck) => void) => {
      void (async () => {
        const parsed = chatMessageSchema.safeParse(raw);
        if (!parsed.success) return ack?.({ ok: false, reason: 'INVALID_STATE' });
        const { conversationId, content, clientNonce } = parsed.data;

        const result = await deps.messagingService.sendMessage({
          organizationId: identity.organizationId,
          conversationId,
          identity,
          content,
          ...(clientNonce !== undefined ? { clientNonce } : {}),
        });
        if (!result.ok) return ack?.({ ok: false, reason: result.reason });

        const room = conversationRoom(conversationId);
        // The sender may not have joined yet (e.g. an agent messaging straight after
        // claim); ensure it is in the room before the relay so it receives later events.
        await socket.join(room);

        // First agent message flips AGENT_ASSIGNED → HUMAN_ACTIVE: announce before the
        // message so the customer's widget is on WS when the bubble lands.
        if (result.switch) emitSwitch(io, conversationId, result.switch);

        // Relay to the OTHER participant(s); the sender gets the authoritative row in
        // the ack (avoids a duplicate). Clients dedup on sequence regardless.
        socket
          .to(room)
          .emit(
            CHAT_EVENTS.MESSAGE_APPENDED,
            messageAppendedEventSchema.parse({ type: 'message_appended', message: result.message }),
          );

        ack?.({
          ok: true,
          conversationId,
          sequence: result.message.sequence,
          deduped: result.deduped,
        });
      })().catch((err: unknown) => {
        deps.logger.error({ err }, 'conversation message failed');
        ack?.({ ok: false, reason: 'INTERNAL' });
      });
    });

    socket.on(CHAT_EVENTS.HANDBACK, (raw: unknown, ack?: (res: ChatHandbackAck) => void) => {
      void (async () => {
        // Only an agent hands a conversation back to the AI.
        if (identity.kind !== 'AGENT') return ack?.({ ok: false, reason: 'FORBIDDEN' });

        const parsed = chatHandbackSchema.safeParse(raw);
        if (!parsed.success) return ack?.({ ok: false, reason: 'INVALID_STATE' });

        const result = await deps.messagingService.handback({
          organizationId: identity.organizationId,
          conversationId: parsed.data.conversationId,
          agentId: identity.agentId,
        });
        if (!result.ok) return ack?.({ ok: false, reason: result.reason });

        // Switch the customer back to the AI transport (SSE); the widget reopens SSE.
        emitSwitch(io, parsed.data.conversationId, result.switch);
        ack?.({ ok: true });
      })().catch((err: unknown) => {
        deps.logger.error({ err }, 'conversation handback failed');
        ack?.({ ok: false, reason: 'INTERNAL' });
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
        socket.to(room).emit(
          CHAT_EVENTS.PRESENCE,
          chatPresenceSchema.parse({
            conversationId,
            participant: identity.kind,
            status: 'left',
          }),
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
