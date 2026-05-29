import { randomBytes } from 'node:crypto';

/**
 * Generates a per-org embed token. Public identifier (not a secret) — the Origin
 * allow-list is the real boundary — but still high-entropy so it is unguessable.
 */
export function generateEmbedToken(): string {
  return randomBytes(24).toString('base64url');
}
