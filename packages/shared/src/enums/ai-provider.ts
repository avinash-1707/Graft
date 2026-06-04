import { z } from 'zod';

/**
 * The single AI provider the platform routes through. Every tenant brings one
 * OpenRouter key, and both chat generation and embeddings are served through
 * OpenRouter's unified API (the specific upstream model is chosen per axis in code,
 * e.g. `anthropic/claude-haiku-4-5` for chat, `openai/text-embedding-3-small` for
 * embeddings). The enum is kept (rather than dropped) so the credential keyring and
 * AI-metrics tables retain a stable `provider` axis for accounting.
 */
export const aiProviderSchema = z.enum(['OPENROUTER']);

export type AiProvider = z.infer<typeof aiProviderSchema>;
export const AiProvider = aiProviderSchema.enum;

export const AI_PROVIDERS = aiProviderSchema.options;
