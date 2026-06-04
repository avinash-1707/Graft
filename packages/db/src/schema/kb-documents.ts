import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { users } from './auth.js';
import { kbDocumentStatusPgEnum, kbDocumentTypePgEnum } from './enums.js';

export const kbDocuments = pgTable(
  'kb_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    fileType: kbDocumentTypePgEnum('file_type').notNull(),
    byteSize: integer('byte_size').notNull(),
    status: kbDocumentStatusPgEnum('status').notNull().default('PENDING'),
    error: text('error'),
    uploadedByAgentId: uuid('uploaded_by_agent_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (t) => [
    index('kb_documents_org_idx').on(t.organizationId),
    index('kb_documents_org_status_idx').on(t.organizationId, t.status),
  ],
);
