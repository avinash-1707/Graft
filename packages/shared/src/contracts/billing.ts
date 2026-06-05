import { z } from 'zod';
import { billingPlanSchema } from '../enums/billing-plan.js';
import { pricingModeSchema } from '../enums/pricing-mode.js';
import { subscriptionStatusSchema } from '../enums/subscription-status.js';

/**
 * Static per-tier configuration, surfaced to the dashboard pricing UI. Amounts are
 * presented in whole USD (the durable source of truth is the `billing_plans` table in
 * micro-USD). `markupBps` is the gross margin applied to metered AI on this tier.
 */
export const planConfigSchema = z.object({
  id: billingPlanSchema,
  name: z.string().min(1).max(64),
  monthlyPriceUsd: z.number().nonnegative(),
  includedCreditsUsd: z.number().nonnegative(),
  markupBps: z.int().nonnegative(),
  byokAllowed: z.boolean(),
  topupAllowed: z.boolean(),
});
export type PlanConfig = z.infer<typeof planConfigSchema>;

/** Pay-as-you-go credit packs (buyable on any topup-enabled tier). Roll over, never expire. */
export const topupPackSchema = z.enum(['SMALL', 'MEDIUM', 'LARGE']);
export type TopupPack = z.infer<typeof topupPackSchema>;
export const TopupPack = topupPackSchema.enum;

/** Display value of each pack in whole USD (credits granted 1:1). Dodo product ids live in gateway env. */
export const TOPUP_PACK_USD: Record<TopupPack, number> = {
  SMALL: 10,
  MEDIUM: 25,
  LARGE: 50,
};

/** Everything the dashboard billing page needs in one read. */
export const billingSummarySchema = z.object({
  plan: billingPlanSchema,
  pricingMode: pricingModeSchema,
  subscriptionStatus: subscriptionStatusSchema,
  currentPeriodEnd: z.iso.datetime().nullable(),
  balanceMicroUsd: z.int(),
  /** Convenience: balance rendered in USD. */
  balanceUsd: z.number(),
  /** Friendly "≈ N messages" estimate derived from the balance. */
  estimatedMessages: z.int().nonnegative(),
  lowBalance: z.boolean(),
  /** Whether an OpenRouter key is configured (gates the BYOK toggle). */
  hasOwnKey: z.boolean(),
});
export type BillingSummary = z.infer<typeof billingSummarySchema>;

export const changePlanRequestSchema = z.object({ plan: billingPlanSchema });
export type ChangePlanRequest = z.infer<typeof changePlanRequestSchema>;

export const subscribeCheckoutRequestSchema = z.object({ plan: billingPlanSchema });
export type SubscribeCheckoutRequest = z.infer<typeof subscribeCheckoutRequestSchema>;

export const topupCheckoutRequestSchema = z.object({ pack: topupPackSchema });
export type TopupCheckoutRequest = z.infer<typeof topupCheckoutRequestSchema>;

export const pricingModeUpdateRequestSchema = z.object({ mode: pricingModeSchema });
export type PricingModeUpdateRequest = z.infer<typeof pricingModeUpdateRequestSchema>;

/** Hosted Dodo checkout URL the dashboard redirects to. */
export const checkoutSessionResponseSchema = z.object({ url: z.url() });
export type CheckoutSessionResponse = z.infer<typeof checkoutSessionResponseSchema>;
