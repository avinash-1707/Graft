import { createChatModel, DEFAULT_CHAT_MODELS } from '@graft/ai';
import type { Encryptor } from '@graft/crypto';
import { getAiProviderCredentialSecret, getAiSettings, type Database } from '@graft/db';
import type { ChatProvider } from '@graft/shared';
import type { LanguageModel } from 'ai';
import { decryptApiKey } from './decrypt.js';

/** Thrown when the org has no chat provider selected or its key is missing. */
export class ChatProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatProviderUnavailableError';
  }
}

export interface ResolvedChatModel {
  model: LanguageModel;
  provider: ChatProvider;
  /** Resolved model id (for AiInference accounting). */
  modelId: string;
  /**
   * Decrypted tenant key for the chat provider. Reused in-memory by ai-service for
   * the non-streamed turn classifier (same key as the answer) — never logged or
   * returned to a client.
   */
  apiKey: string;
}

/**
 * Resolves the tenant's chat provider + decrypted key into a ready
 * {@link LanguageModel} (mirrors {@link resolveEmbedder}). The provider is the org's
 * `ai_settings.chat_provider`; its key is decrypted in-memory only here. Returns the
 * provider + resolved model id alongside the model for usage accounting.
 */
export async function resolveChatModel(
  db: Database,
  encryptor: Encryptor,
  organizationId: string,
): Promise<ResolvedChatModel> {
  const { chatProvider } = await getAiSettings(db, organizationId);
  if (!chatProvider) {
    throw new ChatProviderUnavailableError('no chat provider selected for this organization');
  }

  const secret = await getAiProviderCredentialSecret(db, organizationId, chatProvider);
  if (!secret) {
    throw new ChatProviderUnavailableError(
      `no ${chatProvider} API key configured for this organization`,
    );
  }

  const apiKey = decryptApiKey(encryptor, secret);
  const model = createChatModel({ provider: chatProvider, apiKey });
  return { model, provider: chatProvider, modelId: DEFAULT_CHAT_MODELS[chatProvider], apiKey };
}
