import { z } from 'zod';

/**
 * Owner request to set (or replace) the tenant's OpenRouter API key. The raw key is
 * accepted here, encrypted at rest by the gateway, and never returned to any client.
 * One key per org; re-setting rotates it. OpenRouter keys are opaque tokens with no
 * whitespace.
 */
export const setAiProviderCredentialRequestSchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(16, 'API key looks too short')
    .max(512)
    .regex(/^\S+$/, 'API key must not contain whitespace'),
});
export type SetAiProviderCredentialRequest = z.infer<typeof setAiProviderCredentialRequestSchema>;

/**
 * Safe projection of the tenant keyring: whether an OpenRouter key is configured and
 * when it was last set (`null` when none). Never exposes the key material itself.
 */
export const aiCredentialStatusSchema = z.object({
  configured: z.boolean(),
  updatedAt: z.string().nullable(),
});
export type AiCredentialStatus = z.infer<typeof aiCredentialStatusSchema>;
