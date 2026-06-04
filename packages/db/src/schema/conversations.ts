import { pgTable, uuid, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { sessions } from './sessions.js';
import { users } from './auth.js';
import { conversationStatePgEnum, escalationTriggerPgEnum } from './enums.js';

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    state: conversationStatePgEnum('state').notNull().default('AI_ACTIVE'),
    assignedAgentId: uuid('assigned_agent_id').references(() => users.id, { onDelete: 'set null' }),
    escalationTrigger: escalationTriggerPgEnum('escalation_trigger'),
    humanRequestCount: integer('human_request_count').notNull().default(0),
    lastSequence: integer('last_sequence').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => [
    index('conversations_org_idx').on(t.organizationId),
    index('conversations_org_state_idx').on(t.organizationId, t.state),
    index('conversations_session_idx').on(t.sessionId),
    index('conversations_assigned_agent_idx').on(t.assignedAgentId),
  ],
);
