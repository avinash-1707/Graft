import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { DEFAULT_CHAT_MODEL } from '@graft/shared';
import type { LanguageModel } from 'ai';

/**
 * Chat model construction over the Vercel AI SDK, routed through OpenRouter. Every
 * tenant brings one OpenRouter key; the upstream model is selected here by its
 * OpenRouter slug ({@link DEFAULT_CHAT_MODEL} when the tenant has no override). The
 * tenant's key is decrypted in-memory by the caller (keyring, mirroring the embedder)
 * and passed in; this package never touches the DB or the keyring.
 */
export { DEFAULT_CHAT_MODEL };

export interface ChatModelConfig {
  /** Tenant's OpenRouter API key; decrypted in-memory at call time. */
  apiKey: string;
  /** Override the default model slug (OpenRouter `vendor/model` form). */
  model?: string;
}

export function createChatModel(config: ChatModelConfig): LanguageModel {
  const model = config.model ?? DEFAULT_CHAT_MODEL;
  return createOpenRouter({ apiKey: config.apiKey })(model);
}
