import {
  CHAT_EVENTS,
  chatHandbackAckSchema,
  chatJoinAckSchema,
  chatMessageAckSchema,
  claimResultSchema,
  serverEventSchema,
  type ChatHandbackAck,
  type ChatJoinAck,
  type ChatMessageAck,
  type ClaimResult,
  type ServerEvent,
} from '@graft/shared';
import { io, type Socket } from 'socket.io-client';

const ACK_TIMEOUT_MS = 10_000;

/**
 * A single agent's WebSocket against chat-service, authenticated with an agent JWT.
 * Thin typed wrapper over the same Socket.IO contract the dashboard uses — used by
 * the load scenarios to drive claim/message/handback and observe broadcasts.
 */
export class AgentClient {
  private socket: Socket | null = null;

  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  connect(): Promise<void> {
    const socket = io(this.url, {
      transports: ['websocket'],
      auth: { token: this.token },
      forceNew: true,
      reconnection: false,
    });
    this.socket = socket;
    return new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', (err: Error) => reject(err));
    });
  }

  onEvent(cb: (event: ServerEvent) => void): void {
    const forward = (payload: unknown): void => {
      const parsed = serverEventSchema.safeParse(payload);
      if (parsed.success) cb(parsed.data);
    };
    this.socket?.on(CHAT_EVENTS.MESSAGE_APPENDED, forward);
    this.socket?.on(CHAT_EVENTS.STATE_CHANGED, forward);
    this.socket?.on(CHAT_EVENTS.TRANSPORT_SWITCH, forward);
    this.socket?.on(CHAT_EVENTS.REPLAY, forward);
  }

  async join(conversationId: string, lastSequence = 0): Promise<ChatJoinAck> {
    const raw: unknown = await this.require()
      .timeout(ACK_TIMEOUT_MS)
      .emitWithAck(CHAT_EVENTS.JOIN, { conversationId, lastSequence });
    return chatJoinAckSchema.parse(raw);
  }

  async claim(conversationId: string): Promise<ClaimResult> {
    const raw: unknown = await this.require()
      .timeout(ACK_TIMEOUT_MS)
      .emitWithAck(CHAT_EVENTS.CLAIM, { conversationId });
    return claimResultSchema.parse(raw);
  }

  async send(conversationId: string, content: string): Promise<ChatMessageAck> {
    const raw: unknown = await this.require()
      .timeout(ACK_TIMEOUT_MS)
      .emitWithAck(CHAT_EVENTS.MESSAGE, { conversationId, content, clientNonce: crypto.randomUUID() });
    return chatMessageAckSchema.parse(raw);
  }

  async handback(conversationId: string): Promise<ChatHandbackAck> {
    const raw: unknown = await this.require()
      .timeout(ACK_TIMEOUT_MS)
      .emitWithAck(CHAT_EVENTS.HANDBACK, { conversationId });
    return chatHandbackAckSchema.parse(raw);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  private require(): Socket {
    if (!this.socket) throw new Error('agent socket not connected');
    return this.socket;
  }
}
