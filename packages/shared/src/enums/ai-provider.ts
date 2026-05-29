import { z } from 'zod';

/**
 * Every AI provider a tenant may hold a key for (the credential keyring's provider
 * axis). Usage is selected separately: chat picks from {@link chatProviderSchema}
 * (OPENAI | ANTHROPIC), embeddings from `embeddingProviderSchema` (OPENAI | GEMINI).
 */
export const aiProviderSchema = z.enum(['OPENAI', 'ANTHROPIC', 'GEMINI']);

export type AiProvider = z.infer<typeof aiProviderSchema>;
export const AiProvider = aiProviderSchema.enum;

export const AI_PROVIDERS = aiProviderSchema.options;

/** Providers usable for chat generation (subset of {@link aiProviderSchema}). */
export const chatProviderSchema = z.enum(['OPENAI', 'ANTHROPIC']);

export type ChatProvider = z.infer<typeof chatProviderSchema>;
export const ChatProvider = chatProviderSchema.enum;

export const CHAT_PROVIDERS = chatProviderSchema.options;
