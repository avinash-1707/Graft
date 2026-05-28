import { z } from 'zod';

export const aiProviderSchema = z.enum(['OPENAI', 'ANTHROPIC']);

export type AiProvider = z.infer<typeof aiProviderSchema>;
export const AiProvider = aiProviderSchema.enum;

export const AI_PROVIDERS = aiProviderSchema.options;
