import { pgTable, uuid, bigint, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';

/**
 * Fast O(1) balance read for the pre-call gate and dashboard. One row per org, kept in
 * sync with `credit_ledger` inside the same transaction as every change.
 *
 * Two buckets implement the lifecycle rule: the **monthly** allowance is use-it-or-lose-it
 * (reset each billing cycle), while purchased **rollover** (top-up) credits persist. The
 * gate and "balance" shown to users are the sum of both. Usage draws down monthly first,
 * then rollover (which may dip slightly negative for the single in-flight overdraft turn;
 * the next turn's gate then blocks). `mode: 'number'` is safe — values stay well within
 * 2^53 micro-USD (~$9B).
 */
export const orgCreditBalance = pgTable('org_credit_balance', {
  organizationId: uuid('organization_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  /** Current-cycle included allowance remaining; reset on renewal. */
  monthlyBalanceMicroUsd: bigint('monthly_balance_micro_usd', { mode: 'number' })
    .notNull()
    .default(0),
  /** Purchased top-up credits; carry over across cycles. */
  rolloverBalanceMicroUsd: bigint('rollover_balance_micro_usd', { mode: 'number' })
    .notNull()
    .default(0),
  lifetimeGrantedMicroUsd: bigint('lifetime_granted_micro_usd', { mode: 'number' })
    .notNull()
    .default(0),
  lifetimeSpentMicroUsd: bigint('lifetime_spent_micro_usd', { mode: 'number' }).notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
