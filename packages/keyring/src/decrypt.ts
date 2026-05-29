import type { Encryptor } from '@graft/crypto';
import type { AiProviderCredentialRow } from '@graft/db';

/**
 * Decrypts a stored provider credential's key material in-memory. Centralized so
 * the chat-model and embedder resolvers share one decrypt shape. The plaintext key
 * is never logged, persisted, or returned beyond the resolved SDK client.
 */
export function decryptApiKey(encryptor: Encryptor, secret: AiProviderCredentialRow): string {
  return encryptor.decrypt({
    ciphertext: secret.encryptedApiKey,
    iv: secret.encryptionIv,
    authTag: secret.encryptionAuthTag,
    keyId: secret.encryptionKeyId,
  });
}
