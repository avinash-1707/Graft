import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { ChatProvider } from '@graft/shared';
import type { LanguageModel } from 'ai';

/**
 * Provider-agnostic chat model construction over the Vercel AI SDK. The chat
 * provider axis is OPENAI | ANTHROPIC (`chatProviderSchema`) — distinct from the
 * embedding axis (OPENAI | GEMINI). The tenant's key is decrypted in-memory by the
 * caller (ai-service, mirroring the ingestion worker's `resolveEmbedder`) and
 * passed in here; this package never touches the DB or the keyring.
 */
export const DEFAULT_CHAT_MODELS = {
  OPENAI: 'gpt-4o-mini',
  ANTHROPIC: 'claude-haiku-4-5',
} as const satisfies Record<ChatProvider, string>;

export interface ChatModelConfig {
  provider: ChatProvider;
  /** Tenant's API key for the chosen provider; decrypted in-memory at call time. */
  apiKey: string;
  /** Override the default model id. */
  model?: string;
}

export function createChatModel(config: ChatModelConfig): LanguageModel {
  const model = config.model ?? DEFAULT_CHAT_MODELS[config.provider];
  switch (config.provider) {
    case 'OPENAI':
      return createOpenAI({ apiKey: config.apiKey })(model);
    case 'ANTHROPIC':
      return createAnthropic({ apiKey: config.apiKey })(model);
  }
}
