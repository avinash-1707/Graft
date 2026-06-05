import { z } from 'zod';

/**
 * Mirror of the Dodo subscription lifecycle (plus a local `none` for free-tier orgs
 * with no Dodo subscription). Drives whether the plan's monthly allowance is granted
 * and whether the dashboard surfaces a payment-recovery banner.
 */
export const subscriptionStatusSchema = z.enum([
  'none',
  'pending',
  'active',
  'on_hold',
  'cancelled',
  'expired',
]);

export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;
export const SubscriptionStatus = subscriptionStatusSchema.enum;

export const SUBSCRIPTION_STATUSES = subscriptionStatusSchema.options;
