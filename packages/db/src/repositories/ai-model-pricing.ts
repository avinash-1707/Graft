import { eq, sql } from 'drizzle-orm';
import type { Database } from '../client.js';
import { aiModelPricing } from '../schema/ai-model-pricing.js';

export interface ModelPricingRow {
  model: string;
  promptMicroUsdPerMtok: number;
  completionMicroUsdPerMtok: number;
}

export async function getModelPricing(
  db: Database,
  model: string,
): Promise<ModelPricingRow | undefined> {
  return db.query.aiModelPricing.findFirst({
    where: eq(aiModelPricing.model, model),
    columns: { model: true, promptMicroUsdPerMtok: true, completionMicroUsdPerMtok: true },
  });
}

/** Bulk upsert from the daily OpenRouter pricing refresh. */
export async function upsertModelPricing(db: Database, rows: ModelPricingRow[]): Promise<void> {
  if (rows.length === 0) return;
  await db
    .insert(aiModelPricing)
    .values(rows.map((r) => ({ ...r, updatedAt: new Date() })))
    .onConflictDoUpdate({
      target: aiModelPricing.model,
      set: {
        promptMicroUsdPerMtok: sql`excluded.prompt_micro_usd_per_mtok`,
        completionMicroUsdPerMtok: sql`excluded.completion_micro_usd_per_mtok`,
        updatedAt: new Date(),
      },
    });
}
