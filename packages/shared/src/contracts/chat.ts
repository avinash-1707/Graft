import { z } from 'zod';
import { conversationIdSchema } from './ids.js';

/** Socket.IO event names for the human-chat (WebSocket) transport. */
export const CHAT_EVENTS = {
  /** client → server: join a conversation room (ack'd). */
  JOIN: 'conversation:join',
  /** client → server AND server → client: typing indicator. */
  TYPING: 'typing',
  /** server → client: a participant joined/left the conversation. */
  PRESENCE: 'presence',
} as const;

export const chatParticipantSchema = z.enum(['AGENT', 'CUSTOMER']);
export type ChatParticipant = z.infer<typeof chatParticipantSchema>;

// --- client → server ---
export const chatJoinSchema = z.object({ conversationId: conversationIdSchema });
export type ChatJoin = z.infer<typeof chatJoinSchema>;

export const chatTypingSchema = z.object({
  conversationId: conversationIdSchema,
  isTyping: z.boolean(),
});
export type ChatTyping = z.infer<typeof chatTypingSchema>;

/** Ack returned to the client for a `conversation:join`. */
export const chatJoinAckSchema = z.object({ ok: z.boolean(), error: z.string().optional() });
export type ChatJoinAck = z.infer<typeof chatJoinAckSchema>;

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
