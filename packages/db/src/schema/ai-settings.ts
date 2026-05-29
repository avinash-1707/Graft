import { pgTable, uuid, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { aiProviderPgEnum } from './enums.js';

/**
 * Per-org provider selection (one row per org). Records which keyring provider is
 * used for chat generation and which for embeddings. Null = not selected yet. The
 * selected provider's key must exist in `ai_provider_credentials` (enforced at the
 * gateway route, not the DB). The enum is the full provider set; the route
 * constrains chat to OPENAI|ANTHROPIC and embeddings to OPENAI|GEMINI.
 */
export const aiSettings = pgTable('ai_settings', {
  organizationId: uuid('organization_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  chatProvider: aiProviderPgEnum('chat_provider'),
  embeddingProvider: aiProviderPgEnum('embedding_provider'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
