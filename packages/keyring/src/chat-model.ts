import { createChatModel, DEFAULT_CHAT_MODEL } from '@graft/ai';
import type { Encryptor } from '@graft/crypto';
import { getAiProviderCredentialSecret, getAiSettings, type Database } from '@graft/db';
import { AiProvider, type AiProvider as AiProviderType } from '@graft/shared';
import type { LanguageModel } from 'ai';
import { decryptApiKey } from './decrypt.js';

/** Thrown when the org has no OpenRouter key configured. */
export class ChatProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatProviderUnavailableError';
  }
}

export interface ResolvedChatModel {
  model: LanguageModel;
  /** Always OPENROUTER — retained for AiInference accounting. */
  provider: AiProviderType;
  /** Resolved model slug (for AiInference accounting). */
  modelId: string;
  /**
   * Decrypted tenant OpenRouter key. Reused in-memory by ai-service for the
   * non-streamed turn classifier (same key as the answer) — never logged or returned
   * to a client.
   */
  apiKey: string;
}

/**
 * Resolves the tenant's OpenRouter key + chosen chat model into a ready
 * {@link LanguageModel} (mirrors {@link resolveEmbedder}). The key is decrypted
 * in-memory only here; the model is `ai_settings.chat_model` or
 * {@link DEFAULT_CHAT_MODEL}. Returns the resolved model slug for usage accounting.
 */
export async function resolveChatModel(
  db: Database,
  encryptor: Encryptor,
  organizationId: string,
): Promise<ResolvedChatModel> {
  const secret = await getAiProviderCredentialSecret(db, organizationId);
  if (!secret) {
    throw new ChatProviderUnavailableError('no OpenRouter API key configured for this organization');
  }

  const { chatModel } = await getAiSettings(db, organizationId);
  const modelId = chatModel ?? DEFAULT_CHAT_MODEL;
  const apiKey = decryptApiKey(encryptor, secret);
  const model = createChatModel({ apiKey, model: modelId });
  return { model, provider: AiProvider.OPENROUTER, modelId, apiKey };
}
