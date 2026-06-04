import type { Encryptor } from '@graft/crypto';
import { getAiProviderCredentialSecret, getAiSettings, type Database } from '@graft/db';
import { createEmbedder, DEFAULT_EMBEDDING_MODEL, type Embedder } from '@graft/rag';
import { decryptApiKey } from './decrypt.js';

/** Thrown when the org has no OpenRouter key configured. */
export class EmbeddingProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmbeddingProviderUnavailableError';
  }
}

/**
 * Resolves the tenant's OpenRouter key + chosen embedding model into an
 * {@link Embedder}. The key is decrypted in-memory only here; the model is
 * `ai_settings.embedding_model` or {@link DEFAULT_EMBEDDING_MODEL}. Shared by the
 * ingestion worker (chunk embedding) and ai-service (query embedding) so the
 * resolution lives once.
 */
export async function resolveEmbedder(
  db: Database,
  encryptor: Encryptor,
  organizationId: string,
): Promise<Embedder> {
  const secret = await getAiProviderCredentialSecret(db, organizationId);
  if (!secret) {
    throw new EmbeddingProviderUnavailableError(
      'no OpenRouter API key configured for this organization',
    );
  }

  const { embeddingModel } = await getAiSettings(db, organizationId);
  return createEmbedder({
    apiKey: decryptApiKey(encryptor, secret),
    model: embeddingModel ?? DEFAULT_EMBEDDING_MODEL,
  });
}
