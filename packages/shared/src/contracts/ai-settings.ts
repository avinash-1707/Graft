import { z } from 'zod';
import { chatProviderSchema } from '../enums/ai-provider.js';
import { embeddingProviderSchema } from '../enums/embedding-provider.js';

/**
 * Which provider the tenant uses for each axis. The key for the chosen provider
 * must exist in the keyring (validated at the route). `null` means "not selected
 * yet". Chat and embeddings are independent: a tenant may run chat on Anthropic
 * and embeddings on Gemini, or share one OpenAI key for both.
 */
export const aiSettingsSchema = z.object({
  chatProvider: chatProviderSchema.nullable(),
  embeddingProvider: embeddingProviderSchema.nullable(),
});
export type AiSettings = z.infer<typeof aiSettingsSchema>;

/** Full-document update of the tenant's provider selections. */
export const setAiSettingsRequestSchema = z.object({
  chatProvider: chatProviderSchema.nullable(),
  embeddingProvider: embeddingProviderSchema.nullable(),
});
export type SetAiSettingsRequest = z.infer<typeof setAiSettingsRequestSchema>;

export const DEFAULT_AI_SETTINGS: AiSettings = {
  chatProvider: null,
  embeddingProvider: null,
};
