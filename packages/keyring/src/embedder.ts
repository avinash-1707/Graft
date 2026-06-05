import { resolveBillingMode } from '@graft/billing';
import type { Encryptor } from '@graft/crypto';
import { getAiSettings, type Database } from '@graft/db';
import { createEmbedder, DEFAULT_EMBEDDING_MODEL, type Embedder } from '@graft/rag';
import type { PricingMode } from '@graft/shared';
import { resolveApiKey, type ResolveOptions } from './chat-model.js';

/** Thrown when no usable AI key is available for the org. */
export class EmbeddingProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmbeddingProviderUnavailableError';
  }
}

export interface ResolvedEmbedder {
  embedder: Embedder;
  modelId: string;
  /** CREDITS embeddings run on the platform key; BYOK on the org key. */
  billingMode: PricingMode;
  markupBps: number;
}

/**
 * Resolves an {@link Embedder} and which key backs it (platform under CREDITS, org's own
 * under BYOK), mirroring {@link resolveChatModel}. Shared by the ingestion worker (chunk
 * embedding) and ai-service (query embedding). The model is `ai_settings.embedding_model`
 * or {@link DEFAULT_EMBEDDING_MODEL}.
 */
export async function resolveEmbedder(
  db: Database,
  encryptor: Encryptor,
  organizationId: string,
  opts: ResolveOptions = {},
): Promise<ResolvedEmbedder> {
  const billing = await resolveBillingMode(db, organizationId);
  const { embeddingModel } = await getAiSettings(db, organizationId);
  const modelId = embeddingModel ?? DEFAULT_EMBEDDING_MODEL;
  const apiKey = await resolveApiKey(db, encryptor, organizationId, billing.mode, opts);
  return {
    embedder: createEmbedder({ apiKey, model: modelId }),
    modelId,
    billingMode: billing.mode,
    markupBps: billing.markupBps,
  };
}
