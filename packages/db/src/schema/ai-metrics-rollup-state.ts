import { pgTable, text, timestamp, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const aiMetricsRollupState = pgTable(
  'ai_metrics_rollup_state',
  {
    id: text('id').primaryKey().default('singleton'),
    last15mBucket: timestamp('last_15m_bucket', { withTimezone: true }),
    lastDailyBucket: timestamp('last_daily_bucket', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('ai_metrics_rollup_state_singleton_chk', sql`${t.id} = 'singleton'`)],
);
