import { z } from 'zod';

/**
 * Embedding providers a tenant may pick for KB vectorization. Distinct from
 * {@link AiProvider} (chat generation, OPENAI | ANTHROPIC): Anthropic has no
 * embedding API, and Gemini is embedding-only here. A tenant's embedding provider
 * and chat provider are independent axes and may require separate API keys.
 */
export const embeddingProviderSchema = z.enum(['OPENAI', 'GEMINI']);

export type EmbeddingProvider = z.infer<typeof embeddingProviderSchema>;
export const EmbeddingProvider = embeddingProviderSchema.enum;

export const EMBEDDING_PROVIDERS = embeddingProviderSchema.options;
