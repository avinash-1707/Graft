import { pgTable, text, bigint, timestamp } from 'drizzle-orm/pg-core';

/**
 * OpenRouter model price table, refreshed daily from `GET /api/v1/models`. Prices are
 * micro-USD **per million tokens** (so sub-cent-per-Mtok models keep integer precision).
 * Used to compute the real cost of a metered call: tokens × price / 1e6.
 */
export const aiModelPricing = pgTable('ai_model_pricing', {
  /** OpenRouter model slug, e.g. `anthropic/claude-haiku-4-5`. */
  model: text('model').primaryKey(),
  promptMicroUsdPerMtok: bigint('prompt_micro_usd_per_mtok', { mode: 'number' }).notNull(),
  completionMicroUsdPerMtok: bigint('completion_micro_usd_per_mtok', { mode: 'number' }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
