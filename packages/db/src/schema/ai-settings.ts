import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';

/**
 * Per-org model selection (one row per org). Both axes route through the org's single
 * OpenRouter key; this records which OpenRouter model slug serves chat generation and
 * which serves embeddings. Null = use the platform default (resolved in code). The
 * embedding model must emit 1536-dim vectors to fit the shared pgvector column.
 */
export const aiSettings = pgTable('ai_settings', {
  organizationId: uuid('organization_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  chatModel: text('chat_model'),
  embeddingModel: text('embedding_model'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
