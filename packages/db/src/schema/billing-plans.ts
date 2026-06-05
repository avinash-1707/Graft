import { pgTable, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { billingPlanPgEnum } from './enums.js';

/**
 * Static per-tier configuration (3 rows: STARTER/PRO/SCALE), seeded by migration and
 * tunable by an operator. Money columns are micro-USD integers. The Dodo product id is
 * null for the free STARTER tier (no Dodo subscription — its allowance is granted by a
 * cron job).
 */
export const billingPlans = pgTable('billing_plans', {
  id: billingPlanPgEnum('id').primaryKey(),
  name: text('name').notNull(),
  /** Dodo subscription product id; null for the free tier. */
  dodoProductId: text('dodo_product_id'),
  monthlyPriceMicroUsd: integer('monthly_price_micro_usd').notNull(),
  /** Credits granted (and reset) each billing cycle, micro-USD. */
  includedCreditsMicroUsd: integer('included_credits_micro_usd').notNull(),
  /** Gross margin applied to metered AI on this tier, in basis points (2500 = 25%). */
  markupBps: integer('markup_bps').notNull(),
  byokAllowed: boolean('byok_allowed').notNull().default(true),
  topupAllowed: boolean('topup_allowed').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
