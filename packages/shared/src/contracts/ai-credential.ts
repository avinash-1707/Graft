import { z } from 'zod';
import { aiProviderSchema } from '../enums/ai-provider.js';

/**
 * Owner request to set (or replace) one provider's API key in the tenant keyring.
 * The raw key is accepted here, encrypted at rest by the gateway, and never
 * returned to any client. Provider keys are opaque tokens with no whitespace.
 * One key per (org, provider); re-setting the same provider rotates its key.
 */
export const setAiProviderCredentialRequestSchema = z.object({
  provider: aiProviderSchema,
  apiKey: z
    .string()
    .trim()
    .min(16, 'API key looks too short')
    .max(512)
    .regex(/^\S+$/, 'API key must not contain whitespace'),
});
export type SetAiProviderCredentialRequest = z.infer<typeof setAiProviderCredentialRequestSchema>;

/**
 * Safe projection of one configured key: which provider + when it was last set.
 * Never exposes the key material itself.
 */
export const aiProviderCredentialSummarySchema = z.object({
  provider: aiProviderSchema,
  updatedAt: z.string(),
});
export type AiProviderCredentialSummary = z.infer<typeof aiProviderCredentialSummarySchema>;

/** The tenant's full keyring status: the set of providers that have a key. */
export const aiCredentialStatusSchema = z.object({
  credentials: z.array(aiProviderCredentialSummarySchema),
});
export type AiCredentialStatus = z.infer<typeof aiCredentialStatusSchema>;
