import { z } from 'zod';

/**
 * The three subscription tiers. Every org sits on exactly one. STARTER is the free
 * default (no Dodo subscription — its monthly credit allowance is granted by a cron
 * job); PRO and SCALE are paid Dodo subscriptions. Static per-tier config (price,
 * included credits, markup, BYOK) lives in the `billing_plans` table.
 */
export const billingPlanSchema = z.enum(['STARTER', 'PRO', 'SCALE']);

export type BillingPlan = z.infer<typeof billingPlanSchema>;
export const BillingPlan = billingPlanSchema.enum;

export const BILLING_PLANS = billingPlanSchema.options;
