import {
  pgTable,
  uuid,
  integer,
  text,
  timestamp,
  real,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { conversations } from './conversations.js';
import { users } from './users.js';
import { messageRolePgEnum } from './enums.js';

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    role: messageRolePgEnum('role').notNull(),
    content: text('content').notNull(),
    senderAgentId: uuid('sender_agent_id').references(() => users.id, { onDelete: 'set null' }),
    clientNonce: text('client_nonce'),
    groundingScore: real('grounding_score'),
    sentimentScore: real('sentiment_score'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('messages_conversation_sequence_idx').on(t.conversationId, t.sequence),
    uniqueIndex('messages_conversation_client_nonce_idx').on(t.conversationId, t.clientNonce),
    index('messages_org_idx').on(t.organizationId),
    index('messages_conversation_created_idx').on(t.conversationId, t.createdAt),
  ],
);
