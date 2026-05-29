import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { aiProviderPgEnum } from './enums.js';

export const aiProviderCredentials = pgTable('ai_provider_credentials', {
  organizationId: uuid('organization_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  provider: aiProviderPgEnum('provider').notNull(),
  encryptedApiKey: text('encrypted_api_key').notNull(),
  encryptionIv: text('encryption_iv').notNull(),
  encryptionAuthTag: text('encryption_auth_tag').notNull(),
  encryptionKeyId: text('encryption_key_id').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
