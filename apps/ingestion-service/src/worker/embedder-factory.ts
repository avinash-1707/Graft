import type { Encryptor } from '@graft/crypto';
import { getAiProviderCredentialSecret, getAiSettings, type Database } from '@graft/db';
import { createEmbedder, type Embedder } from '@graft/rag';

/**
 * Resolves the tenant's embedding provider + decrypted key into an {@link Embedder}.
 * The provider is the org's `ai_settings.embedding_provider`; its key comes from
 * the keyring and is decrypted in-memory only here. Throws (→ FAILED document) if
 * no embedding provider is selected or its key is missing.
 */
export async function resolveEmbedder(
  db: Database,
  encryptor: Encryptor,
  organizationId: string,
): Promise<Embedder> {
  const { embeddingProvider } = await getAiSettings(db, organizationId);
  if (!embeddingProvider) {
    throw new Error('no embedding provider selected for this organization');
  }

  const secret = await getAiProviderCredentialSecret(db, organizationId, embeddingProvider);
  if (!secret) {
    throw new Error(`no ${embeddingProvider} API key configured for this organization`);
  }

  const apiKey = encryptor.decrypt({
    ciphertext: secret.encryptedApiKey,
    iv: secret.encryptionIv,
    authTag: secret.encryptionAuthTag,
    keyId: secret.encryptionKeyId,
  });

  return createEmbedder({ provider: embeddingProvider, apiKey });
}
