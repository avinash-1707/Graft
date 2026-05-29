import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { GatewayEnv } from '../env.js';

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
 * the process.
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

/** Builds the gateway encryptor from validated env. */
export function createEncryptor(env: GatewayEnv): Encryptor {
  const key = Buffer.from(env.AI_KEY_ENCRYPTION_KEY, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(`AI_KEY_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${key.length})`);
  }
  return new Encryptor(env.AI_KEY_ENCRYPTION_KEY_ID, new Map([[env.AI_KEY_ENCRYPTION_KEY_ID, key]]));
}
