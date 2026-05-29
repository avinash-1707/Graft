import {
  pgTable,
  uuid,
  integer,
  text,
  timestamp,
  index,
  vector,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { kbDocuments } from './kb-documents.js';

export const EMBEDDING_DIMENSIONS = 1536;

export const kbChunks = pgTable(
  'kb_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => kbDocuments.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('kb_chunks_org_idx').on(t.organizationId),
    index('kb_chunks_document_idx').on(t.documentId),
    index('kb_chunks_embedding_hnsw_idx')
      .using('hnsw', t.embedding.op('vector_cosine_ops')),
  ],
);
