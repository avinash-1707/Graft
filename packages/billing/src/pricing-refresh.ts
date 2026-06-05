import type { ModelPricingRow } from '@graft/db';

/**
 * OpenRouter publishes per-token USD prices (as decimal strings) at this public endpoint.
 * We convert to micro-USD per million tokens (× 1e12) for integer storage.
 */
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const USD_PER_TOKEN_TO_MICRO_USD_PER_MTOK = 1_000_000_000_000; // 1e6 micro/USD × 1e6 token/Mtok

interface OpenRouterModel {
  id: string;
  pricing?: { prompt?: string; completion?: string };
}

/**
 * Fetches the current OpenRouter model catalogue and maps it to pricing rows. Models with
 * unparseable or missing prices are skipped. Network/HTTP failures throw (caller logs and
 * keeps the previous prices).
 */
export async function fetchOpenRouterPricing(signal?: AbortSignal): Promise<ModelPricingRow[]> {
  const res = await fetch(OPENROUTER_MODELS_URL, signal ? { signal } : {});
  if (!res.ok) {
    throw new Error(`OpenRouter models fetch failed: ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as { data?: OpenRouterModel[] };
  const rows: ModelPricingRow[] = [];
  for (const model of body.data ?? []) {
    const prompt = Number.parseFloat(model.pricing?.prompt ?? '');
    const completion = Number.parseFloat(model.pricing?.completion ?? '');
    if (!Number.isFinite(prompt) || !Number.isFinite(completion)) continue;
    rows.push({
      model: model.id,
      promptMicroUsdPerMtok: Math.round(prompt * USD_PER_TOKEN_TO_MICRO_USD_PER_MTOK),
      completionMicroUsdPerMtok: Math.round(completion * USD_PER_TOKEN_TO_MICRO_USD_PER_MTOK),
    });
  }
  return rows;
}
