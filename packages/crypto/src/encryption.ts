import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // GCM standard nonce length
const KEY_BYTES = 32; // AES-256

/** Encrypted payload columns persisted per credential. All values are base64. */
export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyId: string;
}

/**
 * App-level envelope encryption for tenant AI provider keys (AES-256-GCM).
 *
 * Holds a keyring so a future key rotation only needs the old keys kept around
 * for decrypt while the active key encrypts new writes — each row records the
 * `keyId` it was sealed with. The master key(s) come from env and never leave
 * the process. Shared by the gateway (encrypts on write) and the ingestion/AI
 * services (decrypt in-memory at call time).
 */
export class Encryptor {
  constructor(
    private readonly activeKeyId: string,
    private readonly keys: ReadonlyMap<string, Buffer>,
  ) {
    if (!keys.has(activeKeyId)) {
      throw new Error(`active key id '${activeKeyId}' is not present in the keyring`);
    }
  }

  encrypt(plaintext: string): EncryptedPayload {
    const key = this.keys.get(this.activeKeyId)!;
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      keyId: this.activeKeyId,
    };
  }

  decrypt(payload: EncryptedPayload): string {
    const key = this.keys.get(payload.keyId);
    if (!key) throw new Error(`no decryption key for key id '${payload.keyId}'`);
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(payload.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}

export interface EncryptorConfig {
  /** Active master key, base64-encoded; must decode to 32 bytes (AES-256). */
  keyBase64: string;
  /** Label recorded on each encrypted row; identifies the key for rotation. */
  keyId: string;
}

/** Builds an {@link Encryptor} from a single active base64 key + its id. */
export function createEncryptor(config: EncryptorConfig): Encryptor {
  const key = Buffer.from(config.keyBase64, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(`encryption key must decode to ${KEY_BYTES} bytes (got ${key.length})`);
  }
  return new Encryptor(config.keyId, new Map([[config.keyId, key]]));
}
