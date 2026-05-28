import { z } from 'zod';
import { conversationStateSchema } from '../enums/conversation-state.js';
import { transportSchema } from '../enums/transport.js';
import { escalationTriggerSchema } from '../enums/escalation-trigger.js';
import {
  conversationIdSchema,
  messageIdSchema,
} from './ids.js';
import { messageSchema, messageSequenceSchema } from './message.js';

const clientNonceSchema = z.string().min(1).max(128);

export const customerMessageEventSchema = z.object({
  type: z.literal('customer_message'),
  content: z.string().min(1).max(8000),
  clientNonce: clientNonceSchema,
});
export type CustomerMessageEvent = z.infer<typeof customerMessageEventSchema>;

export const replayRequestEventSchema = z.object({
  type: z.literal('replay_request'),
  lastSequence: z.int().nonnegative(),
});
export type ReplayRequestEvent = z.infer<typeof replayRequestEventSchema>;

export const clientEventSchema = z.discriminatedUnion('type', [
  customerMessageEventSchema,
  replayRequestEventSchema,
]);
export type ClientEvent = z.infer<typeof clientEventSchema>;

export const aiTokenEventSchema = z.object({
  type: z.literal('ai_token'),
  messageId: messageIdSchema,
  conversationId: conversationIdSchema,
  token: z.string(),
});
export type AiTokenEvent = z.infer<typeof aiTokenEventSchema>;

export const messageAppendedEventSchema = z.object({
  type: z.literal('message_appended'),
  message: messageSchema,
});
export type MessageAppendedEvent = z.infer<typeof messageAppendedEventSchema>;

export const stateChangedEventSchema = z.object({
  type: z.literal('state_changed'),
  conversationId: conversationIdSchema,
  state: conversationStateSchema,
  trigger: escalationTriggerSchema.nullable(),
});
export type StateChangedEvent = z.infer<typeof stateChangedEventSchema>;

export const transportSwitchEventSchema = z.object({
  type: z.literal('transport_switch'),
  conversationId: conversationIdSchema,
  to: transportSchema,
  customerFacingCopy: z.string(),
});
export type TransportSwitchEvent = z.infer<typeof transportSwitchEventSchema>;

export const typingEventSchema = z.object({
  type: z.literal('typing'),
  conversationId: conversationIdSchema,
  from: z.enum(['CUSTOMER', 'AGENT']),
  isTyping: z.boolean(),
});
export type TypingEvent = z.infer<typeof typingEventSchema>;

export const replayBatchEventSchema = z.object({
  type: z.literal('replay_batch'),
  conversationId: conversationIdSchema,
  fromSequence: messageSequenceSchema,
  messages: z.array(messageSchema),
});
export type ReplayBatchEvent = z.infer<typeof replayBatchEventSchema>;

export const serverEventSchema = z.discriminatedUnion('type', [
  aiTokenEventSchema,
  messageAppendedEventSchema,
  stateChangedEventSchema,
  transportSwitchEventSchema,
  typingEventSchema,
  replayBatchEventSchema,
]);
export type ServerEvent = z.infer<typeof serverEventSchema>;
