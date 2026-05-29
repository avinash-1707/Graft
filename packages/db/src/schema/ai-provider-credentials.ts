import { pgTable, uuid, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { aiProviderPgEnum } from './enums.js';

/**
 * Per-tenant keyring: at most one API key per (organization, provider). A tenant
 * may hold keys for several providers (e.g. Anthropic for chat + OpenAI for
 * embeddings). Which key is used for what is recorded in `ai_settings`. Key
 * material is encrypted at rest (AES-256-GCM envelope) and decrypted only
 * in-memory at call time.
 */
export const aiProviderCredentials = pgTable(
  'ai_provider_credentials',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    provider: aiProviderPgEnum('provider').notNull(),
    encryptedApiKey: text('encrypted_api_key').notNull(),
    encryptionIv: text('encryption_iv').notNull(),
    encryptionAuthTag: text('encryption_auth_tag').notNull(),
    encryptionKeyId: text('encryption_key_id').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.provider] })],
);
