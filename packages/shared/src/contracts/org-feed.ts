import { z } from 'zod';
import { conversationStateSchema } from '../enums/conversation-state.js';
import { escalationTriggerSchema } from '../enums/escalation-trigger.js';
import {
  agentIdSchema,
  conversationIdSchema,
  organizationIdSchema,
  sessionIdSchema,
} from './ids.js';
import { messageSchema } from './message.js';

/**
 * Redis Pub/Sub channel for the org-wide dashboard conversation feed (unit 27). The
 * ai-service (AI turns + escalation) and chat-service (claim, human chat, handback)
 * publish org-tagged conversation events here; the chat-service feed subscriber
 * dispatches each to the dashboard SSE connections held for that organization.
 * Distinct from `AI_REALTIME_CHANNEL` (per-conversation customer delivery): this one
 * is org-scoped fan-out for the read-only agent overview.
 */
export const ORG_FEED_CHANNEL = 'graft:org:feed' as const;

/** SSE event name for the dashboard org-feed stream (one name, payload discriminates). */
export const ORG_FEED_EVENT_NAME = 'graft-feed' as const;

/**
 * A conversation card in the agent's live feed — a read-only projection of the
 * conversation row (no message bodies; those arrive as `message` events). Omits
 * `organizationId` (implied by the authenticated stream) and `closedAt` (the feed
 * only carries active conversations).
 */
export const orgFeedConversationSchema = z.object({
  id: conversationIdSchema,
  sessionId: sessionIdSchema,
  state: conversationStateSchema,
  assignedAgentId: agentIdSchema.nullable(),
  /** Reason the conversation moved to ESCALATION_PENDING; null otherwise. */
  escalationTrigger: escalationTriggerSchema.nullable(),
  lastSequence: z.int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type OrgFeedConversation = z.infer<typeof orgFeedConversationSchema>;

const conversationUpsertSchema = z.object({
  type: z.literal('conversation_upsert'),
  conversation: orgFeedConversationSchema,
});

const feedMessageSchema = z.object({
  type: z.literal('message'),
  conversationId: conversationIdSchema,
  message: messageSchema,
});

/**
 * The two event kinds that travel over Redis: a conversation summary upsert (new
 * conversation or a state/assignment change) and a newly-appended message (so agents
 * observe AI↔customer exchanges). The `snapshot` is connection-local — built from the
 * DB at connect time — and never published.
 */
export const orgFeedBusEventSchema = z.discriminatedUnion('type', [
  conversationUpsertSchema,
  feedMessageSchema,
]);
export type OrgFeedBusEvent = z.infer<typeof orgFeedBusEventSchema>;

/** Everything the dashboard SSE can receive: the initial snapshot plus live events. */
export const orgFeedEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('snapshot'),
    conversations: z.array(orgFeedConversationSchema),
  }),
  conversationUpsertSchema,
  feedMessageSchema,
]);
export type OrgFeedEvent = z.infer<typeof orgFeedEventSchema>;

/** A Redis-channel message: an org-tagged bus event for cross-instance fan-out. */
export const orgFeedMessageSchema = z.object({
  organizationId: organizationIdSchema,
  event: orgFeedBusEventSchema,
});
export type OrgFeedMessage = z.infer<typeof orgFeedMessageSchema>;
