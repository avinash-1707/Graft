import { z } from 'zod';
import { aiProviderSchema } from '../enums/ai-provider.js';

/**
 * Owner request to set (or replace) the tenant's AI provider API key. The raw
 * key is accepted here, encrypted at rest by the gateway, and never returned to
 * any client. Provider keys are opaque tokens with no whitespace.
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
 * Safe projection returned to the owner: confirms whether a key is configured
 * and which provider, but never exposes the key material itself.
 */
export const aiProviderCredentialStatusSchema = z.object({
  configured: z.boolean(),
  provider: aiProviderSchema.optional(),
  updatedAt: z.string().optional(),
});
export type AiProviderCredentialStatus = z.infer<typeof aiProviderCredentialStatusSchema>;
