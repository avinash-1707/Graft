import type { Encryptor } from '@graft/crypto';
import { getAiProviderCredentialSecret, getAiSettings, type Database } from '@graft/db';
import { createEmbedder, type Embedder } from '@graft/rag';
import { decryptApiKey } from './decrypt.js';

/** Thrown when the org has no embedding provider selected or its key is missing. */
export class EmbeddingProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmbeddingProviderUnavailableError';
  }
}

/**
 * Resolves the tenant's embedding provider + decrypted key into an {@link Embedder}.
 * The provider is the org's `ai_settings.embedding_provider`; its key comes from the
 * keyring and is decrypted in-memory only here. Shared by the ingestion worker
 * (chunk embedding) and ai-service (query embedding) so the resolution lives once.
 */
export async function resolveEmbedder(
  db: Database,
  encryptor: Encryptor,
  organizationId: string,
): Promise<Embedder> {
  const { embeddingProvider } = await getAiSettings(db, organizationId);
  if (!embeddingProvider) {
    throw new EmbeddingProviderUnavailableError(
      'no embedding provider selected for this organization',
    );
  }

  const secret = await getAiProviderCredentialSecret(db, organizationId, embeddingProvider);
  if (!secret) {
    throw new EmbeddingProviderUnavailableError(
      `no ${embeddingProvider} API key configured for this organization`,
    );
  }

  return createEmbedder({ provider: embeddingProvider, apiKey: decryptApiKey(encryptor, secret) });
}
