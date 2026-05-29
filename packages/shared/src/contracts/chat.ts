import { z } from 'zod';
import { conversationIdSchema } from './ids.js';
import { messageContentSchema } from './message.js';

/** Socket.IO event names for the human-chat (WebSocket) transport. */
export const CHAT_EVENTS = {
  /** client → server: join a conversation room (ack'd; optional `lastSequence` triggers replay). */
  JOIN: 'conversation:join',
  /** agent → server: atomically claim a conversation (ack'd with the claim result). */
  CLAIM: 'conversation:claim',
  /** participant → server: send a human-chat message (ack'd with the persisted message). */
  MESSAGE: 'conversation:message',
  /** agent → server: hand the conversation back to the AI (ack'd). */
  HANDBACK: 'conversation:handback',
  /** client → server AND server → client: typing indicator. */
  TYPING: 'typing',
  /** server → client: a participant joined/left the conversation. */
  PRESENCE: 'presence',
  /** server → room: the conversation's state changed (claim, human-active, handback). */
  STATE_CHANGED: 'state_changed',
  /** server → room: a message was persisted (relayed to the other participant). */
  MESSAGE_APPENDED: 'message_appended',
  /** server → room: the customer's transport should switch (SSE↔WS), with customer-facing copy. */
  TRANSPORT_SWITCH: 'transport_switch',
  /** server → client: catch-up batch replayed on (re)join (invariant 11). */
  REPLAY: 'replay_batch',
} as const;

/** Default customer-facing copy for transport switches (tenant copy override is later). */
export const TRANSPORT_SWITCH_COPY = {
  /** AI → human handoff. */
  toHuman: 'You are now connected to a support agent.',
  /** Human → AI handback. */
  toAi: 'You are back with the AI assistant.',
} as const;

export const chatParticipantSchema = z.enum(['AGENT', 'CUSTOMER']);
export type ChatParticipant = z.infer<typeof chatParticipantSchema>;

// --- client → server ---
export const chatJoinSchema = z.object({
  conversationId: conversationIdSchema,
  /** Last sequence the client already has; the server replays anything newer (invariant 11). */
  lastSequence: z.int().nonnegative().optional(),
});
export type ChatJoin = z.infer<typeof chatJoinSchema>;

export const chatMessageSchema = z.object({
  conversationId: conversationIdSchema,
  content: messageContentSchema,
  /** Idempotency key; a retry with the same nonce returns the prior message (no dup). */
  clientNonce: z.string().min(1).max(128).optional(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatHandbackSchema = z.object({ conversationId: conversationIdSchema });
export type ChatHandback = z.infer<typeof chatHandbackSchema>;

export const chatTypingSchema = z.object({
  conversationId: conversationIdSchema,
  isTyping: z.boolean(),
});
export type ChatTyping = z.infer<typeof chatTypingSchema>;

/** Reason an action was refused; surfaced in the relevant ack. */
export const chatActionErrorSchema = z.enum(['NOT_FOUND', 'FORBIDDEN', 'INVALID_STATE', 'INTERNAL']);
export type ChatActionError = z.infer<typeof chatActionErrorSchema>;

/** Ack returned to the client for a `conversation:join`. */
export const chatJoinAckSchema = z.object({ ok: z.boolean(), error: z.string().optional() });
export type ChatJoinAck = z.infer<typeof chatJoinAckSchema>;

/** Ack for `conversation:message`: the persisted sequence/id, or a refusal reason. */
export const chatMessageAckSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    conversationId: conversationIdSchema,
    sequence: z.int().positive(),
    deduped: z.boolean(),
  }),
  z.object({ ok: z.literal(false), reason: chatActionErrorSchema }),
]);
export type ChatMessageAck = z.infer<typeof chatMessageAckSchema>;

/** Ack for `conversation:handback`. */
export const chatHandbackAckSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), reason: chatActionErrorSchema }),
]);
export type ChatHandbackAck = z.infer<typeof chatHandbackAckSchema>;

// --- server → client ---
export const chatTypingBroadcastSchema = z.object({
  conversationId: conversationIdSchema,
  from: chatParticipantSchema,
  isTyping: z.boolean(),
});
export type ChatTypingBroadcast = z.infer<typeof chatTypingBroadcastSchema>;

export const chatPresenceSchema = z.object({
  conversationId: conversationIdSchema,
  participant: chatParticipantSchema,
  status: z.enum(['joined', 'left']),
});
export type ChatPresence = z.infer<typeof chatPresenceSchema>;
