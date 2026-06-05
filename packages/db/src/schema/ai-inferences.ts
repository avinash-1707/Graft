import { pgTable, uuid, integer, text, boolean, real, timestamp, index } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { conversations } from './conversations.js';
import { messages } from './messages.js';
import { aiInferenceStatusPgEnum, aiProviderPgEnum, escalationTriggerPgEnum } from './enums.js';

export const aiInferences = pgTable(
  'ai_inferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id').references(() => messages.id, { onDelete: 'set null' }),
    provider: aiProviderPgEnum('provider').notNull(),
    model: text('model').notNull(),
    status: aiInferenceStatusPgEnum('status').notNull(),
    latencyMs: integer('latency_ms').notNull(),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    finishReason: text('finish_reason'),
    errorCode: text('error_code'),
    groundingScore: real('grounding_score'),
    retrievedChunksCount: integer('retrieved_chunks_count'),
    escalated: boolean('escalated').notNull().default(false),
    escalationTrigger: escalationTriggerPgEnum('escalation_trigger'),
    /** Real OpenRouter cost in micro-USD; null for BYOK/failed/unknown-pricing turns. */
    costMicroUsd: integer('cost_micro_usd'),
    /** Amount debited from the org's credit balance (cost × markup); null when unmetered. */
    chargedMicroUsd: integer('charged_micro_usd'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ai_inferences_org_created_idx').on(t.organizationId, t.createdAt),
    index('ai_inferences_conversation_idx').on(t.conversationId),
  ],
);
