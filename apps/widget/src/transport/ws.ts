import {
  CHAT_EVENTS,
  chatJoinAckSchema,
  chatMessageAckSchema,
  serverEventSchema,
  typingEventSchema,
  type ServerEvent,
} from '@graft/shared';
import { io, type Socket } from 'socket.io-client';
import type { ApiConfig } from './api';

const JOIN_TIMEOUT_MS = 10_000;
const SEND_TIMEOUT_MS = 15_000;

export interface WsTransportParams {
  readonly config: ApiConfig;
  readonly sessionId: string;
  readonly conversationId: string;
  /** Manager's render cursor; read fresh on every (re)join so replay covers the gap (invariant 11). */
  readonly getLastSequence: () => number;
  readonly onEvent: (event: ServerEvent) => void;
}

/**
 * The WebSocket half of the transport (human mode), over socket.io-client against
 * chat-service. Unlike the per-turn SSE stream, this is a **persistent** connection:
 * once an agent controls the conversation, messages are pushed to the customer at any
 * time, so the socket stays open and the widget listens. Behind the same surface the
 * {@link TransportManager} uses for SSE.
 *
 * Authenticates as a CUSTOMER via the public embed token + session id in the handshake
 * `auth` (chat-service gates it by the org's Origin allow-list + a tenant session check).
 * `connect` resolves only once the socket is up, the room is joined, and the replay batch
 * has drained — the "new transport confirmed" precondition of make-before-break (rule 1).
 * socket.io's own auto-reconnect re-runs the join (with the current cursor) on every
 * reconnect, so a dropped WS resumes through the same replay path (rule 4).
 */
export class WsTransport {
  private socket: Socket | null = null;
  private ready = false;

  constructor(private readonly params: WsTransportParams) {}

  /** Connects, joins the conversation room, and drains the replay batch (make-before-break). */
  connect(): Promise<void> {
    const { config, sessionId } = this.params;
    // The widget targets one public origin; chat-service is reached via the gateway WS
    // proxy (see Deferred), or `chatBaseUrl` for a direct local connection.
    const url = (config.chatBaseUrl ?? config.apiBaseUrl).replace(/\/+$/, '');
    const socket = io(url, {
      transports: ['websocket'], // connection affinity, invariant 13 (no long-poll upgrade)
      auth: { embedToken: config.embedToken, sessionId },
      withCredentials: false,
    });
    this.socket = socket;
    this.wireEvents(socket);

    return new Promise<void>((resolve, reject) => {
      // Fires on the first connect AND every reconnect: re-join with the live cursor so a
      // dropped WS catches up via replay. Only the first join settles `connect`.
      socket.on('connect', () => {
        this.join(socket)
          .then(() => {
            if (!this.ready) {
              this.ready = true;
              resolve();
            }
          })
          .catch((err: unknown) => {
            if (!this.ready) reject(err instanceof Error ? err : new Error('join failed'));
          });
      });
      socket.on('connect_error', (err: Error) => {
        if (!this.ready) reject(err);
      });
    });
  }

  /** Sends a customer message over the room; resolves once the server acks the persisted row. */
  async send(content: string, clientNonce: string): Promise<void> {
    const socket = this.socket;
    if (!socket) throw new Error('ws not connected');
    const raw: unknown = await socket.timeout(SEND_TIMEOUT_MS).emitWithAck(CHAT_EVENTS.MESSAGE, {
      conversationId: this.params.conversationId,
      content,
      clientNonce,
    });
    const ack = chatMessageAckSchema.parse(raw);
    if (!ack.ok) throw new Error(`message rejected: ${ack.reason}`);
  }

  /** Idempotent teardown: stops reconnection and drops the socket. */
  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  /** Joins the conversation room with the current cursor; the server replays anything newer. */
  private async join(socket: Socket): Promise<void> {
    const raw: unknown = await socket.timeout(JOIN_TIMEOUT_MS).emitWithAck(CHAT_EVENTS.JOIN, {
      conversationId: this.params.conversationId,
      lastSequence: this.params.getLastSequence(),
    });
    const ack = chatJoinAckSchema.parse(raw);
    if (!ack.ok) throw new Error(`join refused: ${ack.error ?? 'unknown'}`);
  }

  private wireEvents(socket: Socket): void {
    // These server→room broadcasts are already `ServerEvent`-shaped; validate and forward.
    const forward = (payload: unknown): void => {
      const parsed = serverEventSchema.safeParse(payload);
      if (parsed.success) this.params.onEvent(parsed.data);
    };
    socket.on(CHAT_EVENTS.MESSAGE_APPENDED, forward);
    socket.on(CHAT_EVENTS.STATE_CHANGED, forward);
    socket.on(CHAT_EVENTS.TRANSPORT_SWITCH, forward);
    socket.on(CHAT_EVENTS.REPLAY, forward);
    // The typing broadcast lacks the `type` discriminant; wrap it into the event shape.
    socket.on(CHAT_EVENTS.TYPING, (payload: unknown) => {
      const parsed = typingEventSchema.safeParse({
        type: 'typing',
        ...(typeof payload === 'object' && payload !== null ? payload : {}),
      });
      if (parsed.success) this.params.onEvent(parsed.data);
    });
  }
}
