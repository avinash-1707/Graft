import { pgTable, uuid, boolean, real, integer, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';

export const escalationConfigs = pgTable('escalation_configs', {
  organizationId: uuid('organization_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  thirdHumanRequestEnabled: boolean('third_human_request_enabled').notNull().default(true),
  humanRequestCountToEscalate: integer('human_request_count_to_escalate').notNull().default(3),
  humanRequestConfidenceThreshold: real('human_request_confidence_threshold')
    .notNull()
    .default(0.7),
  weakGroundingEnabled: boolean('weak_grounding_enabled').notNull().default(true),
  weakGroundingThreshold: real('weak_grounding_threshold').notNull().default(0.7),
  modelInvokedEnabled: boolean('model_invoked_enabled').notNull().default(true),
  negativeSentimentEnabled: boolean('negative_sentiment_enabled').notNull().default(false),
  negativeSentimentThreshold: real('negative_sentiment_threshold').notNull().default(0.7),
  providerFailureEnabled: boolean('provider_failure_enabled').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
