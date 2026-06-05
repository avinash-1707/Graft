import { DEFAULT_MARKUP_BPS, type BillingPlan, type PricingMode } from '@graft/shared';
import { getBillingPlan, getOrgSubscription, type Database } from '@graft/db';

export interface ResolvedBillingMode {
  mode: PricingMode;
  plan: BillingPlan;
  /** Markup for this org's tier, basis points. */
  markupBps: number;
  /** Monthly included allowance for this tier, micro-USD. */
  includedCreditsMicroUsd: number;
  byokAllowed: boolean;
}

/**
 * Resolves how an org pays for AI: its pricing mode (CREDITS vs BYOK), tier, and the
 * tier's markup/allowance. Consumed by the keyring (which key to use) and ai-service
 * (whether and how much to meter). Falls back to safe STARTER/CREDITS defaults.
 */
export async function resolveBillingMode(
  db: Database,
  organizationId: string,
): Promise<ResolvedBillingMode> {
  const sub = await getOrgSubscription(db, organizationId);
  const plan = await getBillingPlan(db, sub.plan);
  return {
    mode: sub.pricingMode,
    plan: sub.plan,
    markupBps: plan?.markupBps ?? DEFAULT_MARKUP_BPS,
    includedCreditsMicroUsd: plan?.includedCreditsMicroUsd ?? 0,
    byokAllowed: plan?.byokAllowed ?? true,
  };
}
