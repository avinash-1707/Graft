import {
  CHAT_EVENTS,
  chatHandbackAckSchema,
  chatJoinAckSchema,
  chatMessageAckSchema,
  claimResultSchema,
  serverEventSchema,
  typingEventSchema,
  type ChatHandbackAck,
  type ChatJoinAck,
  type ChatMessageAck,
  type ClaimResult,
  type ServerEvent,
} from "@graft/shared";
import { io, type Socket } from "socket.io-client";

import { CHAT_URL } from "@/lib/env";
import { clearAccessToken, getAccessToken } from "@/lib/auth/access-token";

const JOIN_TIMEOUT_MS = 10_000;
const ACTION_TIMEOUT_MS = 15_000;

export type ChatStatus = "connecting" | "connected" | "disconnected";

export interface ChatSocketHandlers {
  /** Server→room events (message_appended, state_changed, replay_batch, typing). */
  onEvent: (event: ServerEvent) => void;
  onStatus: (status: ChatStatus) => void;
  /** Fired on every (re)connect so the caller re-joins its open rooms with fresh cursors. */
  onReconnect: () => void;
}

/**
 * The agent's persistent WebSocket to chat-service (unit 28), over socket.io-client.
 * Authenticates as an AGENT with the minted JWT in the handshake `auth` (refreshed on
 * every reconnect via the callback form). Mirrors the widget's WS transport but adds
 * the agent-only actions — claim and handback — and supports observing/chatting across
 * multiple conversation rooms from one connection.
 *
 * Connection affinity is enforced with `transports: ['websocket']` (invariant 13). The
 * caller owns room membership and per-conversation cursors; this class is a thin typed
 * wrapper over emit/ack and event forwarding.
 */
export class ChatSocket {
  private socket: Socket | null = null;

  constructor(private readonly handlers: ChatSocketHandlers) {}

  connect(): void {
    if (this.socket) return;
    const socket = io(CHAT_URL, {
      transports: ["websocket"],
      withCredentials: false,
      auth: (cb) => {
        void getAccessToken().then((token) => cb(token ? { token } : {}));
      },
    });
    this.socket = socket;

    socket.on("connect", () => {
      this.handlers.onStatus("connected");
      this.handlers.onReconnect();
    });
    socket.on("disconnect", () => this.handlers.onStatus("disconnected"));
    socket.io.on("reconnect_attempt", () => this.handlers.onStatus("connecting"));
    // A rejected handshake is usually a stale JWT: drop the cache so the next auth()
    // call mints a fresh one, then let socket.io's backoff retry.
    socket.on("connect_error", () => clearAccessToken());

    this.wire(socket);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  /** Joins (or re-joins) a conversation room; the server replays messages after `lastSequence`. */
  async join(conversationId: string, lastSequence: number): Promise<ChatJoinAck> {
    const socket = this.require();
    const raw: unknown = await socket
      .timeout(JOIN_TIMEOUT_MS)
      .emitWithAck(CHAT_EVENTS.JOIN, { conversationId, lastSequence });
    return chatJoinAckSchema.parse(raw);
  }

  /** Atomically claims a conversation; the ack says whether this agent won (invariant 2). */
  async claim(conversationId: string): Promise<ClaimResult> {
    const socket = this.require();
    const raw: unknown = await socket
      .timeout(ACTION_TIMEOUT_MS)
      .emitWithAck(CHAT_EVENTS.CLAIM, { conversationId });
    return claimResultSchema.parse(raw);
  }

  /** Sends an agent message; resolves with the persisted sequence (or a refusal reason). */
  async send(conversationId: string, content: string, clientNonce: string): Promise<ChatMessageAck> {
    const socket = this.require();
    const raw: unknown = await socket
      .timeout(ACTION_TIMEOUT_MS)
      .emitWithAck(CHAT_EVENTS.MESSAGE, { conversationId, content, clientNonce });
    return chatMessageAckSchema.parse(raw);
  }

  /** Hands the conversation back to the AI (HUMAN_ACTIVE → AI_ACTIVE). */
  async handback(conversationId: string): Promise<ChatHandbackAck> {
    const socket = this.require();
    const raw: unknown = await socket
      .timeout(ACTION_TIMEOUT_MS)
      .emitWithAck(CHAT_EVENTS.HANDBACK, { conversationId });
    return chatHandbackAckSchema.parse(raw);
  }

  /** Relays a typing indicator to the room (best-effort, unacked). */
  setTyping(conversationId: string, isTyping: boolean): void {
    this.socket?.emit(CHAT_EVENTS.TYPING, { conversationId, isTyping });
  }

  private require(): Socket {
    if (!this.socket) throw new Error("chat socket not connected");
    return this.socket;
  }

  private wire(socket: Socket): void {
    const forward = (payload: unknown): void => {
      const parsed = serverEventSchema.safeParse(payload);
      if (parsed.success) this.handlers.onEvent(parsed.data);
    };
    socket.on(CHAT_EVENTS.MESSAGE_APPENDED, forward);
    socket.on(CHAT_EVENTS.STATE_CHANGED, forward);
    socket.on(CHAT_EVENTS.REPLAY, forward);
    // The typing broadcast lacks the `type` discriminant; wrap it into the event shape.
    socket.on(CHAT_EVENTS.TYPING, (payload: unknown) => {
      const parsed = typingEventSchema.safeParse({
        type: "typing",
        ...(typeof payload === "object" && payload !== null ? payload : {}),
      });
      if (parsed.success) this.handlers.onEvent(parsed.data);
    });
  }
}
