import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { aiProviderCredentials } from '../schema/ai-provider-credentials.js';

export type AiProviderCredentialRow = typeof aiProviderCredentials.$inferSelect;

/** Encrypted key material to persist. The plaintext key never reaches this layer. */
export interface AiProviderCredentialSecret {
  encryptedApiKey: string;
  encryptionIv: string;
  encryptionAuthTag: string;
  encryptionKeyId: string;
}

/** Safe projection — freshness only, never the encrypted material. */
export interface AiProviderCredentialStatusRow {
  updatedAt: Date;
}

/**
 * Inserts or rotates the org's OpenRouter key (org id is the PK). Setting again
 * rotates the key in place.
 */
export async function upsertAiProviderCredential(
  db: Database,
  orgId: string,
  secret: AiProviderCredentialSecret,
): Promise<void> {
  await db
    .insert(aiProviderCredentials)
    .values({ organizationId: orgId, ...secret, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: aiProviderCredentials.organizationId,
      set: { ...secret, updatedAt: new Date() },
    });
}

/** Returns when the org's key was last set, or undefined if none is configured. */
export async function getAiProviderCredentialStatus(
  db: Database,
  orgId: string,
): Promise<AiProviderCredentialStatusRow | undefined> {
  return db.query.aiProviderCredentials.findFirst({
    where: eq(aiProviderCredentials.organizationId, orgId),
    columns: { updatedAt: true },
  });
}

/** Whether the org holds an OpenRouter key. */
export async function hasAiProviderKey(db: Database, orgId: string): Promise<boolean> {
  const row = await db.query.aiProviderCredentials.findFirst({
    where: eq(aiProviderCredentials.organizationId, orgId),
    columns: { organizationId: true },
  });
  return row !== undefined;
}

/**
 * Returns the full encrypted credential for in-memory decryption at call time.
 * Service-side only — never serialize this to a client.
 */
export async function getAiProviderCredentialSecret(
  db: Database,
  orgId: string,
): Promise<AiProviderCredentialRow | undefined> {
  return db.query.aiProviderCredentials.findFirst({
    where: eq(aiProviderCredentials.organizationId, orgId),
  });
}

/** Removes the org's OpenRouter key; true if a row was deleted. */
export async function deleteAiProviderCredential(db: Database, orgId: string): Promise<boolean> {
  const rows = await db
    .delete(aiProviderCredentials)
    .where(eq(aiProviderCredentials.organizationId, orgId))
    .returning({ organizationId: aiProviderCredentials.organizationId });
  return rows.length > 0;
}
