import { z } from 'zod';

/**
 * How an org pays for AI.
 * - `CREDITS`: AI runs on the platform OpenRouter key; every metered call is charged
 *   (real token cost × markup) against the org's prepaid credit balance.
 * - `BYOK`: AI runs on the org's own OpenRouter key; the platform meters nothing and
 *   charges nothing for AI (the secondary, opt-out path).
 */
export const pricingModeSchema = z.enum(['CREDITS', 'BYOK']);

export type PricingMode = z.infer<typeof pricingModeSchema>;
export const PricingMode = pricingModeSchema.enum;

export const PRICING_MODES = pricingModeSchema.options;
