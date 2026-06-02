import { z } from 'zod';
import { conversationStateSchema } from '../enums/conversation-state.js';
import { conversationIdSchema, sessionIdSchema } from './ids.js';
import { messageSchema } from './message.js';

/**
 * Widget session bootstrap. The widget sends its stored session UUID (if any);
 * the gateway validates it belongs to the resolved org and returns a usable id,
 * minting a new one when absent or not recognized.
 */
export const widgetSessionRequestSchema = z.object({
  sessionId: sessionIdSchema.optional(),
});
export type WidgetSessionRequest = z.infer<typeof widgetSessionRequestSchema>;

export const widgetSessionResponseSchema = z.object({
  sessionId: sessionIdSchema,
});
export type WidgetSessionResponse = z.infer<typeof widgetSessionResponseSchema>;

/**
 * A customer turn posted to the ai-service SSE endpoint. The session is carried in
 * the `x-graft-session-id` header (identity), the org via the embed token; the body
 * holds only the message payload. `clientNonce` makes the submit idempotent (dedup
 * on write) so a retry/reconnect never double-sends.
 */
export const widgetMessageBodySchema = z.object({
  content: z.string().min(1).max(8000),
  clientNonce: z.string().min(1).max(128),
});
export type WidgetMessageBody = z.infer<typeof widgetMessageBodySchema>;

/**
 * Resume snapshot for the widget. On (re)open the widget GETs the session's active
 * conversation: its current state + monotonic `lastSequence` (the cursor the client
 * seeds `lastRenderedSeq` from) and the full message history to paint the transcript.
 * `conversation` is null when the session has no open conversation yet (fresh start).
 * The AI turn stream (`POST /widget/messages`) carries everything after this snapshot.
 */
export const widgetConversationResponseSchema = z.object({
  conversation: z
    .object({
      id: conversationIdSchema,
      state: conversationStateSchema,
      lastSequence: z.int().nonnegative(),
    })
    .nullable(),
  messages: z.array(messageSchema),
});
export type WidgetConversationResponse = z.infer<typeof widgetConversationResponseSchema>;
