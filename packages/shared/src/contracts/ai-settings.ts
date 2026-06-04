import { z } from 'zod';

/**
 * OpenRouter model slug, `vendor/model` form (e.g. `anthropic/claude-haiku-4-5`,
 * `openai/text-embedding-3-small`). Opaque to us beyond the shape check; OpenRouter
 * validates the model exists at call time.
 */
export const openRouterModelSchema = z
  .string()
  .trim()
  .min(3)
  .max(128)
  .regex(/^[\w.-]+\/[\w.:-]+$/, 'Must be an OpenRouter model slug, e.g. anthropic/claude-haiku-4-5');

/**
 * Per-org model selection (one row per org). Both axes route through the org's single
 * OpenRouter key; this records which model serves chat generation and which serves
 * embeddings. `null` = use the platform default ({@link DEFAULT_AI_SETTINGS} is the
 * null/null document; the effective default model lives in `@graft/ai` /`@graft/rag`).
 *
 * Changing `embeddingModel` re-bases the tenant's vector space — existing KB chunks
 * must be re-embedded before retrieval is comparable again.
 */
export const aiSettingsSchema = z.object({
  chatModel: openRouterModelSchema.nullable(),
  embeddingModel: openRouterModelSchema.nullable(),
});
export type AiSettings = z.infer<typeof aiSettingsSchema>;

/** Full-document update of the tenant's model selections. */
export const setAiSettingsRequestSchema = aiSettingsSchema;
export type SetAiSettingsRequest = z.infer<typeof setAiSettingsRequestSchema>;

export const DEFAULT_AI_SETTINGS: AiSettings = {
  chatModel: null,
  embeddingModel: null,
};

/**
 * Effective default models when a tenant leaves a selection `null`. Single source of
 * truth: `@graft/ai` and `@graft/rag` import these, and the dashboard shows them as
 * the placeholder/"(default)" option.
 */
export const DEFAULT_CHAT_MODEL = 'anthropic/claude-haiku-4-5';
export const DEFAULT_EMBEDDING_MODEL = 'openai/text-embedding-3-small';

/** Curated chat models surfaced in the settings dropdown (free-text custom allowed). */
export const SUGGESTED_CHAT_MODELS = [
  'anthropic/claude-haiku-4-5',
  'anthropic/claude-sonnet-4.6',
  'openai/gpt-4o-mini',
  'openai/gpt-4.1-mini',
  'google/gemini-2.5-flash',
  'meta-llama/llama-3.3-70b-instruct',
] as const;

/**
 * Curated embedding models. RESTRICTED to 1536-dimension models so they fit the
 * shared `vector(1536)` pgvector column; picking a different-width model would break
 * retrieval. Custom entries are accepted by the schema but must also be 1536-wide.
 */
export const SUGGESTED_EMBEDDING_MODELS = [
  'openai/text-embedding-3-small',
  'mistralai/mistral-embed',
] as const;
