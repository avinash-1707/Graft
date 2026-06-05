import {
  addRolloverCredits,
  getBillingPlan,
  getModelPricing,
  resetMonthlyCredits,
  spendCredits,
  type Database,
} from '@graft/db';
import type { BillingPlan } from '@graft/shared';
import { computeCharge, type ChargeResult, type UsageTokens } from './cost.js';

export interface MeterUsageInput {
  organizationId: string;
  /** OpenRouter model slug used for this call. */
  model: string;
  usage: UsageTokens;
  markupBps: number;
  /** Stable id for idempotent deduction (e.g. the ai_inference id). */
  inferenceId: string;
  description?: string;
}

/**
 * Computes the charge for one metered call and debits it from the org's credit balance.
 * Returns the cost breakdown for recording on the inference row, or `null` when pricing
 * for the model is unknown (caller records null cost; no debit happens). Idempotent on
 * `inferenceId`.
 */
export async function meterUsage(
  db: Database,
  input: MeterUsageInput,
): Promise<ChargeResult | null> {
  const pricing = await getModelPricing(db, input.model);
  if (!pricing) return null;
  const result = computeCharge(input.usage, pricing, input.markupBps);
  if (result.chargeMicroUsd <= 0) return result;
  await spendCredits(db, {
    organizationId: input.organizationId,
    amountMicroUsd: result.chargeMicroUsd,
    sourceRef: input.inferenceId,
    description: input.description ?? 'AI usage',
    idempotencyKey: `usage:${input.inferenceId}`,
  });
  return result;
}

/** Grants (and resets) a tier's monthly included allowance. Idempotent on `idempotencyKey`. */
export async function grantMonthlyForPlan(
  db: Database,
  args: { organizationId: string; plan: BillingPlan; idempotencyKey: string; sourceRef?: string | null },
): Promise<void> {
  const plan = await getBillingPlan(db, args.plan);
  if (!plan) return;
  await resetMonthlyCredits(db, {
    organizationId: args.organizationId,
    allowanceMicroUsd: plan.includedCreditsMicroUsd,
    sourceRef: args.sourceRef ?? null,
    description: `Monthly ${plan.name} credits`,
    idempotencyKey: args.idempotencyKey,
  });
}

/** Adds purchased top-up (rollover) credits. Idempotent on `idempotencyKey`. */
export async function addTopupCredits(
  db: Database,
  args: {
    organizationId: string;
    amountMicroUsd: number;
    sourceRef?: string | null;
    description?: string;
    idempotencyKey: string;
  },
): Promise<void> {
  await addRolloverCredits(db, {
    organizationId: args.organizationId,
    amountMicroUsd: args.amountMicroUsd,
    entryType: 'TOPUP',
    source: 'dodo_payment',
    sourceRef: args.sourceRef ?? null,
    description: args.description ?? 'Credit top-up',
    idempotencyKey: args.idempotencyKey,
  });
}
