import {
  pgTable,
  uuid,
  integer,
  bigint,
  text,
  real,
  timestamp,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { aiProviderPgEnum } from './enums.js';

export const aiMetricsDaily = pgTable(
  'ai_metrics_daily',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    bucketStart: timestamp('bucket_start', { withTimezone: true }).notNull(),
    provider: aiProviderPgEnum('provider').notNull(),
    model: text('model').notNull(),
    requestCount: integer('request_count').notNull().default(0),
    successCount: integer('success_count').notNull().default(0),
    errorCount: integer('error_count').notNull().default(0),
    cancelledCount: integer('cancelled_count').notNull().default(0),
    escalationCount: integer('escalation_count').notNull().default(0),
    latencyP50Ms: integer('latency_p50_ms').notNull().default(0),
    latencyP95Ms: integer('latency_p95_ms').notNull().default(0),
    latencySumMs: bigint('latency_sum_ms', { mode: 'number' }).notNull().default(0),
    totalPromptTokens: bigint('total_prompt_tokens', { mode: 'number' }).notNull().default(0),
    totalCompletionTokens: bigint('total_completion_tokens', { mode: 'number' })
      .notNull()
      .default(0),
    groundingScoreSum: real('grounding_score_sum').notNull().default(0),
    groundingScoreCount: integer('grounding_score_count').notNull().default(0),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({
      name: 'ai_metrics_daily_pkey',
      columns: [t.organizationId, t.bucketStart, t.provider, t.model],
    }),
  ],
);
