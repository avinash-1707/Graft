import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { billingPlanPgEnum, pricingModePgEnum, subscriptionStatusPgEnum } from './enums.js';

/**
 * One row per org: which tier it sits on, how it pays for AI (CREDITS vs BYOK), and the
 * Dodo linkage. Defaults to the free STARTER tier on CREDITS with no Dodo subscription.
 */
export const orgSubscription = pgTable('org_subscription', {
  organizationId: uuid('organization_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  plan: billingPlanPgEnum('plan').notNull().default('STARTER'),
  pricingMode: pricingModePgEnum('pricing_mode').notNull().default('CREDITS'),
  status: subscriptionStatusPgEnum('status').notNull().default('none'),
  /** Dodo customer id (created lazily on first checkout). */
  dodoCustomerId: text('dodo_customer_id'),
  /** Dodo subscription id for paid tiers; null on the free tier. */
  dodoSubscriptionId: text('dodo_subscription_id'),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
