import { TOKENS_PER_PRICE_UNIT } from '@graft/shared';
import type { ModelPricingRow } from '@graft/db';

export interface UsageTokens {
  promptTokens: number;
  completionTokens: number;
}

export interface ChargeResult {
  /** Our real OpenRouter cost, micro-USD. */
  costMicroUsd: number;
  /** What we bill the org: cost × (1 + markup), micro-USD. */
  chargeMicroUsd: number;
}

/**
 * Computes the real cost and marked-up charge for one metered call. Token prices are
 * stored per million tokens, so divide by {@link TOKENS_PER_PRICE_UNIT}. Markup is in
 * basis points (2500 = +25%). Both results are rounded to whole micro-USD.
 */
export function computeCharge(
  usage: UsageTokens,
  pricing: ModelPricingRow,
  markupBps: number,
): ChargeResult {
  const costMicroUsd = Math.round(
    (usage.promptTokens * pricing.promptMicroUsdPerMtok +
      usage.completionTokens * pricing.completionMicroUsdPerMtok) /
      TOKENS_PER_PRICE_UNIT,
  );
  const chargeMicroUsd = Math.round((costMicroUsd * (10_000 + markupBps)) / 10_000);
  return { costMicroUsd, chargeMicroUsd };
}
