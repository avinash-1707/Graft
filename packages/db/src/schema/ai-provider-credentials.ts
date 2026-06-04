import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';

/**
 * Per-tenant keyring: exactly one OpenRouter API key per organization (org id is the
 * PK). Both chat and embeddings route through this single key. Key material is
 * encrypted at rest (AES-256-GCM envelope) and decrypted only in-memory at call time.
 */
export const aiProviderCredentials = pgTable('ai_provider_credentials', {
  organizationId: uuid('organization_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  encryptedApiKey: text('encrypted_api_key').notNull(),
  encryptionIv: text('encryption_iv').notNull(),
  encryptionAuthTag: text('encryption_auth_tag').notNull(),
  encryptionKeyId: text('encryption_key_id').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
