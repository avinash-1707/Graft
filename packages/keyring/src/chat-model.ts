import { createChatModel, DEFAULT_CHAT_MODEL } from '@graft/ai';
import { resolveBillingMode } from '@graft/billing';
import type { Encryptor } from '@graft/crypto';
import { getAiProviderCredentialSecret, getAiSettings, type Database } from '@graft/db';
import { AiProvider, type AiProvider as AiProviderType, type PricingMode } from '@graft/shared';
import type { LanguageModel } from 'ai';
import { decryptApiKey } from './decrypt.js';

/** Thrown when no usable AI key is available for the org (BYOK key missing, or no platform key). */
export class ChatProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatProviderUnavailableError';
  }
}

export interface ResolveOptions {
  /** Platform OpenRouter key, used for orgs on the CREDITS pricing mode. */
  platformApiKey?: string;
}

export interface ResolvedChatModel {
  model: LanguageModel;
  /** Always OPENROUTER — retained for AiInference accounting. */
  provider: AiProviderType;
  /** Resolved model slug (for AiInference accounting). */
  modelId: string;
  /**
   * Decrypted key in use (org's under BYOK, platform's under CREDITS). Reused in-memory
   * by the turn classifier — never logged or returned to a client.
   */
  apiKey: string;
  /** How this org pays: CREDITS turns get metered + debited, BYOK turns do not. */
  billingMode: PricingMode;
  /** Markup (bps) to apply when metering a CREDITS turn. */
  markupBps: number;
}

/**
 * Resolves the chat {@link LanguageModel} and which key backs it. Under CREDITS the call
 * runs on the platform key (and the caller meters/debits); under BYOK it runs on the org's
 * own decrypted key (no charge). The model slug is `ai_settings.chat_model` or
 * {@link DEFAULT_CHAT_MODEL}.
 */
export async function resolveChatModel(
  db: Database,
  encryptor: Encryptor,
  organizationId: string,
  opts: ResolveOptions = {},
): Promise<ResolvedChatModel> {
  const billing = await resolveBillingMode(db, organizationId);
  const { chatModel } = await getAiSettings(db, organizationId);
  const modelId = chatModel ?? DEFAULT_CHAT_MODEL;
  const apiKey = await resolveApiKey(db, encryptor, organizationId, billing.mode, opts);
  const model = createChatModel({ apiKey, model: modelId });
  return {
    model,
    provider: AiProvider.OPENROUTER,
    modelId,
    apiKey,
    billingMode: billing.mode,
    markupBps: billing.markupBps,
  };
}

/**
 * Picks the API key for the org's pricing mode. CREDITS → platform key (must be
 * configured); BYOK → the org's decrypted OpenRouter key (must exist). Shared by the
 * chat and embedding resolvers.
 */
export async function resolveApiKey(
  db: Database,
  encryptor: Encryptor,
  organizationId: string,
  mode: PricingMode,
  opts: ResolveOptions,
): Promise<string> {
  if (mode === 'CREDITS') {
    if (!opts.platformApiKey) {
      throw new ChatProviderUnavailableError('platform OpenRouter key is not configured');
    }
    return opts.platformApiKey;
  }
  const secret = await getAiProviderCredentialSecret(db, organizationId);
  if (!secret) {
    throw new ChatProviderUnavailableError('no OpenRouter API key configured for this organization');
  }
  return decryptApiKey(encryptor, secret);
}
